import * as messageService from './message.service.js';
import * as roomService from '../rooms/room.service.js'; // 방 인원수 확인용
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
                return socket.emit('chat:history', { messages: [], membersInRoom: 0 });
            }

            // 2. 방 총 멤버 수 조회 (RoomService 사용)
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
            
            const membersInRoom = await roomService.getRoomMemberCount(saved.ROOM_ID);
            
            // 접속자가 있어도 '포커스' 전엔 안 읽은 것으로 간주하므로, 보낸 사람(1)만 뺌.
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);
          
            const initialMessage = {
                 ...saved, 
                 NICKNAME: msg.NICKNAME, 
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

            // 3. unreadCount 계산
            const membersInRoom = await roomService.getRoomMemberCount(savedMessage.ROOM_ID);
            const calculatedUnreadCount = Math.max(0, membersInRoom - 1);

            const broadcastData = { 
                ...savedMessage, 
                NICKNAME: userNickname,
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

            if (!roomId || !lastReadTimestamp || !currentUserId) return;

            const isUpdated = await messageService.updateLastReadTimestamp(currentUserId, roomId, lastReadTimestamp);

            // 시간이 갱신되었을 때만 전파 (중복 방지)
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