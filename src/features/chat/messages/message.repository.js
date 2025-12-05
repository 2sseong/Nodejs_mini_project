import db, { oracledb, executeQuery, executeTransaction, getConnection as getDBConnection } from '../../../../db/oracle.js';

// 1. 메시지 목록 조회 (9시간 차감하여 UTC로 변환 -> 화면 시간 정상화)
export async function getHistory({ roomId, limit = 50, beforeMsgId = null }) {
    const binds = { roomId, limit: Number(limit) };

    let innerSql = `
        SELECT 
            T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
            (
                EXTRACT(DAY FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
                EXTRACT(HOUR FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
                EXTRACT(MINUTE FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
                EXTRACT(SECOND FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
            ) - 32400000 AS SENT_AT, 
            T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
            T2.NICKNAME, T2.PROFILE_PIC 
        FROM T_MESSAGE T1
        JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
        WHERE T1.ROOM_ID = :roomId
    `;

    if (beforeMsgId) {
        innerSql += ` AND T1.MSG_ID < :beforeMsgId `;
        binds.beforeMsgId = Number(beforeMsgId);
    }

    const midSql = `SELECT * FROM (${innerSql} ORDER BY T1.MSG_ID DESC) WHERE ROWNUM <= :limit`;
    const sql = `SELECT * FROM (${midSql}) ORDER BY SENT_AT ASC, MSG_ID ASC`;

    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

// 2. 메시지 저장 (★ 수정: 저장된 시간 - 9시간 반환 ★)
export async function saveMessageTx(data) {
    const { roomId, senderId, content, messageType, fileUrl, fileName } = data;
    const now = new Date();

    let connection;
    try {
        connection = await getDBConnection();
        const sql = `
            INSERT INTO T_MESSAGE(ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT) 
            VALUES (:roomId, :senderId, :content, :messageType, :fileUrl, :fileName, :sentAt)
            RETURNING MSG_ID, ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
            INTO :outId, :outRoomId, :outSenderId, :outContent, :outMsgType, :outFileUrl, :outFileName, :outSentAt
        `;
        const binds = {
            roomId, senderId, content, messageType, fileUrl, fileName, sentAt: now,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outRoomId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outSenderId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outContent: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outMsgType: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileUrl: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileName: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
        };
        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 1) {
            const dbTime = result.outBinds.outSentAt[0];

            // [★ 중요] getHistory와 기준을 맞추기 위해 9시간을 뺍니다.
            // 안 뺴면 보낸 직후엔 KST, 새로고침하면 UTC가 되어 시간이 널뛰기하고 실시간 읽음이 무시됩니다.
            const syncedTime = new Date(dbTime.getTime() - 32400000);

            return {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]),
                SENDER_ID: result.outBinds.outSenderId[0],
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                FILE_URL: result.outBinds.outFileUrl[0],
                FILE_NAME: result.outBinds.outFileName[0],
                SENT_AT: syncedTime // 이제 getHistory와 시간이 일치합니다 (UTC)
            };
        } else { throw new Error("메시지 저장 실패"); }
    } catch (err) { throw err; } finally { if (connection) await connection.close(); }
}

// 3. 읽은 수 카운트 (★ 수정: row 변수명 에러 해결 ★)
export async function countReadStatusByMessageIds(roomId, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];
    const bindVars = { roomId };
    messageIds.forEach((id, index) => { bindVars[`id${index}`] = id; });
    const inClause = messageIds.map((_, index) => `:id${index}`).join(', ');

    const sql = `
        SELECT 
            m.MSG_ID,
            COUNT(DISTINCT r.USER_ID) AS "readCount"
        FROM T_MESSAGE m
        JOIN T_ROOM_MEMBER rm ON m.ROOM_ID = rm.ROOM_ID
        LEFT JOIN UserRoomReadStatus r 
            ON m.ROOM_ID = TO_NUMBER(r.ROOM_ID) AND rm.USER_ID = r.USER_ID
            AND m.SENT_AT <= (
                TIMESTAMP '1970-01-01 00:00:00' 
                + NUMTODSINTERVAL((r.lastReadTimestamp / 1000), 'SECOND') 
                + INTERVAL '9' HOUR 
                + NUMTODSINTERVAL(2, 'SECOND')
            )
        WHERE m.ROOM_ID = :roomId AND m.MSG_ID IN (${inClause})
        GROUP BY m.MSG_ID
    `;
    const result = await executeQuery(sql, bindVars);

    // [★ 수정 완료] 화살표 함수 인자(row)를 명확히 하여 ReferenceError 해결
    return result.rows.map(row => ({
        MSG_ID: row[0] || row.MSG_ID,
        readCount: row[1] || row.readCount || row.READCOUNT
    }));
}

