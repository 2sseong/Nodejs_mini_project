import { Server } from 'socket.io';
import { addSocket, removeSocket, setIoInstance } from './socketStore.js';
import chatSocket from '../features/chat/chat.socket.js';

export default function initSocket(server) {
    const io = new Server(server, { cors: { origin: '*' } });
    setIoInstance(io);

    io.on('connection', (socket) => {
        const userId = socket.handshake.query?.userId;
        if (!userId) {
            // console.error('[Socket] userId missing. disconnect.');
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
    });

    return io;
}