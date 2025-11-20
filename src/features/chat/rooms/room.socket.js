import * as roomService from './room.service.js';

export default function roomSocket(io, socket) {
    // 1. 인증 미들웨어에서 가져온 userId 확인
    const userId = socket.data.userId;

    // 2. 자기 자신의 ID로 된 방에 접속 (유저 타겟팅용)
    if (userId) {
        socket.join(userId);
        console.log(`[Socket ${socket.id}] User ${userId} joined their personal room.`);
    }

    socket.on('rooms:fetch', async () => {
        try {
            const rooms = await roomService.listRoomsForUser({ userId });
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
}