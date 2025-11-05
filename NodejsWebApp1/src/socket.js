// src/socket.js (ESM 방식, DB 연동 및 모든 핸들러 통합)

import { executeQuery, executeTransaction, oracledb } from '../db/oracle.js';
import { v4 as uuidv4 } from 'uuid';

export default function initSocket(io) {

    io.on('connection', (socket) => {

       
        // 1. 소켓 연결 시 사용자 ID 저장 (프론트에서 query: { userId: userId }로 전달)
        const connectedUserId = socket.handshake.query.userId;

        if (!connectedUserId) {
            console.error('Socket connection failed: No userId provided.');
            socket.disconnect();
            return;
        }

        // 소켓 인스턴스에 사용자 ID 저장 (보안 및 편의성)
        socket.data.userId = connectedUserId;
        console.log(`User connected: ${socket.data.userId}`);

        // ----------------------------------------------------
        // ? [rooms:fetch]: 참여중인 채팅방 리스트 조회 (누락된 핸들러)
        // ----------------------------------------------------
        socket.on('rooms:fetch', async () => {
            console.log('>>> Received rooms:fetch event with data:'); // 디버깅 로그
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
                // ?? 응답: 클라이언트에게 'rooms:list' 이벤트로 방 리스트 전송
                socket.emit('rooms:list', result.rows);
            } catch (error) {
                console.error("Error fetching rooms:", error);
                socket.emit('rooms:list', []); // 실패 시 빈 배열 전송
            }
        });

        // ----------------------------------------------------
        // ? [room:join]: 특정 방에 소켓 연결 (채팅방 진입)
        // ----------------------------------------------------
        socket.on('room:join', ({ roomId }) => {
            console.log('>>> Received room:join event with data:', roomId); // 디버깅 로그
            socket.join(roomId);
            console.log(`User ${socket.data.userId} joined room ${roomId}`);
        });

        // ----------------------------------------------------
        // ? [room:leave]: 특정 방에서 소켓 연결 해제
        // ----------------------------------------------------
        socket.on('room:leave', ({ roomId }) => {
            console.log('>>> Received room:leave event with data:', roomId); // 디버깅 로그
            socket.leave(roomId);
            console.log(`User ${socket.data.userId} left room ${roomId}`);
        });

        // ----------------------------------------------------
        // ? [chat:get_history]: 메시지 히스토리 조회
        // ----------------------------------------------------
        socket.on('chat:get_history', async ({ roomId }) => {
            console.log('>>> Received chat:get_history event with data:', roomId); // 디버깅 로그
            const sql = `
                SELECT 
                    MSG_ID, ROOM_ID, SENDER_ID, CONTENT, SENT_AT
                FROM T_MESSAGE
                WHERE ROOM_ID = :roomId
                ORDER BY SENT_AT ASC -- 시간 순서대로 (오래된 메시지부터)
                FETCH FIRST 50 ROWS ONLY -- (성능 최적화: 최근 50개)
            `;
            const binds = { roomId: roomId };

            try {
                const result = await executeQuery(sql, binds);
                // ?? 응답: 클라이언트에게 'chat:history' 이벤트로 메시지 전송
                socket.emit('chat:history', result.rows);
            } catch (error) {
                console.error("Error fetching chat history:", error);
                socket.emit('chat:history', []); // 실패 시 빈 배열
            }
        });

        // ----------------------------------------------------
        // ? [chat:message]: 메시지 수신 및 DB 저장
        // ----------------------------------------------------
        socket.on('chat:message', async (msg) => {
            console.log('>>> Received chat:message event with data:', msg); // 디버깅 로그
            const senderId = socket.data.userId;
            const { ROOM_ID, CONTENT, NICKNAME } = msg;

            if (!senderId || !ROOM_ID || !CONTENT?.trim()) {
                console.error('Validation failed for chat message:', { senderId, ROOM_ID, CONTENT }); // 디버깅 로그
                return socket.emit('chat:error', { message: 'Invalid message data' });
            }

            // ROOM_ID는 Number 타입으로 변환 (Oracle DB의 NUMBER 타입과 일치시킴)
            const roomIdNum = Number(ROOM_ID);

            // ?? 쿼리 수정: MSG_ID는 시퀀스 사용, SENT_AT는 DB TIMESTAMP 사용
            const sql = `
        INSERT INTO T_MESSAGE (ROOM_ID, SENDER_ID, CONTENT, SENT_AT)
        VALUES (:roomId, :senderId, :content, CURRENT_TIMESTAMP)
        RETURNING MSG_ID, SENT_AT INTO :outId, :outSentAt
    `;

            const binds = {
                roomId: roomIdNum,
                senderId: senderId,
                // CLOB 바인딩 유지
                content: { val: CONTENT, type: oracledb.CLOB },
                // outBinds 설정은 options가 아니라 binds 객체 자체에 정의합니다.
                outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE }
            };

            // ?? 변경: executeQuery 대신 executeTransaction 사용
            try {
                // executeTransaction 호출 (outBinds를 포함한 binds와 options를 전달)
                // options는 빈 객체라도 괜찮습니다.
                const res = await executeTransaction(sql, binds, {});

                const savedId = res.outBinds.outId[0];
                const savedTime = res.outBinds.outSentAt[0]?.getTime?.() ?? Date.now();

                const broadcastMsg = {
                    MSG_ID: savedId, // DB에서 반환 받은 ID 사용
                    ROOM_ID: roomIdNum,
                    SENDER_ID: senderId,
                    NICKNAME: NICKNAME,
                    CONTENT: CONTENT,
                    SENT_AT: savedTime
                };

                socket.to(String(roomIdNum)).emit('chat:message', broadcastMsg);

            } catch (error) {
                // ?? 에러 로그를 더 자세히 출력하여 문제 파악 용이
                console.error("Failed to save/broadcast message:", {
                    code: error.errorNum,
                    message: error.message,
                    query: sql,
                    binds: { ...binds, content: '***CONTENT OMITTED***' } // 민감 정보 제거
                });
                socket.emit('chat:error', { message: 'Message failed to send' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.data.userId}`);
        });
    });
}