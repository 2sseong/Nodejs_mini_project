// routes/invite.js (게이트웨이 방식으로 변경)
import express from 'express';
import db from '../db/oracle.js';
import socketGateway from '../src/sockets/socket.gateway.js'; 

const router = express.Router();

// 1) 사용자 검색
router.get('/search', async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json({ success: true, users: [] });

    let connection;
    try {
        connection = await db.getConnection();
        const sql = `
      SELECT USER_ID, USERNAME, NICKNAME
      FROM T_USER
      WHERE USERNAME LIKE :1
      AND ROWNUM <= 10
    `.trim();
        const result = await connection.execute(sql, [`${query}%`]);
        res.json({ success: true, users: result.rows });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ success: false, message: '서버 오류로 사용자 검색에 실패했습니다.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error('close error (search):', e); }
        }
    }
});

// 2) 초대
router.post('/invite', async (req, res) => {
    const { roomId, inviterId, inviteeId } = req.body;
    if (!roomId || !inviterId || !inviteeId) {
        return res.status(400).json({ success: false, message: '필수 정보(roomId, inviterId, inviteeId)가 누락되었습니다.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        const execOptions = { autoCommit: false };

        // 유효 사용자?
        const userCheckSql = 'SELECT USER_ID FROM T_USER WHERE USER_ID = :1';
        const userResult = await connection.execute(userCheckSql, [inviteeId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: '초대할 사용자의 ID가 유효하지 않습니다.' });
        }

        // 이미 멤버?
        const memberCheckSql = 'SELECT USER_ID FROM T_ROOM_MEMBER WHERE ROOM_ID = :1 AND USER_ID = :2';
        const memberResult = await connection.execute(memberCheckSql, [roomId, inviteeId]);
        if (memberResult.rows.length > 0) {
            return res.status(400).json({ success: false, message: '이미 채팅방에 참여 중인 사용자입니다.' });
        }

        // 추가
        const insertSql = `
      INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT) 
      VALUES (:1, :2, :3)
    `.trim();
        await connection.execute(insertSql, [roomId, inviteeId, new Date()], execOptions);

        await connection.commit();
        res.json({ success: true, message: '사용자를 성공적으로 초대했습니다.' });

        // ? 게이트웨이 경유로 초대 대상에게 rooms:fetch 신호
        socketGateway.requestRoomsRefresh(inviteeId);

    } catch (error) {
        if (connection) { try { await connection.rollback(); } catch (e) { console.error('rollback error:', e); } }
        console.error('Error inviting user:', error);
        res.status(500).json({ success: false, message: '서버 오류로 인해 초대 요청 처리에 실패했습니다.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error('close error (invite):', e); }
        }
    }
});

export default router;