// 4. 읽음 시간 업데이트 (기존 유지)
export async function upsertReadStatus(userId, roomId, lastReadTimestamp) {
    let connection;
    try {
        connection = await getDBConnection();
        const ts = lastReadTimestamp || Date.now();
        const sql = `MERGE INTO USERROOMREADSTATUS target USING (SELECT :userId AS U_ID, :roomId AS R_ID, :ts AS TS FROM DUAL) source ON (target.USER_ID = source.U_ID AND target.ROOM_ID = source.R_ID) WHEN MATCHED THEN UPDATE SET target.LASTREADTIMESTAMP = GREATEST(NVL(target.LASTREADTIMESTAMP, 0), source.TS) WHEN NOT MATCHED THEN INSERT (USER_ID, ROOM_ID, LASTREADTIMESTAMP) VALUES (source.U_ID, source.R_ID, source.TS)`;
        const result = await connection.execute(sql, { userId, roomId, ts }, { autoCommit: true });
        return result.rowsAffected;
    } catch (err) { throw err; } finally { if (connection) await connection.close(); }
}

export async function getRoomReadStatus(roomId) {
    const sql = `SELECT USER_ID, LASTREADTIMESTAMP FROM USERROOMREADSTATUS WHERE ROOM_ID = :roomId`;
    const res = await executeQuery(sql, { roomId });
    return res.rows.map(r => ({ USER_ID: r[0], lastReadTimestamp: r[1] }));
}

// 5. 검색 및 기타 (9시간 차감 추가)
export async function searchMessages(roomId, keyword) {
    const sql = `
        SELECT m.MSG_ID, m.CONTENT, 
        (
            EXTRACT(DAY FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
            EXTRACT(HOUR FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
            EXTRACT(MINUTE FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
            EXTRACT(SECOND FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
        ) - 32400000 AS SENT_AT,
        u.NICKNAME, u.PROFILE_PIC 
        FROM T_MESSAGE m JOIN T_USER u ON m.SENDER_ID = u.USER_ID 
        WHERE m.ROOM_ID = :roomId AND (m.CONTENT LIKE :keyword OR m.FILE_NAME LIKE :keyword) ORDER BY m.MSG_ID DESC
    `;
    const res = await executeQuery(sql, { roomId, keyword: `%${keyword}%` });
    return res.rows || [];
}

export async function getMessagesAroundId(roomId, targetMsgId, offset = 25) {
    const limitPlusOne = Number(offset) + 1;
    const binds = { roomId, targetMsgId, limitCnt: offset, limitCntNext: limitPlusOne };

    // [수정] - 32400000 추가
    const timeExtract = `
        (
            EXTRACT(DAY FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
            EXTRACT(HOUR FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
            EXTRACT(MINUTE FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
            EXTRACT(SECOND FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
        ) - 32400000 AS SENT_AT
    `;

    const sql = `
        SELECT * FROM (
            SELECT * FROM (
                SELECT * FROM (
                    SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, 
                           ${timeExtract},
                           T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, T2.NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1 JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID < :targetMsgId ORDER BY T1.MSG_ID DESC
                ) WHERE ROWNUM <= :limitCnt
            ) UNION ALL
            SELECT * FROM (
                SELECT * FROM (
                    SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, 
                           ${timeExtract},
                           T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, T2.NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1 JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID >= :targetMsgId ORDER BY T1.MSG_ID ASC
                ) WHERE ROWNUM <= :limitCntNext
            )
        ) ORDER BY SENT_AT ASC
    `;
    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

export async function getMessagesAfterId(roomId, afterMsgId, limit = 50) {
    const binds = { roomId, afterMsgId: Number(afterMsgId), limit: Number(limit) };

    // [수정] - 32400000 추가
    const timeExtract = `
        (
            EXTRACT(DAY FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
            EXTRACT(HOUR FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
            EXTRACT(MINUTE FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
            EXTRACT(SECOND FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
        ) - 32400000 AS SENT_AT
    `;

    const sql = `
        SELECT * FROM (
            SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, 
                   ${timeExtract},
                   T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, T2.NICKNAME, T2.PROFILE_PIC
            FROM T_MESSAGE T1 JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
            WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID > :afterMsgId ORDER BY T1.MSG_ID ASC
        ) WHERE ROWNUM <= :limit
    `;
    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

export async function getRoomFiles(roomId) {
    // [수정] - 32400000 추가
    const sql = `
        SELECT MSG_ID, FILE_URL, FILE_NAME, 
        (
            EXTRACT(DAY FROM (SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
            EXTRACT(HOUR FROM (SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
            EXTRACT(MINUTE FROM (SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
            EXTRACT(SECOND FROM (SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
        ) - 32400000 AS SENT_AT, 
        SENDER_ID 
        FROM T_MESSAGE WHERE ROOM_ID=:roomId AND MESSAGE_TYPE='FILE' ORDER BY MSG_ID DESC
    `;
    const res = await executeQuery(sql, { roomId });
    return res.rows || [];
}

export async function updateMessageTx(p) { return await executeTransaction(`UPDATE T_MESSAGE SET CONTENT=:content WHERE MSG_ID=:msgId AND SENDER_ID=:senderId`, p, { autoCommit: true }); }
export async function deleteMessageTx(p) { return await executeTransaction(`DELETE FROM T_MESSAGE WHERE MSG_ID=:msgId AND SENDER_ID=:senderId`, p, { autoCommit: true }); }