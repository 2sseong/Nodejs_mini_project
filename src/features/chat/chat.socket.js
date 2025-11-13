import chatService from './chat.service.js';
import { writeFile } from 'fs/promises'; // fs 모듈의 promises API 사용
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

export default function chatSocket(io, socket) {
    const userId = socket.data.userId;

    socket.on('rooms:fetch', async () => {
        try {
            const rooms = await chatService.listRoomsForUser({ userId });
            rooms.forEach(r => socket.join(String(r.ROOM_ID)));
            socket.emit('rooms:list', rooms);
        } catch (e) {
            console.error('[socket] rooms:fetch error', e);
            socket.emit('rooms:list', []);
        }
    });

    socket.on('room:join', ({ roomId }) => {
        socket.join(String(roomId));
    });

    socket.on('room:leave', ({ roomId }) => {
        socket.leave(String(roomId));
    });

    socket.on('chat:get_history', async ({ roomId }) => {
        try {
            const history = await chatService.getHistory({ roomId });
            socket.emit('chat:history', history);
        } catch (e) {
            console.error('[socket] chat:get_history error', e);
            socket.emit('chat:history', []);
        }
    });

    socket.on('chat:message', async (msg) => {
        try {
            const saved = await chatService.saveMessage({ userId, ...msg });
            io.to(String(saved.ROOM_ID)).emit('chat:message', { ...saved, NICKNAME: msg.NICKNAME });
        } catch (e) {
            console.error('[socket] chat:message error', e);
            socket.emit('chat:error', { message: 'Message failed to send' });
        }
    });

    // 파일저장
    export function registerChatSocketHandlers(io, socket) {
        // ... (기존 JOIN_ROOM, SEND_MESSAGE 등)

        // [추가] 파일 전송 이벤트 핸들러
        socket.on('SEND_FILE', async (data, callback) => {
            const { roomId, fileName, mimeType, fileData, userNickname } = data;

            // 1. 데이터 유효성 검사
            if (!roomId || !fileName || !fileData) {
                callback({ ok: false, error: '유효하지 않은 파일 데이터' });
                return;
            }

            try {
                // 2. 파일 정보 설정
                const extension = path.extname(fileName);
                // 고유한 파일명 생성 (npm install uuid 필요)
                const uniqueFileName = uuidv4() + extension;
                const filePath = path.join(UPLOAD_DIR, uniqueFileName);

                // 3. Base64 디코딩
                // Base64 접두사 제거 (클라이언트에서 'data:...'를 붙여 보냈다면)
                const base64Data = fileData.replace(/^data:.+;base64,/, '');
                const binaryData = Buffer.from(base64Data, 'base64');

                // 4. 로컬 디스크에 파일 저장
                await writeFile(filePath, binaryData); // fs/promises API 사용

                // 5. 클라이언트 접근 URL 생성
                const fileURL = `http://localhost:1337/uploads/${uniqueFileName}`;

                // 6. DB에 메시지 및 파일 메타데이터 저장
                // ChatService를 사용하여 DB에 저장하고, 저장된 메시지 객체를 반환
                const savedMessage = await chatService.saveFileMessage({
                    roomId,
                    userId: socket.userId, // 인증된 사용자 ID
                    userNickname,
                    fileName,
                    fileURL,
                    mimeType
                });

                // 7. 성공 응답 및 브로드캐스트
                callback({ ok: true, message: savedMessage });
                io.to(roomId).emit('BROADCAST_MESSAGE', savedMessage);

            } catch (error) {
                console.error('[SEND_FILE] 파일 처리 오류:', error);
                callback({ ok: false, error: '파일 업로드 실패' });
            }
        });
}