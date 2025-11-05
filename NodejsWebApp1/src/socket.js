// src/socket.js (ESM 방식, DB 연동 및 모든 핸들러 통합)

import { executeQuery, executeTransaction, oracledb } from '../db/oracle.js';
// SocketStore 모듈 import (ESM 방식)
import { addSocket, removeSocket } from './socketStore.js';

export default function initSocket(io) {

    io.on('connection', (socket) => {


        // 1. 소켓 연결 시 사용자 ID 저장 (프론트에서 query: { userId: userId }로 전달)
        const connectedUserId = socket.handshake.query.userId;

        if (!connectedUserId) {
            console.error('Socket connection failed: No userId provided.');
            socket.disconnect();
            return;
        }

        //  [O(1) 소켓 저장]
        // SocketStore에 소켓 정보 저장
        addSocket(connectedUserId, socket);

        socket.join(`user:${connectedUserId}`)

        // 소켓 인스턴스에 사용자 ID 저장 (보안 및 편의성)
        socket.data.userId = connectedUserId;
        console.log(`User connected: ${socket.data.userId}`);

        // ----------------------------------------------------
        // [rooms:fetch]: 참여중인 채팅방 리스트 조회 (O(log N) 최적화)
        // ----------------------------------------------------
        socket.on('rooms:fetch', async () => {
            console.log('>>> Received rooms:fetch event');
            // T_ROOM_MEMBER와 T_CHAT_ROOM을 조인하여 방 정보 조회
            // (인덱스 IDX_MEMBER_USER 사용으로 O(log N) 최적화)
            const sql = `
                SELECT 
                    T2.ROOM_ID, T2.ROOM_NAME, T2.ROOM_TYPE
                FROM T_ROOM_MEMBER T1
                JOIN T_CHAT_ROOM T2 ON T1.ROOM_ID = T2.ROOM_ID
                WHERE T1.USER_ID = :userId
                ORDER BY T2.CREATED_AT DESC
            `;
            const binds = { userId: socket.data.userId };

            try {
                // executeQuery 사용 (커넥션 풀 자동 관리)
                const result = await executeQuery(sql, binds);
                // 응답: 클라이언트에게 'rooms:list' 이벤트로 방 리스트 전송
                // 소켓의 방 목록을 갱신합니다.
                const rooms = result.rows.map(row => String(row.ROOM_ID));

                // 기존 소켓 방을 모두 떠나고 (user:ID 방은 유지), 새로운 방에 가입
                //  새로운 방 목록에 조인
                rooms.forEach(roomId => {
                    if (!socket.rooms.has(roomId)) {
                        socket.join(roomId);
                    }
                });

                socket.emit('rooms:list', result.rows);
            } catch (error) {
                console.error("Error fetching rooms:", error);
                socket.emit('rooms:list', []); // 실패 시 빈 배열 전송
            }
        });

        // ----------------------------------------------------
        // [room:join]: 특정 방에 소켓 연결 (채팅방 진입)
        // ----------------------------------------------------
        socket.on('room:join', ({ roomId }) => {
            console.log('>>> Received room:join event with data:', roomId);
            //  클라이언트에서 rooms:fetch를 통해 자동으로 join하므로 이 로직은 주로 페이지 이동 시 사용
            socket.join(String(roomId));
            console.log(`User ${socket.data.userId} joined room ${roomId}`);
        });

        // ----------------------------------------------------
        // [room:leave]: 특정 방에서 소켓 연결 해제
        // ----------------------------------------------------
        socket.on('room:leave', ({ roomId }) => {
            console.log('>>> Received room:leave event with data:', roomId);
            socket.leave(String(roomId));
            console.log(`User ${socket.data.userId} left room ${roomId}`);
        });

        // ----------------------------------------------------
        // [chat:get_history]: 메시지 히스토리 조회 (O(log N) + I/O 최적화)
        // ----------------------------------------------------
        socket.on('chat:get_history', async ({ roomId }) => {
            const sql = `
                SELECT 
                    T1.MSG_ID, 
                    T1.ROOM_ID, 
                    T1.SENDER_ID, 
                    T1.CONTENT, 
                    T1.SENT_AT,
                    T2.NICKNAME  
                FROM T_MESSAGE T1
                JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID  
                WHERE T1.ROOM_ID = :roomId
                ORDER BY T1.SENT_AT ASC
                FETCH FIRST 50 ROWS ONLY
            `;
            const binds = { roomId: Number(roomId) };

            try {
                const result = await executeQuery(sql, binds);
                // 클라이언트에게 NICKNAME 필드가 포함된 결과 전송
                socket.emit('chat:history', result.rows);
            } catch (error) {
                console.error("Error fetching chat history:", error);
                socket.emit('chat:history', []); // 실패 시 빈 배열
            }
        });

        // ----------------------------------------------------
        // [chat:message]: 메시지 수신 및 DB 저장 (O(1) 트랜잭션 + 브로드캐스트)
        // ----------------------------------------------------
        socket.on('chat:message', async (msg) => {
            const senderId = socket.data.userId;
            const { ROOM_ID, CONTENT, NICKNAME } = msg;

            if (!senderId || !ROOM_ID || !CONTENT?.trim()) {
                console.error('Validation failed for chat message:', { senderId, ROOM_ID, CONTENT });
                return socket.emit('chat:error', { message: 'Invalid message data' });
            }

            const roomIdNum = Number(ROOM_ID);

            const sql = `
                INSERT INTO T_MESSAGE (ROOM_ID, SENDER_ID, CONTENT, SENT_AT)
                VALUES (:roomId, :senderId, :content, CURRENT_TIMESTAMP)
                RETURNING MSG_ID, SENT_AT INTO :outId, :outSentAt
            `;

            const binds = {
                roomId: roomIdNum,
                senderId: senderId,
                content: { val: CONTENT, type: oracledb.CLOB },
                outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE }
            };

            try {
                const res = await executeTransaction(sql, binds, {});

                const savedId = res.outBinds.outId[0];
                // Oracle DATE 객체에서 타임스탬프 추출
                const savedTime = res.outBinds.outSentAt[0]?.getTime?.();

                const broadcastMsg = {
                    MSG_ID: savedId,
                    ROOM_ID: roomIdNum,
                    SENDER_ID: senderId,
                    NICKNAME: NICKNAME,
                    CONTENT: CONTENT,
                    SENT_AT: savedTime
                };

                // 해당 방에 있는 모든 소켓에게 메시지 전송 (자기 자신 포함)
                //  to(ROOM_ID)를 사용하면 방에 조인된 모든 멤버에게 메시지가 O(N)으로 브로드캐스트됩니다.
                io.to(String(roomIdNum)).emit('chat:message', broadcastMsg);

            } catch (error) {
                console.error("Failed to save/broadcast message:", {
                    code: error.errorNum,
                    message: error.message,
                });
                socket.emit('chat:error', { message: 'Message failed to send' });
            }
        });

        // ----------------------------------------------------
        // [disconnect]: 연결 해제
        // ----------------------------------------------------
        socket.on('disconnect', () => {
            //  [O(1) 소켓 제거]
            removeSocket(connectedUserId);
            console.log(`User disconnected: ${socket.data.userId}`);
        });
    });
}
