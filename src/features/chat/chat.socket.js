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
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads');
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
        const { roomId, fileName, mimeType, fileData, userNickname } = data;
        const socketUserId = socket.data.userId; // 인증된 사용자 ID 사용

        // 1. 데이터 유효성 검사
        if (!roomId || !fileName || !fileData || !socketUserId) {
            return callback({ ok: false, error: '유효하지 않은 파일 데이터' });
        }

        try {
            // 2. 파일 정보 설정
            const extension = path.extname(fileName);
            const uniqueFileName = uuidv4() + extension;
            const filePath = path.join(UPLOAD_DIR, uniqueFileName);

            // 3. Base64 디코딩
            const base64Data = fileData.replace(/^data:.+;base64,/, '');
            const binaryData = Buffer.from(base64Data, 'base64');

            // 4. 로컬 디스크에 파일 저장 (비동기)
            await writeFile(filePath, binaryData);

            // 5. 클라이언트 접근 URL 생성
            // [중요] 이 URL은 4단계에서 설정할 정적 경로와 일치해야 함
            const fileURL = `/uploads/${uniqueFileName}`; // (예: http://localhost:1337/uploads/...)
                                                       // (포트와 도메인은 클라이언트가 알고 있으므로 상대 경로도 OK)

            // 6. DB에 메시지 및 파일 메타데이터 저장
            const savedMessage = await chatService.saveFileMessage({
                roomId,
                userId: socketUserId,
                fileName, // 원본 파일명 (DB 스키마에 맞게)
                fileURL,  // 서버 접근 경로 (DB 스키마에 맞게)
                mimeType  // (필요시 mimeType도 DB에 저장)
            });

            // 7. 성공 응답 (콜백) 및 채팅방 브로드캐스트
            // (chat:message와 동일한 'chat:message' 이벤트를 사용하거나,
            //  제공된 코드처럼 'BROADCAST_MESSAGE'를 사용할 수 있음. 
            //  클라이언트가 둘 다 처리해야 함. 'chat:message'로 통일 권장)

            const broadcastData = {
                ...savedMessage, // DB에서 반환된 ROW (MSG_ID, ROOM_ID, SENDER_ID, SENT_AT, MESSAGE_TYPE, FILE_URL, FILE_NAME 등)
                NICKNAME: userNickname // NICKNAME은 T_USER 조인이 필요하므로 클라이언트에서 받은 것을 임시 사용
            };

            callback({ ok: true, message: broadcastData });
            io.to(String(roomId)).emit('chat:message', broadcastData); // 'chat:message'로 통일

        } catch (error) {
            console.error('[SEND_FILE] 파일 처리 오류:', error);
            callback({ ok: false, error: '파일 업로드 실패' });
        }
    });
}