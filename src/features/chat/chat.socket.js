import chatService from './chat.service.js';

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
}