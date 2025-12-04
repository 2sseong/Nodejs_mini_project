import * as messageService from './message.service.js';
import * as roomService from '../rooms/room.service.js';
import * as authService from '../../auth/authService.js'; // [추가] 유저 정보 조회를 위해 import
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// ES 모듈 경로 설정
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
            // 1. 메시지 히스토리 조회
            const messages = await messageService.getHistory({ roomId, beforeMsgId, limit });

            if (!messages || messages.length === 0) {
                // 메시지가 없어도 멤버들의 읽음 상태는 조회해서 보내줘야 함 (초기화 위해)
                const memberReadStatus = await messageService.getMemberReadStatus(roomId);
                const membersInRoom = await roomService.getRoomMemberCount(roomId); // 인원수도 갱신
                return socket.emit('chat:history', {
                    messages: [],
                    membersInRoom: membersInRoom || 0, // 인원수
                    memberReadStatus: memberReadStatus || {} // 읽음 상태
                });
            }

            // [추가] 방 입장 시 가장 최근 메시지 기준으로 읽음 처리 및 브로드캐스트
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

            // 2. 방 총 멤버 수 조회
            const membersInRoom = await roomService.getRoomMemberCount(roomId);
            // 3. 읽음 수 Map 계산
            const readCountMap = await messageService.getReadCountsForMessages(roomId, messages);
            // 4. 멤버별 읽음 상태 Map 조회
            const memberReadStatus = await messageService.getMemberReadStatus(roomId);
            // 5. unreadCount 결합
            const messagesWithUnread = await messageService.calculateUnreadCounts({
                messages,
                currentUserId,
                membersInRoom,
                readCountMap
            });

            socket.emit('chat:history', {
                messages: messagesWithUnread,
                membersInRoom: membersInRoom,
                memberReadStatus: memberReadStatus
            });

        } catch (e) {
            console.error('[socket] chat:get_history error', e);
            socket.emit('chat:history', { messages: [], membersInRoom: 0 });
        }
    });

    // 일반 메시지 전송
    socket.on('chat:message', async (msg) => {
        try {
            // 1. 활성 사용자 ID 목록 조회
            const roomSockets = await io.in(String(msg.ROOM_ID)).fetchSockets();
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            // 2. 메시지 저장
            const saved = await messageService.saveMessage({
                userId,
                ...msg,
                activeUserIds
            });

            // [수정] 보낸 사람의 최신 프로필 정보 조회 (DB에서 가져옴)
            const senderInfo = await authService.getUserInfo(userId);
            const membersInRoom = await roomService.getRoomMemberCount(saved.ROOM_ID);
            // 접속자가 있어도 '포커스' 전엔 안 읽은 것으로 간주하므로, 보낸 사람(1)만 뺌.
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);
            const sentAtNum = saved.SENT_AT instanceof Date ? saved.SENT_AT.getTime() : new Date(saved.SENT_AT).getTime();

            const initialMessage = {
                ...saved,
                SENT_AT: sentAtNum,
                // [수정] DB의 닉네임과 프로필 사진을 우선 사용
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

    // 파일 전송 핸들러
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

            // 1. 활성 사용자 조회
            const roomSockets = await io.in(String(roomId)).fetchSockets();
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            // 2. DB 저장
            const savedMessage = await messageService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName,
                fileURL,
                mimeType,
                activeUserIds
            });

            // [수정] 보낸 사람 정보 조회
            const senderInfo = await authService.getUserInfo(socketUserId);

            // 3. unreadCount 계산
            const membersInRoom = await roomService.getRoomMemberCount(savedMessage.ROOM_ID);
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);
            const sentAtNum = savedMessage.SENT_AT instanceof Date ? savedMessage.SENT_AT.getTime() : new Date(savedMessage.SENT_AT).getTime();

            const broadcastData = {
                ...savedMessage,
                SENT_AT: sentAtNum,
                NICKNAME: senderInfo.NICKNAME || userNickname,
                PROFILE_PIC: senderInfo.PROFILE_PIC, // [수정] 프로필 사진 추가
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
            const { roomId, lastReadTimestamp } = payload; // 클라이언트가 보낸 시간
            const currentUserId = socket.data.userId;

            if (!roomId || !lastReadTimestamp || !currentUserId) return;

            // [보정] 클라이언트 시간과 서버 시간 중 '더 미래의 시간'을 사용하거나,
            // 간단하게는 그냥 서버 시간(Date.now())을 사용하여 동기화 문제를 해결합니다.
            // 여기서는 클라이언트가 보낸 '메시지의 SENT_AT'을 신뢰하되, 
            // 혹시 모를 오차를 위해 서버 DB에 저장할 때는 그대로 쓰더라도
            // 브로드캐스팅은 확실하게 처리되도록 로직을 유지합니다.

            const isUpdated = await messageService.updateLastReadTimestamp(currentUserId, roomId, lastReadTimestamp);

            if (isUpdated) {
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

    // 메시지 수정
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

    // 메시지 삭제
    socket.on('chat:delete', async (payload) => {
        const { roomId, msgId } = payload;
        if (!roomId || !msgId) return;

        try {
            const success = await messageService.removeMessage({ msgId, userId });
            if (success) {
                io.to(String(roomId)).emit('chat:message_deleted', { msgId });
            }
        } catch (e) {
            console.error('[socket] chat:delete error', e);
        }
    });
}