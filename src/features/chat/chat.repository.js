import db, { oracledb, executeQuery, executeTransaction, getConnection } from '../../../db/oracle.js';

/**
 * ë°© ìƒì„± + ìƒì„±ìž ë©¤ë²„ ì¶”ê°€ë¥¼ í•˜ë‚˜ì˜ íŠ¸ëžœìž­ì…˜ìœ¼ë¡œ ì²˜ë¦¬í•˜ê¸° ìœ„í•´
 * ìˆ˜ë™ ì»¤ë„¥ì…˜ì„ ì‚¬ìš©í•©ë‹ˆë‹¤.
 */
export async function createRoomWithCreatorTx({ roomName, creatorId }) {
    let conn;
    try {
        conn = await getConnection(); // autoCommit: false ì‚¬ìš© í•„ìš”
        // 1) ë°© ìƒì„±
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

        // 2) ìƒì„±ìž ë©¤ë²„ ì¶”ê°€
        const memberSql = `
      INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
      VALUES (:roomId, :userId, CURRENT_TIMESTAMP)
    `;
        await conn.execute(memberSql, { roomId, userId: creatorId }, { autoCommit: false });

        // 3) ì»¤ë°‹
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

// addMemberTx ìˆ˜ì •ì•ˆ (named bind)
export async function addMemberTx({ roomId, userId }) {
    const sql = `
    INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
    VALUES (:roomId, :userId, :joinedAt)
  `;
    const now = new Date();
    await executeTransaction(sql, { roomId, userId, joinedAt: now }, { autoCommit: false });
    return true;
}

// getHistory ìˆ˜ì •ì•ˆ
export async function getHistory({ roomId, limit = 50 }) {
    const sql = `
    SELECT * FROM (
      SELECT 
        T1.MSG_ID,
        T1.ROOM_ID,
        T1.SENDER_ID,
        T1.CONTENT,
        T1.SENT_AT,
        T1.MESSAGE_TYPE,  
        T1.FILE_URL,     
        T1.FILE_NAME,     
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

/**
 * ÀÏ¹Ý ¸Þ½ÃÁö ¶Ç´Â ÆÄÀÏ ¸Þ½ÃÁö¸¦ T_MESSAGE Å×ÀÌºí¿¡ ÀúÀåÇÕ´Ï´Ù.
 * @param {object} params
 * @param {string} params.roomId
 * @param {string} params.senderId
 * @param {string} params.content - ÅØ½ºÆ® ¸Þ½ÃÁöÀÇ º»¹® (CLOB)
 * @param {string} [params.messageType='TEXT'] - 'TEXT' ¶Ç´Â 'FILE'
 * @param {string} [params.fileUrl=null] - ÆÄÀÏ ¸Þ½ÃÁöÀÇ URL
 * @param {string} [params.fileName=null] - ÆÄÀÏ ¸Þ½ÃÁöÀÇ ¿øº» ÀÌ¸§
 */
export async function saveMessageTx(params) {
    const {
        roomId,
        senderId,
        content,
        messageType = 'TEXT',
        fileUrl = null,
        fileName = null
    } = params;

    const sql = `
    INSERT INTO T_MESSAGE (ROOM_ID, SENDER_ID, CONTENT, SENT_AT, MESSAGE_TYPE, FILE_URL, FILE_NAME)
    VALUES (:roomId, :senderId, :content, CURRENT_TIMESTAMP, :messageType, :fileUrl, :fileName)
    RETURNING MSG_ID, SENT_AT INTO :outId, :outSentAt
  `;

    // CLOBÀº ÆÄÀÏ ¸Þ½ÃÁöÀÏ °æ¿ì NULLÀÌ µÇ¾î¾ß ÇÏ¹Ç·Î, Á¶°ÇºÎ·Î ¹ÙÀÎµùÇÕ´Ï´Ù.
    const contentVal = (messageType === 'FILE') ? null : content;

    const binds = {
        roomId: Number(roomId),
        senderId,
        content: contentVal ? { val: contentVal, type: oracledb.CLOB } : null, // FILE Å¸ÀÔÀÏ ¶§ NULL ¹ÙÀÎµù
        messageType,
        fileUrl: fileUrl,
        fileName: fileName,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
    };

    // NOTE: executeTransactionÀÌ autoCommit: false¸¦ °¡Á¤ÇÏ°í Æ®·£Àè¼ÇÀ» ½ÇÇàÇÑ´Ù°í °¡Á¤ÇÕ´Ï´Ù.
    const res = await executeTransaction(sql, binds, { autoCommit: false });

    const msgId = res.outBinds.outId[0];
    // Oracle DATE °´Ã¼¸¦ JavaScript timestamp (ms)·Î º¯È¯
    const sentAt = res.outBinds.outSentAt[0]?.getTime?.() ?? Date.now();

    // ÀúÀåµÈ ¸ðµç Á¤º¸¸¦ ¹ÝÈ¯ÇÏ¿© Service Layer¿¡¼­ ºê·ÎµåÄ³½ºÆ®¿¡ »ç¿ë
    return {
        msgId,
        sentAt,
        roomId: Number(roomId),
        senderId,
        content: contentVal,
        messageType,
        fileUrl,
        fileName,
    };
}


// --- ë©¤ë²„ ì‚­ì œ ë¦¬í¬ì§€í† ë¦¬ í•¨ìˆ˜ ---
export async function deleteMember({ roomId, userId }) {
    let conn; // 1. conn ë³€ìˆ˜ ì„ ì–¸ (ReferenceError í•´ê²°)
    try {
        conn = await getConnection(); // 2. ì»¤ë„¥ì…˜ íšë“

        const sql = `
            DELETE FROM T_ROOM_MEMBER
            WHERE ROOM_ID = :roomId AND USER_ID = :userId
        `;
        const binds = {
            roomId: Number(roomId),
            userId: userId
        };

        // 3. ì¿¼ë¦¬ ì‹¤í–‰ (autoCommit: false)
        const result = await conn.execute(sql, binds, { autoCommit: false });

        await conn.commit(); // 4. ëª…ì‹œì  ì»¤ë°‹ ì‹¤í–‰ (ì—¬ê¸°ì„œ ì—ëŸ¬ ë°œìƒ ì§€ì )

        const rowsAffected = result.rowsAffected;
        console.log(`[DB DELETE RESULT] rowsAffected: ${rowsAffected}`);

        return rowsAffected;

    } catch (e) {
        // 5. ì—ëŸ¬ ì‹œ ë¡¤ë°±
        if (conn) {
            console.error("Delete transaction failed, rolling back.");
            try { await conn.rollback(); } catch (rbkErr) { console.error("Rollback error:", rbkErr); }
        }
        throw e; // ì„œë¹„ìŠ¤ ë ˆì´ì–´ë¡œ ì—ëŸ¬ ë˜ì§€ê¸°
    } finally {
        // 6. ì»¤ë„¥ì…˜ ë‹«ê¸°
        if (conn) {
            try { await conn.close(); } catch (clsErr) { console.error("Close error:", clsErr); }
        }
    }
}
