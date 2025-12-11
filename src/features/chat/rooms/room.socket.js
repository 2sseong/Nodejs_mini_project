import * as roomService from './room.service.js';
import * as noticeService from '../notices/notice.service.js';

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

    // ===== 공지사항 이벤트 =====

    // 공지 설정
    socket.on('room:set_notice', async ({ roomId, msgId, content }) => {
        if (!roomId || !content) return;

        try {
            console.log(`[Socket] room:set_notice - roomId: ${roomId}, userId: ${userId}`);
            const notice = await noticeService.setNotice({ roomId, msgId, content, userId });

            // 해당 방의 모든 사용자에게 브로드캐스트
            io.to(String(roomId)).emit('room:notice_updated', { roomId, notice });
        } catch (err) {
            console.error('[Socket] room:set_notice error:', err);
        }
    });

    // 공지 해제
    socket.on('room:clear_notice', async ({ roomId }) => {
        if (!roomId) return;

        try {
            console.log(`[Socket] room:clear_notice - roomId: ${roomId}`);
            await noticeService.clearNotice({ roomId });

            // 해당 방의 모든 사용자에게 브로드캐스트
            io.to(String(roomId)).emit('room:notice_updated', { roomId, notice: null });
        } catch (err) {
            console.error('[Socket] room:clear_notice error:', err);
        }
    });

    // 공지 조회
    socket.on('room:get_notice', async ({ roomId }) => {
        if (!roomId) return;

        try {
            const notice = await noticeService.getNotice({ roomId });
            socket.emit('room:notice', { roomId, notice });
        } catch (err) {
            console.error('[Socket] room:get_notice error:', err);
        }
    });

    // 전체 공지 목록 조회
    socket.on('room:get_all_notices', async ({ roomId }) => {
        if (!roomId) return;

        try {
            const notices = await noticeService.getAllNotices({ roomId });
            socket.emit('room:all_notices', { roomId, notices });
        } catch (err) {
            console.error('[Socket] room:get_all_notices error:', err);
        }
    });

    // 개별 공지 삭제
    socket.on('room:delete_notice', async ({ roomId, noticeId }) => {
        if (!roomId || !noticeId) return;

        try {
            await noticeService.deleteNotice({ noticeId });
            // 삭제 후 최신 목록 및 활성 공지 브로드캐스트
            const notices = await noticeService.getAllNotices({ roomId });
            const activeNotice = await noticeService.getNotice({ roomId });
            io.to(String(roomId)).emit('room:all_notices', { roomId, notices });
            io.to(String(roomId)).emit('room:notice_updated', { roomId, notice: activeNotice });
        } catch (err) {
            console.error('[Socket] room:delete_notice error:', err);
        }
    });

    // 채팅방 알림 설정 변경 핸들러
    socket.on('room:notification_changed', async ({ roomId, enabled, userId: targetUserId }) => {
        console.log(`[Socket] room:notification_changed - roomId: ${roomId}, enabled: ${enabled}, userId: ${targetUserId}`);
        // 해당 사용자의 모든 창에 방 목록 갱신 요청
        io.to(String(targetUserId)).emit('rooms:refresh');
        // 해당 사용자에게 알림 상태 변경 이벤트 전송 (팝업 채팅 창에서 사용)
        io.to(String(targetUserId)).emit('room:notification_updated', { roomId, enabled });
    });
}