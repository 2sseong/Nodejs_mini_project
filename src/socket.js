// src/socket.js
// ����: DB ���� ����(����/���񽺷� �̰�), ���� �̺�Ʈ�� ���

import { addSocket, removeSocket } from './sockets/socketStore.js';
import chatService from './features/chat/chat.service.js';

export default function initSocket(io) {
    io.on('connection', (socket) => {
        // 1) ���� ����� �ĺ�
        const rawUserId = socket.handshake?.query?.userId;
        const userId = rawUserId ? String(rawUserId).trim() : '';

        if (!userId) {
            console.error('[socket] connection rejected: missing userId');
            socket.disconnect();
            return;
        }

        // 2) ���� ���� + ���� ä�� join
        addSocket(userId, socket);
        socket.data.userId = userId;
        socket.join(`user:${userId}`);
        console.log(`[socket] user connected: ${userId}`);

        // ----------------------------------------------------
        // [rooms:fetch] ����� �� ��� ��ȸ & �� ����
        // ----------------------------------------------------
        socket.on('rooms:fetch', async () => {
            try {
                const rooms = await chatService.listRoomsForUser({ userId });
                // �� ����(�̹� ���ε� ���� �ǳʶ�)
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
        // [room:join] ������ �� ���� (������ ��ȯ ��)
        // ----------------------------------------------------
        socket.on('room:join', ({ roomId }) => {
            const rid = String(roomId || '').trim();
            if (!rid) return;
            socket.join(rid);
            console.log(`[socket] ${userId} joined room ${rid}`);
        });

        // ----------------------------------------------------
        // [room:leave] ������ �� ��Ż
        // ----------------------------------------------------
        socket.on('room:leave', ({ roomId }) => {
            const rid = String(roomId || '').trim();
            if (!rid) return;
            socket.leave(rid);
            console.log(`[socket] ${userId} left room ${rid}`);
        });

        // ----------------------------------------------------
        // [chat:get_history] �޽��� �����丮 �ҷ�����
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
        // [chat:message] �޽��� ���� & ��ε�ĳ��Ʈ
        //  - ���񽺰� DB Ʈ����� ĸ��ȭ
        //  - ack �ݹ�(����): Ŭ���̾�Ʈ���� ���� Ȯ�ο� ��� ����
        // ----------------------------------------------------
        socket.on('chat:message', async (msg, ack) => {
            try {
                const { ROOM_ID, CONTENT, NICKNAME } = msg || {};
                // ���� ����
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

                // �濡 ��ε�ĳ��Ʈ (�ڱ� �ڽ� ����)
                io.to(String(saved.ROOM_ID)).emit('chat:message', {
                    ...saved,
                    NICKNAME: NICKNAME, // �ʿ� �� ���񽺿��� �г��� ������ �͵� ��
                });

                if (typeof ack === 'function') ack({ ok: true, id: saved.MSG_ID, sentAt: saved.SENT_AT });
            } catch (e) {
                console.error('[socket] chat:message error:', e);
                if (typeof ack === 'function') ack({ ok: false, error: 'Message failed to send' });
                else socket.emit('chat:error', { message: 'Message failed to send' });
            }
        });

        // ----------------------------------------------------
        // [disconnect] ����
        // ----------------------------------------------------
        socket.on('disconnect', (reason) => {
            removeSocket(userId);
            console.log(`[socket] user disconnected: ${userId} (${reason})`);
        });
    });
}