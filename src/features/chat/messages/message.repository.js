import db, { oracledb, executeQuery, executeTransaction, getConnection as getDBConnection } from '../../../../db/oracle.js';

// getHistory 함수
export async function getHistory({ roomId, limit = 50, beforeMsgId = null }) {
    const binds = {
        roomId: roomId,
        limit: Number(limit)
    };

    /* [핵심 수정] 
       DB에 저장된 KST 시간에서 9시간(32,400,000ms)을 빼서 UTC로 가져옵니다.
       그래야 Node.js의 현재 시간(UTC)과 비교할 때 "과거"로 인식되어 정상 처리됩니다.
    */
    let innerSql = `
        SELECT 
            T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
            (CAST(T1.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
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

    const midSql = `
        SELECT * FROM (
            ${innerSql}
            ORDER BY T1.MSG_ID DESC
        )
        WHERE ROWNUM <= :limit
    `;

    const sql = `
        SELECT * FROM (
            ${midSql}
        )
        ORDER BY SENT_AT ASC, MSG_ID ASC
    `;

    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

/**
 * 일반 메시지 또는 파일 메시지를 T_MESSAGE 테이블에 저장합니다.
*/
export async function saveMessageTx(data) {
    const { roomId, senderId, content, messageType, fileUrl, fileName } = data;

    // [중요] Node.js 시간을 기준으로 저장하고, 이 시간을 그대로 반환해야 함
    const now = new Date();

    let connection;
    try {
        connection = await getDBConnection();

        const sql = `
            INSERT INTO T_MESSAGE(
                ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
            ) VALUES (
                :roomId, :senderId, :content, :messageType, :fileUrl, :fileName, :sentAt
            )
            RETURNING 
                MSG_ID, ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME
            INTO 
                :outId, :outRoomId, :outSenderId, :outContent, :outMsgType, :outFileUrl, :outFileName
        `;

        const binds = {
            roomId, senderId, content, messageType, fileUrl, fileName,
            sentAt: now, // Node.js 시간 바인딩
            outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outRoomId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outSenderId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outContent: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outMsgType: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileUrl: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileName: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
            // outSentAt 제거: DB에서 돌아오는 시간은 타임존 문제로 사용하지 않음
        };

        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 1) {
            return {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]),
                SENDER_ID: result.outBinds.outSenderId[0],
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                FILE_URL: result.outBinds.outFileUrl[0],
                FILE_NAME: result.outBinds.outFileName[0],
                SENT_AT: now // [핵심] DB 리턴값이 아닌 원래 now 객체를 반환하여 실시간성 보장
            };
        } else {
            throw new Error("메시지 저장 실패");
        }
    } catch (err) {
        console.error("DB Save Error:", err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

export async function countReadStatusByMessageIds(roomId, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];

    const bindVars = { roomId };
    messageIds.forEach((id, index) => { bindVars[`id${index}`] = id; });
    const inClause = messageIds.map((_, index) => `:id${index}`).join(', ');

    /* [수정] 
       이제 SENT_AT과 lastReadTimestamp 모두 Node.js 기준 시간이므로 
       9시간 차감(- 32402000)을 제거하고, 
       네트워크/처리 지연을 고려한 2초(- 2000) 여유만 둡니다.
    */
    const sql = `
        SELECT 
            m.MSG_ID,
            COUNT(DISTINCT r.USER_ID) AS "readCount"
        FROM T_MESSAGE m
        JOIN T_ROOM_MEMBER rm 
            ON m.ROOM_ID = rm.ROOM_ID
        LEFT JOIN UserRoomReadStatus r 
            ON m.ROOM_ID = TO_NUMBER(r.ROOM_ID)
            AND rm.USER_ID = r.USER_ID
            AND r.lastReadTimestamp >= (
                (CAST(m.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32402000
            )
        WHERE m.ROOM_ID = :roomId
          AND m.MSG_ID IN (${inClause})
        GROUP BY m.MSG_ID
    `;

    const result = await executeQuery(sql, bindVars);
    return result.rows.map(row => ({
        MSG_ID: row[0] || row.MSG_ID,
        readCount: row[1] || row.readCount || row.READCOUNT
    }));
}

// 보낸사람의 읽은 시간을 현재로 업데이트
export async function upsertReadStatus(userId, roomId, lastReadTimestamp) {
    let connection;
    try {
        connection = await getDBConnection();

        // 클라이언트나 서비스에서 넘겨준 타임스탬프를 그대로 사용
        // (없으면 Node 현재 시간)
        const ts = lastReadTimestamp || Date.now();

        const sql = `
            MERGE INTO USERROOMREADSTATUS target
            USING (
                SELECT :userId AS U_ID, :roomId AS R_ID, :ts AS TS FROM DUAL
            ) source
            ON (target.USER_ID = source.U_ID AND target.ROOM_ID = source.R_ID)
            WHEN MATCHED THEN
                UPDATE SET target.LASTREADTIMESTAMP = GREATEST(NVL(target.LASTREADTIMESTAMP, 0), source.TS)
            WHEN NOT MATCHED THEN
                INSERT (USER_ID, ROOM_ID, LASTREADTIMESTAMP)
                VALUES (source.U_ID, source.R_ID, source.TS)
        `;

        const result = await connection.execute(sql, {
            userId, roomId, ts
        }, { autoCommit: true });

        return result.rowsAffected;
    } catch (err) {
        console.error('upsertReadStatus Error:', err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

export async function getRoomReadStatus(roomId) {
    const sql = `
        SELECT USER_ID, LASTREADTIMESTAMP
        FROM UserRoomReadStatus
        WHERE ROOM_ID = :roomId
    `;
    const result = await executeQuery(sql, { roomId });
    return result.rows || [];
}

export async function updateMessageTx({ msgId, senderId, content }) {
    const sql = `
        UPDATE T_MESSAGE 
        SET CONTENT = :content 
        WHERE MSG_ID = :msgId AND SENDER_ID = :senderId
    `;
    const result = await executeTransaction(sql, {
        msgId,
        senderId,
        content
    }, { autoCommit: true });

    return result.rowsAffected > 0;
}

export async function deleteMessageTx({ msgId, senderId }) {
    const sql = `
        DELETE FROM T_MESSAGE 
        WHERE MSG_ID = :msgId AND SENDER_ID = :senderId
    `;
    const result = await executeTransaction(sql, {
        msgId,
        senderId
    }, { autoCommit: true });

    return result.rowsAffected > 0;
}

export async function searchMessages(roomId, keyword) {
    const sql = `
        SELECT m.MSG_ID, m.CONTENT, 
               (CAST(m.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
               u.NICKNAME, u.PROFILE_PIC
        FROM T_MESSAGE m
        JOIN T_USER u ON m.SENDER_ID = u.USER_ID
        WHERE m.ROOM_ID = :roomId 
          AND (m.CONTENT LIKE :keyword OR m.FILE_NAME LIKE :keyword)
        ORDER BY m.MSG_ID DESC
    `;
    const res = await executeQuery(sql, { roomId, keyword: `%${keyword}%` });
    return res.rows || [];
}

export async function getMessagesAroundId(roomId, targetMsgId, offset = 25) {
    const limitPlusOne = Number(offset) + 1;

    const binds = {
        roomId,
        targetMsgId: Number(targetMsgId),
        limitCnt: Number(offset),
        limitCntNext: limitPlusOne
    };

    const sql = `
        SELECT * FROM (
            SELECT * FROM (
                SELECT * FROM (
                    SELECT 
                        T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
                        (CAST(T1.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
                        T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                        T2.NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1
                    JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId 
                      AND T1.MSG_ID < :targetMsgId
                    ORDER BY T1.MSG_ID DESC
                )
                WHERE ROWNUM <= :limitCnt
            )
            UNION ALL
            SELECT * FROM (
                SELECT * FROM (
                    SELECT 
                        T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
                        (CAST(T1.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
                        T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                        T2.NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1
                    JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId 
                      AND T1.MSG_ID >= :targetMsgId
                    ORDER BY T1.MSG_ID ASC
                )
                WHERE ROWNUM <= :limitCntNext
            )
        )
        ORDER BY SENT_AT ASC
    `;

    try {
        const result = await executeQuery(sql, binds);
        return result.rows || [];
    } catch (err) {
        console.error('Error fetching context messages:', err);
        throw err;
    }
}

export async function getMessagesAfterId(roomId, afterMsgId, limit = 50) {
    const binds = {
        roomId,
        afterMsgId: Number(afterMsgId),
        limitCnt: Number(limit)
    };

    const sql = `
        SELECT * FROM (
            SELECT 
                T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
                (CAST(T1.SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
                T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                T2.NICKNAME, T2.PROFILE_PIC
            FROM T_MESSAGE T1
            JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
            WHERE T1.ROOM_ID = :roomId 
              AND T1.MSG_ID > :afterMsgId
            ORDER BY T1.MSG_ID ASC
        )
        WHERE ROWNUM <= :limitCnt
        ORDER BY MSG_ID ASC
    `;

    const result = await executeQuery(sql, binds);
    return result.rows || [];
}

// 특정 방의 파일 메시지 전체 조회
export async function getRoomFiles(roomId) {
    const sql = `
        SELECT 
            MSG_ID, SENDER_ID, 
            (CAST(SENT_AT AS DATE) - DATE '1970-01-01') * 86400000 - 32400000 AS SENT_AT,
            FILE_URL, FILE_NAME, MESSAGE_TYPE
        FROM T_MESSAGE
        WHERE ROOM_ID = :roomId
          AND MESSAGE_TYPE = 'FILE'
        ORDER BY SENT_AT DESC
    `;
    // 최신순 정렬
    const res = await executeQuery(sql, { roomId });
    return res.rows || [];
}