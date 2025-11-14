import chatService from './chat.service.js';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// ES 모듈에서는 __dirname이 없으므로, fileURLToPath를 사용해 현재 디렉터리 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [중요] 업로드 디렉터리 설정 (예: /src/public/uploads)
// 이 경로는 4단계의 express.static과 일치해야 합니다.
const UPLOAD_DIR = path.join(__dirname, '../../../client/public/uploads');
// (참고: 프로덕션에서는 fs.mkdir로 디렉터리 존재 여부 확인 및 생성이 필요)

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
            // [DB 저장] 'TEXT' 타입 메시지 저장
            const saved = await chatService.saveMessage({ userId, ...msg });
            // [브로드캐스트]
            io.to(String(saved.ROOM_ID)).emit('chat:message', { ...saved, NICKNAME: msg.NICKNAME });
        } catch (e) {
            console.error('[socket] chat:message error', e);
            socket.emit('chat:error', { message: 'Message failed to send' });
        }
    });

    // [추가] 파일 전송 이벤트 핸들러
    // (제공된 코드의 export function... 부분을 이곳으로 이동/통합)
    socket.on('SEND_FILE', async (data, callback) => {
        // [디버깅 1] 서버가 이벤트를 받았는지 확인
        console.log('[SERVER] SEND_FILE event received. FileName:', data.fileName);

        const { roomId, fileName, mimeType, fileData, userNickname } = data;
        const socketUserId = socket.data.userId;

        if (!roomId || !fileName || !fileData || !socketUserId) {
            console.error('[SERVER] Invalid file data received.'); // [디버깅 2]
            return callback({ ok: false, error: '유효하지 않은 파일 데이터' });
        }

        try {
            // ... (파일 정보 설정) ...
            const uniqueFileName = uuidv4() + path.extname(fileName);
            const filePath = path.join(UPLOAD_DIR, uniqueFileName);

            console.log('[SERVER] Writing file to:', filePath); // [디버깅 3]

            // ... (Base64 디코딩) ...
            const binaryData = Buffer.from(data.fileData.replace(/^data:.+;base64,/, ''), 'base64');

            // 4. 로컬 디스크에 파일 저장
            await writeFile(filePath, binaryData);

            console.log('[SERVER] File written successfully.'); // [디버깅 4]

            const fileURL = `/uploads/${uniqueFileName}`;

            // 6. DB에 메시지 및 파일 메타데이터 저장
            const savedMessage = await chatService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName,
                fileURL,
                mimeType
            });

            console.log('[SERVER] File metadata saved to DB.'); // [디버깅 5]

            // ... (Broadcast data preparation) ...
            const broadcastData = { ...savedMessage, NICKNAME: userNickname };

            callback({ ok: true, message: broadcastData });
            io.to(String(roomId)).emit('chat:message', broadcastData);

        } catch (error) {
            // 여기서 오류가 발생하면 클라이언트는 아무것도 모릅니다.
            console.error('[SERVER] SEND_FILE Critical Error:', error); 
            callback({ ok: false, error: '서버 파일 처리 중 오류 발생' });
        }
    });
}