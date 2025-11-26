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

    socket.on('room:join', async ({ roomId }) => {
        socket.join(String(roomId));
    });

    socket.on('room:leave', ({ roomId }) => {
        console.log(`[Socket ${socket.id}] leaving room: ${roomId}`);
        socket.leave(String(roomId));
    });

    // 채팅목록 읽음처리 전용 핸들러(DB 업데이트)
    socket.on('room:read', async ({ roomId, userId: reqUserId }) => {
        const targetUserId = reqUserId || userId;
        
        if (targetUserId && roomId) {
            try {
                // 1. DB 업데이트 (Timezone 이슈 해결된 로직 사용)
                await roomService.markRoomAsRead({ roomId, userId: targetUserId });
                
                // 2. [추가됨] 해당 유저의 모든 기기에 "읽음 완료" 이벤트 전송
                // io.to(userId)를 사용하면, 같은 아이디로 로그인한 '다른 탭'이나 '모바일'도 동시에 업데이트됩니다.
                io.to(String(targetUserId)).emit('room:read_complete', { 
                    roomId: String(roomId) 
                });

            } catch (err) {
                console.error(`[Socket] Failed to mark room ${roomId} read:`, err);
            }
        }
    });
}