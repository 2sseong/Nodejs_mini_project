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

    // [!!!] chat:get_history 핸들러 수정 [!!!]
    socket.on('chat:get_history', async (payload) => {
        // { roomId } 대신 'payload' 객체 전체를 받습니다.
        const { roomId, beforeMsgId = null, limit = 50 } = payload;
        
        if (!roomId) { /* ...에러 처리... */ }

        try {
            // 'beforeMsgId'와 'limit'을 서비스로 전달합니다.
            const history = await chatService.getHistory({ roomId, beforeMsgId, limit });
            socket.emit('chat:history', history);
        } catch (e) {
                console.error('[socket] chat:get_history error', e);
                socket.emit('chat:history', []);
            }
      });

    socket.on('chat:message', async (msg) => {
        try {
            console.log('[socket] chat:message received', msg); 
            // [DB 저장] 'TEXT' 타입 메시지 저장
            const saved = await chatService.saveMessage({ userId, ...msg });
          
            // saved.roomId (undefined) -> saved.ROOM_ID (올바른 값)
            io.to(String(saved.ROOM_ID)).emit('chat:message', { ...saved, NICKNAME: msg.NICKNAME, TEMP_ID: msg.TEMP_ID });
            
            console.log('[LOG ] Broadcast completed.');
        } catch (e) {
            console.error('[socket] chat:message error', e);
            socket.emit('chat:error', { message: 'Message failed to send' });
        }
    });

    // [추가] 파일 전송 이벤트 핸들러 (이 핸들러는 원래 정상이었습니다)
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

            const savedMessage = await chatService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName,
                fileURL,
                mimeType
            });

            console.log('[SERVER] File metadata saved to DB.'); 

            const broadcastData = { ...savedMessage, NICKNAME: userNickname };

            callback({ ok: true, message: broadcastData });
            // 'roomId'를 data에서 가져오므로 정상이었습니다.
            io.to(String(roomId)).emit('chat:message', broadcastData);

        } catch (error) {
            console.error('[SERVER] SEND_FILE Critical Error:', error); 
            callback({ ok: false, error: '서버 파일 처리 중 오류 발생' });
        }
    });
}