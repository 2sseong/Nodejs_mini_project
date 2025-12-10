import * as messageService from './message.service.js';
import * as roomService from '../rooms/room.service.js';
import * as authService from '../../auth/authService.js';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'public', 'uploads');

export default function messageSocket(io, socket) {
    const userId = socket.data.userId;

    socket.on('chat:get_history', async (payload) => {
        const { roomId, beforeMsgId = null, limit = 50 } = payload;
        const currentUserId = socket.data.userId;

        if (!roomId) {
            return socket.emit('chat:history', { messages: [], membersInRoom: 0 });
        }

        socket.join(String(roomId));
        console.log(`[Socket] User ${userId} joined room channel: ${roomId}`);
        try {
            // [추가] 읽음 처리 전 현재 사용자의 lastReadTimestamp 조회
            const memberReadStatusBefore = await messageService.getMemberReadStatus(roomId);
            const myLastReadBeforeEntry = memberReadStatusBefore[currentUserId] || 0;

            // 사용자 입장 시점 이후 메시지만 조회
            const messages = await messageService.getHistory({ roomId, beforeMsgId, limit, userId: currentUserId });

            if (!messages || messages.length === 0) {
                const membersInRoom = await roomService.getRoomMemberCount(roomId);
                return socket.emit('chat:history', {
                    messages: [],
                    membersInRoom: membersInRoom || 0,
                    memberReadStatus: memberReadStatusBefore || {},
                    myLastReadBeforeEntry
                });
            }

            // 초기 로딩 시에만 읽음 처리 (페이지네이션 제외)
            if (messages.length > 0 && !beforeMsgId) {
                const latestMsg = messages[messages.length - 1];
                if (latestMsg && latestMsg.SENT_AT) {
                    const timestamp = new Date(latestMsg.SENT_AT).getTime();
                    const updated = await messageService.updateLastReadTimestamp(currentUserId, roomId, timestamp);

                    if (updated) {
                        io.to(String(roomId)).emit('chat:read_update', {
                            userId: currentUserId,
                            roomId: roomId,
                            lastReadTimestamp: timestamp
                        });
                        console.log(`[Socket] Room entry read update broadcasted for user ${currentUserId}, ts: ${timestamp}`);
                    }
                }
            }

            const membersInRoom = await roomService.getRoomMemberCount(roomId);
            const readCountMap = await messageService.getReadCountsForMessages(roomId, messages);
            const memberReadStatus = await messageService.getMemberReadStatus(roomId);
            const messagesWithUnread = await messageService.calculateUnreadCounts({
                messages,
                currentUserId,
                membersInRoom,
                readCountMap
            });

            // [추가] 첫 안읽은 메시지 ID 조회
            const firstUnreadMsgId = await messageService.getFirstUnreadMsgId(roomId, currentUserId, myLastReadBeforeEntry);

            socket.emit('chat:history', {
                messages: messagesWithUnread,
                membersInRoom: membersInRoom,
                memberReadStatus: memberReadStatus,
                myLastReadBeforeEntry, // [추가] 입장 전 마지막 읽음 시간
                firstUnreadMsgId // [추가] 첫 안읽은 메시지 ID
            });

        } catch (e) {
            console.error('[socket] chat:get_history error', e);
            socket.emit('chat:history', { messages: [], membersInRoom: 0 });
        }
    });

    socket.on('chat:message', async (msg) => {
        try {
            const roomSockets = await io.in(String(msg.ROOM_ID)).fetchSockets();
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            const saved = await messageService.saveMessage({
                userId,
                ...msg,
                activeUserIds
            });

            const senderInfo = await authService.getUserInfo(userId);
            const membersInRoom = await roomService.getRoomMemberCount(saved.ROOM_ID);
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);
            const sentAtNum = saved.SENT_AT instanceof Date ? saved.SENT_AT.getTime() : new Date(saved.SENT_AT).getTime();

            const initialMessage = {
                ...saved,
                SENT_AT: sentAtNum,
                NICKNAME: senderInfo.NICKNAME || msg.NICKNAME,
                PROFILE_PIC: senderInfo.PROFILE_PIC,
                TEMP_ID: msg.TEMP_ID,
                unreadCount: calculatedUnreadCount
            };

            io.to(String(saved.ROOM_ID)).emit('chat:message', initialMessage);

        } catch (e) {
            console.error('[socket] chat:message error', e);
            socket.emit('chat:error', { message: 'Message failed to send' });
        }
    });

    socket.on('SEND_FILE', async (data, callback) => {
        const { roomId, fileName, mimeType, fileData, userNickname } = data;
        const socketUserId = socket.data.userId;

        if (!roomId || !fileName || !fileData || !socketUserId) {
            return callback({ ok: false, error: '유효하지 않은 파일 데이터' });
        }

        try {
            const uniqueFileName = uuidv4() + path.extname(fileName);
            const filePath = path.join(UPLOAD_DIR, uniqueFileName);

            const binaryData = Buffer.from(data.fileData.replace(/^data:.+;base64,/, ''), 'base64');
            await writeFile(filePath, binaryData);

            const fileURL = `/uploads/${uniqueFileName}`;

            const roomSockets = await io.in(String(roomId)).fetchSockets();
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            const savedMessage = await messageService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName,
                fileURL,
                mimeType,
                activeUserIds
            });

            const senderInfo = await authService.getUserInfo(socketUserId);

            const membersInRoom = await roomService.getRoomMemberCount(savedMessage.ROOM_ID);
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);
            const sentAtNum = savedMessage.SENT_AT instanceof Date ? savedMessage.SENT_AT.getTime() : new Date(savedMessage.SENT_AT).getTime();

            const broadcastData = {
                ...savedMessage,
                SENT_AT: sentAtNum,
                NICKNAME: senderInfo.NICKNAME || userNickname,
                PROFILE_PIC: senderInfo.PROFILE_PIC,
                unreadCount: calculatedUnreadCount
            };

            callback({ ok: true, message: broadcastData });
            io.to(String(roomId)).emit('chat:message', broadcastData);

        } catch (error) {
            console.error('[SERVER] SEND_FILE Critical Error:', error);
            callback({ ok: false, error: '서버 파일 처리 중 오류 발생' });
        }
    });

    // 읽음 처리 핸들러
    socket.on('chat:mark_as_read', async (payload) => {
        try {
            const { roomId, lastReadTimestamp } = payload;
            const currentUserId = socket.data.userId;

            console.log('[Socket] chat:mark_as_read received:', { roomId, lastReadTimestamp, userId: currentUserId });

            if (!roomId || !lastReadTimestamp || !currentUserId) return;

            const isUpdated = await messageService.updateLastReadTimestamp(currentUserId, roomId, lastReadTimestamp);
            console.log('[Socket] updateLastReadTimestamp result:', isUpdated);

            if (isUpdated) {
                console.log('[Socket] Broadcasting chat:read_update to room:', roomId);
                io.to(String(roomId)).emit('chat:read_update', {
                    userId: currentUserId,
                    roomId: roomId,
                    lastReadTimestamp: lastReadTimestamp
                });
            }
        } catch (error) {
            console.error('[socket] chat:mark_as_read error:', error);
        }
    });

    socket.on('chat:edit', async (payload) => {
        const { roomId, msgId, content } = payload;
        if (!roomId || !msgId || !content) return;

        try {
            const success = await messageService.modifyMessage({ msgId, userId, content });
            if (success) {
                io.to(String(roomId)).emit('chat:message_updated', { msgId, content });
            }
        } catch (e) {
            console.error('[socket] chat:edit error', e);
        }
    });

    socket.on('chat:delete', async (payload) => {
        const { roomId, msgId } = payload;
        if (!roomId || !msgId) return;

        try {
            // 1. 파일 정보 먼저 조회 (삭제 전에)
            const messageInfo = await messageService.getMessageById(msgId);

            // 2. DB에서 메시지 삭제
            const success = await messageService.removeMessage({ msgId, userId });

            if (success) {
                // 3. 파일 메시지였다면 실제 파일도 삭제
                if (messageInfo && messageInfo.MESSAGE_TYPE === 'FILE' && messageInfo.FILE_URL) {
                    try {
                        // FILE_URL 예: /uploads/uuid.png -> public/uploads/uuid.png 경로로 변환
                        const fileName = messageInfo.FILE_URL.replace('/uploads/', '');
                        const filePath = path.join(UPLOAD_DIR, fileName);
                        await unlink(filePath);
                        console.log(`[Socket] File deleted successfully: ${filePath}`);
                    } catch (fileErr) {
                        // 파일 삭제 실패해도 메시지는 이미 삭제됨
                        console.error('[Socket] Failed to delete file:', fileErr.message);
                    }
                }

                io.to(String(roomId)).emit('chat:message_deleted', { msgId });
            }
        } catch (e) {
            console.error('[socket] chat:delete error', e);
        }
    });
}