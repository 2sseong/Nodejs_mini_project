import chatService from './chat.service.js';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// ES 모듈에서는 __dirname이 없으므로, fileURLToPath를 사용해 현재 디렉터리 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [중요] 업로드 디렉터리 설정 (예: /src/public/uploads)
const UPLOAD_DIR = path.join(__dirname, '..','..','..','public','uploads');

export default function chatSocket(io, socket) {
    //1. 인증 미들웨어에서 가져온 userId 확인
    const userId = socket.data.userId;

    // 2. 자기 자신의 ID로 된 방에 접속
    // (io.to(userId).emit(...)을 통해 이 유저만 타겟팅할 수 있게 됨)
    if (userId) {
        socket.join(userId);
        console.log(`[Socket ${socket.id}] User ${userId} joined their personal room.`);
    }

    socket.on('rooms:fetch', async () => {
        try {
            const rooms = await chatService.listRoomsForUser({ userId });
            socket.emit('rooms:list', rooms);
        } catch (e) {
            console.error('[socket] rooms:fetch error', e);
            socket.emit('rooms:list', []);
        }
    });

    socket.on('room:join', ({ roomId }) => {
        console.log(`[Socket ${socket.id}] joining room: ${roomId}`);
        socket.join(String(roomId));
    });

    socket.on('room:leave', ({ roomId }) => {
        console.log(`[Socket ${socket.id}] leaving room: ${roomId}`);
        socket.leave(String(roomId));
    });

    // [!!!] 3단계: 'chat:get_history' 핸들러 (서버 계산 로직 적용) [!!!]
    socket.on('chat:get_history', async (payload) => {
        const { roomId, beforeMsgId = null, limit = 50 } = payload;
        const currentUserId = socket.data.userId; // 현재 요청자 ID

        if (!roomId) { 
            console.error('[socket] chat:get_history missing roomId');
            // [수정] 실패 시에도 새로운 데이터 형식으로 전송
            return socket.emit('chat:history', { messages: [], membersInRoom: 0 });
        }

        try {
            // 1. (기존) 메시지 히스토리 조회 (이것이 messages 배열)
            const messages = await chatService.getHistory({ roomId, beforeMsgId, limit });

            // 1-1. 메시지가 없으면 빈 값 반환
            if (!messages || messages.length === 0) {
                console.log(`[socket] No history found for room: ${roomId}`);
                return socket.emit('chat:history', { messages: [], membersInRoom: 0 });
            }
            // 2.   이 방의 총 멤버 수 조회 (chatService에 구현 필요)
            const membersInRoom = await chatService.getRoomMemberCount(roomId);
            // 3.   DB에서 메시지별 '읽은 사람 수'를 직접 계산 (chatService에 구현 필요)
            const readCountMap = await chatService.getReadCountsForMessages(roomId, messages);
            // 4.   멤버별 읽음 상태 Map 가져오기
            const memberReadStatus = await chatService.getMemberReadStatus(roomId);

            // 5. (결합) 메시지 객체에 unreadCount를 붙여서 최종 데이터 생성
            const messagesWithUnread = await chatService.calculateUnreadCounts({
                messages,
                currentUserId,
                membersInRoom,
                readCountMap
            });

            // 5. 클라이언트에게 '완성된 데이터' 전송
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

    socket.on('chat:message', async (msg) => {
        try {
            console.log('[socket] chat:message received', msg); 
            
            // [!!!] 1. 현재 소켓 방에 접속 중인 '활성 사용자 ID' 목록 조회
            const roomSockets = await io.in(String(msg.ROOM_ID)).fetchSockets();
            // 중복 제거 (한 유저가 여러 기기로 접속했을 수 있음)
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            console.log(`[Active Users in Room ${msg.ROOM_ID}]:`, activeUserIds);

            // [!!!] 2. saveMessage에 activeUserIds를 함께 전달
            const saved = await chatService.saveMessage({ 
                userId, 
                ...msg, 
                activeUserIds // <--- 추가됨
            });
            
            // [!!!] 3. unreadCount 계산 로직 변경 (DB 조회 대신 접속자 수 기반 계산)
            const membersInRoom = await chatService.getRoomMemberCount(saved.ROOM_ID);
            
            // (총 인원) - (현재 방에 들어와서 보고 있는 인원)
            // activeUserIds에는 '나'도 포함되어 있으므로 로직이 깔끔합니다.
            const calculatedUnreadCount = Math.max(0, membersInRoom - activeUserIds.length);
          
            const initialMessage = {
                 ...saved, 
                 NICKNAME: msg.NICKNAME, 
                 TEMP_ID: msg.TEMP_ID,
                 unreadCount: calculatedUnreadCount
            };
            
            io.to(String(saved.ROOM_ID)).emit('chat:message', initialMessage);
            console.log('[LOG ] Broadcast completed.');

        } catch (e) {
            console.error('[socket] chat:message error', e);
            socket.emit('chat:error', { message: 'Message failed to send' });
        }
    });

    // [수정] SEND_FILE 핸들러
    socket.on('SEND_FILE', async (data, callback) => {
        console.log('[SERVER] SEND_FILE event received. FileName:', data.fileName);

        const { roomId, fileName, mimeType, fileData, userNickname } = data;
        const socketUserId = socket.data.userId;

        if (!roomId || !fileName || !fileData || !socketUserId) {
            console.error('[SERVER] Invalid file data received.');
            return callback({ ok: false, error: '유효하지 않은 파일 데이터' });
        }

        try {
            const uniqueFileName = uuidv4() + path.extname(fileName);
            const filePath = path.join(UPLOAD_DIR, uniqueFileName);

            console.log('[SERVER] Writing file to:', filePath); 

            const binaryData = Buffer.from(data.fileData.replace(/^data:.+;base64,/, ''), 'base64');
            await writeFile(filePath, binaryData);
            console.log('[SERVER] File written successfully.'); 

            const fileURL = `/uploads/${uniqueFileName}`;

            // [!!!] 1. 파일 전송 시에도 활성 사용자 조회
            const roomSockets = await io.in(String(roomId)).fetchSockets();
            const activeUserIds = [...new Set(roomSockets.map(s => s.data.userId).filter(id => id))];

            // [!!!] 2. saveFileMessage에 activeUserIds 전달
            const savedMessage = await chatService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName,
                fileURL,
                mimeType,
                activeUserIds // <--- 추가됨
            });

            console.log('[SERVER] File metadata saved to DB.'); 

            // [!!!] 3. unreadCount 계산
            const membersInRoom = await chatService.getRoomMemberCount(savedMessage.ROOM_ID);
            const calculatedUnreadCount = Math.max(0, membersInRoom - activeUserIds.length);

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

    // [!!!] 2단계: '읽음' 처리 (쓰기) 핸들러 추가 [!!!]
    socket.on('chat:mark_as_read', async (payload) => {
        try {
            const { roomId, lastReadTimestamp } = payload;
            const currentUserId = socket.data.userId;

            if (!roomId || !lastReadTimestamp || !currentUserId) {
                console.warn('[socket] chat:mark_as_read invalid payload');
                return;
            }
            const isUpdated = await chatService.updateLastReadTimestamp(currentUserId, roomId, lastReadTimestamp);

            // [!!!] 핵심: 진짜로 시간이 갱신되었을 때만 방 전체에 알림을 보냅니다. [!!!]
            // 이렇게 해야 '재입장'이나 '새로고침'으로 인한 중복 차감을 막을 수 있습니다.
            if (isUpdated) {
                io.to(String(roomId)).emit('chat:read_update', {
                    userId: currentUserId,
                    roomId: roomId,
                    lastReadTimestamp: lastReadTimestamp
                });
                console.log(`[READ UPDATE] Real update broadcasted for User ${currentUserId}`);
            } else {
                // 이미 읽은 상태면 조용히 넘어갑니다.
                // console.log(`[READ UPDATE] Skipped broadcast (Already up to date).`);
            }

        } catch (error) {
            console.error('[socket] chat:mark_as_read error:', error);
        }
    });

    socket.on('chat:mark_as_read', async (payload) => {
        try {
            const { roomId, lastReadTimestamp } = payload;
            const userId = socket.userId; // (소켓 인증 시 저장된 ID)

            if (!roomId || !lastReadTimestamp || !userId) return;
            // 1. 단 하나의 쿼리 (UPSERT: 없으면 INSERT, 있으면 UPDATE)
            // Oracle의 MERGE 구문이나, 
            // SELECT 후 COUNT로 분기처리 (간단한 방식)
            await chatService.updateLastReadTimestamp(userId, roomId, lastReadTimestamp);
            
            // 2. (중요) 아무에게도 방송(emit)하지 않습니다.
            // DB에만 조용히 쓰고 끝냅니다. (성능 확보)
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    });

    // [추가] 메시지 수정 핸들러
    socket.on('chat:edit', async (payload) => {
        const { roomId, msgId, content } = payload;
        if (!roomId || !msgId || !content) return;

        try {
            const success = await chatService.modifyMessage({ msgId, userId, content });
            if (success) {
                // 방 전체에 수정된 내용 전파
                io.to(String(roomId)).emit('chat:message_updated', { msgId, content });
            }
        } catch (e) {
            console.error('[socket] chat:edit error', e);
        }
    });

    // [추가] 메시지 삭제 핸들러
    socket.on('chat:delete', async (payload) => {
        const { roomId, msgId } = payload;
        if (!roomId || !msgId) return;

        try {
            const success = await chatService.removeMessage({ msgId, userId });
            if (success) {
                // 방 전체에 삭제된 ID 전파
                io.to(String(roomId)).emit('chat:message_deleted', { msgId });
            }
        } catch (e) {
            console.error('[socket] chat:delete error', e);
        }
    });


}