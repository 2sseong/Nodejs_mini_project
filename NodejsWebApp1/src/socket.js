// src/socket.js
// 목적: DB 접근 제거(레포/서비스로 이관), 소켓 이벤트만 담당

import { addSocket, removeSocket } from './sockets/socketStore.js';
import chatService from './features/chat/chat.service.js';

export default function initSocket(io) {
    io.on('connection', (socket) => {
        // 1) 접속 사용자 식별
        const rawUserId = socket.handshake?.query?.userId;
        const userId = rawUserId ? String(rawUserId).trim() : '';

        if (!userId) {
            console.error('[socket] connection rejected: missing userId');
            socket.disconnect();
            return;
        }

        // 2) 소켓 저장 + 개인 채널 join
        addSocket(userId, socket);
        socket.data.userId = userId;
        socket.join(`user:${userId}`);
        console.log(`[socket] user connected: ${userId}`);

        // ----------------------------------------------------
        // [rooms:fetch] 사용자 방 목록 조회 & 방 조인
        // ----------------------------------------------------
        socket.on('rooms:fetch', async () => {
            try {
                const rooms = await chatService.listRoomsForUser({ userId });
                // 방 조인(이미 조인된 방은 건너뜀)
                rooms.forEach((r) => {
                    const rid = String(r.ROOM_ID);
                    if (!socket.rooms.has(rid)) socket.join(rid);
                });
                socket.emit('rooms:list', rooms);
            } catch (e) {
                console.error('[socket] rooms:fetch error:', e);
                socket.emit('rooms:list', []);
            }
        });

        // ----------------------------------------------------
        // [room:join] 명시적 방 진입 (페이지 전환 등)
        // ----------------------------------------------------
        socket.on('room:join', ({ roomId }) => {
            const rid = String(roomId || '').trim();
            if (!rid) return;
            socket.join(rid);
            console.log(`[socket] ${userId} joined room ${rid}`);
        });

        // ----------------------------------------------------
        // [room:leave] 명시적 방 이탈
        // ----------------------------------------------------
        socket.on('room:leave', ({ roomId }) => {
            const rid = String(roomId || '').trim();
            if (!rid) return;
            socket.leave(rid);
            console.log(`[socket] ${userId} left room ${rid}`);
        });

        // ----------------------------------------------------
        // [chat:get_history] 메시지 히스토리 불러오기
        // ----------------------------------------------------
        socket.on('chat:get_history', async ({ roomId, limit }) => {
            const rid = String(roomId || '').trim();
            if (!rid) {
                socket.emit('chat:history', []);
                return;
            }
            try {
                const history = await chatService.getHistory({ roomId: rid, limit });
                socket.emit('chat:history', history);
            } catch (e) {
                console.error('[socket] chat:get_history error:', e);
                socket.emit('chat:history', []);
            }
        });

        // ----------------------------------------------------
        // [chat:message] 메시지 저장 & 브로드캐스트
        //  - 서비스가 DB 트랜잭션 캡슐화
        //  - ack 콜백(선택): 클라이언트에서 전송 확인에 사용 가능
        // ----------------------------------------------------
        socket.on('chat:message', async (msg, ack) => {
            try {
                const { ROOM_ID, CONTENT, NICKNAME } = msg || {};
                // 간단 검증
                if (!ROOM_ID || !String(CONTENT || '').trim()) {
                    if (typeof ack === 'function') ack({ ok: false, error: 'Invalid payload' });
                    else socket.emit('chat:error', { message: 'Invalid message data' });
                    return;
                }

                const saved = await chatService.saveMessage({
                    userId,
                    ROOM_ID: String(ROOM_ID),
                    CONTENT: String(CONTENT),
                });

                // 방에 브로드캐스트 (자기 자신 포함)
                io.to(String(saved.ROOM_ID)).emit('chat:message', {
                    ...saved,
                    NICKNAME: NICKNAME, // 필요 시 서비스에서 닉네임 조인해 와도 됨
                });

                if (typeof ack === 'function') ack({ ok: true, id: saved.MSG_ID, sentAt: saved.SENT_AT });
            } catch (e) {
                console.error('[socket] chat:message error:', e);
                if (typeof ack === 'function') ack({ ok: false, error: 'Message failed to send' });
                else socket.emit('chat:error', { message: 'Message failed to send' });
            }
        });

        // ----------------------------------------------------
        // [disconnect] 정리
        // ----------------------------------------------------
        socket.on('disconnect', (reason) => {
            removeSocket(userId);
            console.log(`[socket] user disconnected: ${userId} (${reason})`);
        });
    });
}