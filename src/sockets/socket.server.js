import { Server } from 'socket.io';
import { addSocket, removeSocket, setIoInstance } from './socketStore.js';
import chatSocket from '../features/chat/chat.socket.js';

export default function initSocket(server) {
    const io = new Server(server, { cors: { origin: '*' } });
    setIoInstance(io);

    io.on('connection', (socket) => {
        const userId = socket.handshake.query?.userId;
        if (!userId) {
            console.error('[Socket] userId missing. disconnect.');
            socket.disconnect();
            return;
        }
        socket.data.userId = String(userId);
        addSocket(userId, socket);
        socket.join(`user:${userId}`);

        chatSocket(io, socket);

        socket.on('disconnect', () => {
            removeSocket(userId);
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
    });

    return io;
}