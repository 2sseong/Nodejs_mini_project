// routes/chats.js
import express from 'express';
import { getConnection, oracledb } from '../db/oracle.js';

const router = express.Router();

router.post('/create', async (req, res) => {
    const { roomName, creatorId } = req.body;

    if (!creatorId) {
        return res.status(401).json({ success: false, message: '사용자 정보(creatorId)가 누락되었습니다.' });
    }
    if (!roomName || roomName.trim().length === 0) {
        return res.status(400).json({ success: false, message: '채팅방 이름은 필수입니다.' });
    }

    let connection;
    let newRoomId = null;

    try {
        connection = await getConnection();

        // 1) 방 생성
        const roomSql = `
      INSERT INTO T_CHAT_ROOM (ROOM_NAME, ROOM_TYPE, CREATED_AT)
      VALUES (:roomName, 'GROUP', CURRENT_TIMESTAMP)
      RETURNING ROOM_ID INTO :roomId
    `;
        const roomBinds = {
            roomName,
            roomId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        };
        const roomResult = await connection.execute(roomSql, roomBinds, { autoCommit: false });
        newRoomId = roomResult.outBinds.roomId[0];

        // 2) 생성자 멤버 추가
        const memberSql = `
      INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
      VALUES (:roomId, :userId, CURRENT_TIMESTAMP)
    `;
        await connection.execute(memberSql, { roomId: newRoomId, userId: creatorId }, { autoCommit: false });

        // 3) 커밋
        await connection.commit();

        // 4) 생성된 방 정보(roomId, roomName, roomType)를 직접 푸시.
        const io = req.app.get('io');
        if (io) {
            //  현재 사용자(creatorId)의 소켓에게만 전송
            io.to(`user:${creatorId}`).emit('room:new_created', {
                roomId: newRoomId, // DB에서 생성된 실제 ID
                roomName,
                roomType: 'GROUP'
            });

            // ? 참고: 채팅방에 참여한 모든 멤버에게 알림이 필요하다면 io.emit('room:new_created', ...)을 사용해야 합니다.
            // 현재는 생성자만 목록에 추가하면 되므로 io.to()가 효율적입니다.
        }

        return res.status(201).json({
            success: true,
            message: '채팅방이 성공적으로 생성되었습니다.',
            roomId: newRoomId,
            roomName
        });

    } catch (err) {
        console.error('Chatroom Creation Error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rbErr) { console.error('Error during rollback:', rbErr); }
        }
        return res.status(500).json({ success: false, message: '채팅방 생성 중 서버 오류가 발생했습니다.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error('Error closing connection:', err); }
        }
    }
});

export default router;