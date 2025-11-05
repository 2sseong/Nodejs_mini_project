// invite.js (ESM 방식으로 변경된 백엔드 라우터 파일)

import express from 'express';
import { getSocketByUserId } from '../src/socketStore.js';

const router = express.Router();

// ---------------------------------------------------------------------
// 1. [GET] /users/search: 사용자 검색 API
// ---------------------------------------------------------------------
router.get('/users/search', async (req, res) => {
    const { query } = req.query;

    if (!query || query.length < 2) {
        return res.json({ success: true, users: [] });
    }

    let connection;
    try {
        connection = await db.getConnection();

        //  USERNAME LIKE 검색
        const searchQuery = `${query}%`;

        const [users] = await connection.query(
            // 데이터 타입에 주의하여 결과 컬럼 반환 (USER_ID는 문자열로 처리)
            `SELECT USER_ID, USERNAME, NICKNAME 
             FROM T_USER 
             WHERE USERNAME LIKE ? 
             LIMIT 10`,
            [searchQuery]
        );

        res.json({ success: true, users: users });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ success: false, message: '서버 오류로 사용자 검색에 실패했습니다.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ---------------------------------------------------------------------
// 2. [POST] /chats/invite: 채팅방에 인원 초대 API
// 시간 복잡도: O(1) (단일 DB INSERT, Hash Map 기반 Socket 검색)
// ---------------------------------------------------------------------
router.post('/invite', async (req, res) => {
    const { roomId, inviterId, inviteeId } = req.body;

    if (!roomId || !inviterId || !inviteeId) {
        return res.status(400).json({ success: false, message: '필수 정보(roomId, inviterId, inviteeId)가 누락되었습니다.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. 초대 대상 유효성 확인 (O(1))
        const [users] = await connection.query('SELECT USER_ID FROM T_USER WHERE USER_ID = ?', [inviteeId]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: '초대할 사용자의 ID가 유효하지 않습니다.' });
        }

        // 2. 이미 방에 참여 중인지 확인 (O(1))
        const [existingMembers] = await connection.query(
            'SELECT USER_ID FROM T_ROOM_MEMBER WHERE ROOM_ID = ? AND USER_ID = ?',
            [roomId, inviteeId]
        );

        if (existingMembers.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: '이미 채팅방에 참여 중인 사용자입니다.' });
        }

        // 3. T_ROOM_MEMBER에 멤버 추가 (O(1))
        const now = new Date();
        await connection.query(
            'INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOIN_AT) VALUES (?, ?, ?)',
            [roomId, inviteeId, now]
        );

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
            await connection.rollback();
        }
        console.error('Error inviting user:', error);
        res.status(500).json({ success: false, message: '서버 오류로 인해 초대 요청 처리에 실패했습니다.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

export default router;