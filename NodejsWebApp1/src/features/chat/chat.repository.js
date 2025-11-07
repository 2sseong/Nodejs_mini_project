import db, { oracledb, executeQuery, executeTransaction, getConnection } from '../../../db/oracle.js';

/**
 * 방 생성 + 생성자 멤버 추가를 하나의 트랜잭션으로 처리하기 위해
 * 수동 커넥션을 사용합니다.
 */
export async function createRoomWithCreatorTx({ roomName, creatorId }) {
    let conn;
    try {
        conn = await getConnection(); // autoCommit: false 사용 필요
        // 1) 방 생성
        const roomSql = `
      INSERT INTO T_CHAT_ROOM (ROOM_NAME, ROOM_TYPE, CREATED_AT)
      VALUES (:roomName, 'GROUP', CURRENT_TIMESTAMP)
      RETURNING ROOM_ID INTO :roomId
    `;
        const roomBinds = {
            roomName,
            roomId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        };
        const roomRes = await conn.execute(roomSql, roomBinds, { autoCommit: false });
        const roomId = roomRes.outBinds.roomId[0];

        // 2) 생성자 멤버 추가
        const memberSql = `
      INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
      VALUES (:roomId, :userId, CURRENT_TIMESTAMP)
    `;
        await conn.execute(memberSql, { roomId, userId: creatorId }, { autoCommit: false });

        // 3) 커밋
        await conn.commit();

        return { roomId, roomName, roomType: 'GROUP', creatorId };
    } catch (e) {
        if (conn) { try { await conn.rollback(); } catch { } }
        throw e;
    } finally {
        if (conn) { try { await conn.close(); } catch { } }
    }
}

export async function listRoomsByUser({ userId }) {
    const sql = `
    SELECT T2.ROOM_ID, T2.ROOM_NAME, T2.ROOM_TYPE
    FROM T_ROOM_MEMBER T1
    JOIN T_CHAT_ROOM T2 ON T1.ROOM_ID = T2.ROOM_ID
    WHERE T1.USER_ID = :userId
    ORDER BY T2.CREATED_AT DESC
  `;
    const res = await executeQuery(sql, { userId });
    return res.rows || [];
}

export async function ensureUserExists(userId) {
    const sql = 'SELECT USER_ID FROM T_USER WHERE USER_ID = :1';
    const res = await executeQuery(sql, [userId]);
    return res.rows?.length > 0;
}

export async function isMember({ roomId, userId }) {
    const sql = 'SELECT 1 FROM T_ROOM_MEMBER WHERE ROOM_ID = :1 AND USER_ID = :2';
    const res = await executeQuery(sql, [roomId, userId]);
    return res.rows?.length > 0;
}

// addMemberTx 수정안 (named bind)
export async function addMemberTx({ roomId, userId }) {
    const sql = `
    INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
    VALUES (:roomId, :userId, :joinedAt)
  `;
    const now = new Date();
    await executeTransaction(sql, { roomId, userId, joinedAt: now }, { autoCommit: false });
    return true;
}

// getHistory 수정안
export async function getHistory({ roomId, limit = 50 }) {
    const sql = `
    SELECT * FROM (
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
    )
    WHERE ROWNUM <= :limit
  `;
    const res = await executeQuery(sql, { roomId: Number(roomId), limit: Number(limit) });
    return res.rows || [];
}

export async function saveMessageTx({ roomId, senderId, content }) {
    const sql = `
    INSERT INTO T_MESSAGE (ROOM_ID, SENDER_ID, CONTENT, SENT_AT)
    VALUES (:roomId, :senderId, :content, CURRENT_TIMESTAMP)
    RETURNING MSG_ID, SENT_AT INTO :outId, :outSentAt
  `;
    const binds = {
        roomId: Number(roomId),
        senderId,
        content: { val: content, type: oracledb.CLOB },
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
    };
    const res = await executeTransaction(sql, binds, { autoCommit: false });
    const msgId = res.outBinds.outId[0];
    const sentAt = res.outBinds.outSentAt[0]?.getTime?.();
    return { msgId, sentAt };
}