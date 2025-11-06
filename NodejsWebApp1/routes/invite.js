// invite.js (ESM 방식으로 변경된 백엔드 라우터 파일)

import express from 'express';
// db는 default export, oracledb는 named export로 가져옵니다.
import db, { oracledb } from '../db/oracle.js';
import { getSocketByUserId } from '../src/socketStore.js';

const router = express.Router();

// ---------------------------------------------------------------------
// 1. [GET] /users/search: 사용자 검색 API
// 시간 복잡도: O(log N) (Index Search) + O(Limit)
// ---------------------------------------------------------------------
router.get('/search', async (req, res) => {
    // 1. 인증된 사용자 ID를 req.user에서 추출 (미들웨어가 없으므로 임시로 무시)
    // const currentUserId = req.user.id; 

    const { query } = req.query;

    if (!query || query.length < 2) {
        return res.json({ success: true, users: [] });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // 오라클 DB 바인드 변수 스타일 사용 (:1)
        const searchQuery = `${query}%`;

        // ?? ORA-00911 오류 방지를 위해 SQL 문자열에 .trim() 필수 적용
        const sql = `
            SELECT USER_ID, USERNAME, NICKNAME
            FROM T_USER
            WHERE USERNAME LIKE :1 
            AND ROWNUM <= 10
        `.trim(); // <--- ORA-00911 방지

        // connection.execute 사용
        const result = await connection.execute(sql, [searchQuery]);

        // T_USER의 USERNAME 컬럼에 인덱스가 있다면 이 검색은 O(log N)에 가깝습니다.
        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ success: false, message: '서버 오류로 사용자 검색에 실패했습니다.' });
    } finally {
        if (connection) {
            try {
                // 수정: await를 사용하여 커넥션 종료를 기다리고 try/catch 추가
                await connection.close();
            } catch (closeError) {
                console.error('Error closing connection (search):', closeError);
            }
        }
    }
});


// ---------------------------------------------------------------------
// 2. [POST] /chats/invite: 채팅방에 인원 초대 API
// 시간 복잡도: O(1) (3개의 Index Lookup + 1개의 Insert)
// ---------------------------------------------------------------------
router.post('/invite', async (req, res) => {
    const { roomId, inviterId, inviteeId } = req.body;

    if (!roomId || !inviterId || !inviteeId) {
        return res.status(400).json({ success: false, message: '필수 정보(roomId, inviterId, inviteeId)가 누락되었습니다.' });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // DML의 autoCommit을 false로 설정하여 트랜잭션 경계를 잡습니다.
        const execOptions = { autoCommit: false };

        // 1. 초대 대상 유효성 확인 (O(1))
        const userCheckSql = 'SELECT USER_ID FROM T_USER WHERE USER_ID = :1'.trim();
        const userResult = await connection.execute(userCheckSql, [inviteeId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: '초대할 사용자의 ID가 유효하지 않습니다.' });
        }

        // 2. 이미 방에 참여 중인지 확인 (O(1))
        const memberCheckSql = 'SELECT USER_ID FROM T_ROOM_MEMBER WHERE ROOM_ID = :1 AND USER_ID = :2'.trim();
        const memberResult = await connection.execute(memberCheckSql, [roomId, inviteeId]);

        if (memberResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: '이미 채팅방에 참여 중인 사용자입니다.' });
        }

        // 3. T_ROOM_MEMBER에 멤버 추가 (O(1)) - DML 시작, autoCommit: false 적용
        const now = new Date();
        const insertSql = `
            INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT) 
            VALUES (:1, :2, :3)
        `.trim();
        await connection.execute(insertSql, [roomId, inviteeId, now], execOptions);

        // 트랜잭션 커밋
        await connection.commit();
        res.json({ success: true, message: `사용자를 성공적으로 초대했습니다.` });

        // ----------------------------------------------------------
        // 4. Socket.IO를 통한 실시간 방 목록 갱신 (O(1))
        // ----------------------------------------------------------
        const inviteeSocket = getSocketByUserId(inviteeId);
        if (inviteeSocket) {
            console.log(` Socket: ${inviteeId}에게 rooms:fetch 이벤트 전송 (새 방 목록 갱신)`);
            inviteeSocket.emit('rooms:fetch', { userId: inviteeId, authToken: null });
        } else {
            console.log(`?? Socket: ${inviteeId}는 오프라인입니다. 다음 접속 시 방 목록이 갱신됩니다.`);
        }

    } catch (error) {
        if (connection) {
            // DML이 실패했거나 커밋 전에 에러가 발생했다면 롤백
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
        }
        console.error('Error inviting user:', error);
        res.status(500).json({ success: false, message: '서버 오류로 인해 초대 요청 처리에 실패했습니다.' });
    } finally {
        if (connection) {
            try {
                // 수정: await를 사용하여 커넥션 종료를 기다리고 try/catch 추가
                await connection.close();
            } catch (closeError) {
                console.error('Error closing connection (invite):', closeError);
            }
        }
    }
});

export default router;