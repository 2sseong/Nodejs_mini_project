import db, { oracledb, executeQuery, executeTransaction, getConnection as getDBConnection } from '../../../../db/oracle.js';

// 1. 메시지 목록 조회 (사용자 입장 시점 이후 메시지만)
export async function getHistory({ roomId, limit = 50, beforeMsgId = null, userId = null }) {
    const binds = { roomId: Number(roomId), limit: Number(limit) };

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
            NVL(T2.NICKNAME, 'SYSTEM') AS NICKNAME, T2.PROFILE_PIC 
        FROM T_MESSAGE T1
        LEFT JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
        WHERE T1.ROOM_ID = :roomId
    `;

    // 사용자 입장 시점 이후 메시지만 조회
    if (userId) {
        innerSql += ` AND T1.SENT_AT >= (SELECT JOINED_AT FROM T_ROOM_MEMBER WHERE ROOM_ID = :roomId AND USER_ID = :userId) `;
        binds.userId = userId;
    }

    if (beforeMsgId) {
        innerSql += ` AND T1.MSG_ID < :beforeMsgId `;
        binds.beforeMsgId = Number(beforeMsgId);
    }

    const midSql = `SELECT * FROM (${innerSql} ORDER BY T1.MSG_ID DESC) WHERE ROWNUM <= :limit`;
    const sql = `SELECT * FROM (${midSql}) ORDER BY SENT_AT ASC, MSG_ID ASC`;

    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

// 2. 메시지 저장
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
            return {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]),
                SENDER_ID: result.outBinds.outSenderId[0],
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                FILE_URL: result.outBinds.outFileUrl[0],
                FILE_NAME: result.outBinds.outFileName[0],
                SENT_AT: dbTime
            };
        } else {
            throw new Error("메시지 저장 실패");
        }
    } catch (err) {
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

// 2-1. 시스템 메시지 저장 (초대/퇴장 알림용)
export async function saveSystemMessage({ roomId, content }) {
    const now = new Date();
    let connection;
    try {
        connection = await getDBConnection();
        const sql = `
            INSERT INTO T_MESSAGE(ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT) 
            VALUES (:roomId, NULL, :content, 'SYSTEM', NULL, NULL, :sentAt)
            RETURNING MSG_ID, ROOM_ID, CONTENT, MESSAGE_TYPE, SENT_AT
            INTO :outId, :outRoomId, :outContent, :outMsgType, :outSentAt
        `;
        const binds = {
            roomId: Number(roomId),
            content,
            sentAt: now,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outRoomId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outContent: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outMsgType: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
        };
        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 1) {
            const dbTime = result.outBinds.outSentAt[0];
            return {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]),
                SENDER_ID: null,
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                NICKNAME: 'SYSTEM',
                SENT_AT: dbTime
            };
        } else {
            throw new Error("시스템 메시지 저장 실패");
        }
    } catch (err) {
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

// 3. 읽은 수 카운트
export async function countReadStatusByMessageIds(roomId, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];

    const numericRoomId = Number(roomId);
    const bindVars = { roomId: numericRoomId };
    messageIds.forEach((id, index) => { bindVars[`id${index}`] = id; });
    const inClause = messageIds.map((_, index) => `:id${index}`).join(', ');

    // SENT_AT을 JS 밀리초 타임스탬프로 변환하여 비교
    const sql = `
        SELECT 
            m.MSG_ID,
            COUNT(DISTINCT r.USER_ID) AS "readCount"
        FROM T_MESSAGE m
        JOIN T_ROOM_MEMBER rm ON m.ROOM_ID = rm.ROOM_ID
        LEFT JOIN UserRoomReadStatus r 
            ON m.ROOM_ID = r.ROOM_ID AND rm.USER_ID = r.USER_ID
            AND (
                EXTRACT(DAY FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
                EXTRACT(HOUR FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
                EXTRACT(MINUTE FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
                EXTRACT(SECOND FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
            ) - 32400000 <= r.LASTREADTIMESTAMP + 2000
        WHERE m.ROOM_ID = :roomId AND m.MSG_ID IN (${inClause})
        GROUP BY m.MSG_ID
    `;
    const result = await executeQuery(sql, bindVars);

    return result.rows.map(row => ({
        MSG_ID: row.MSG_ID,
        readCount: row.readCount || 0
    }));
}

// 4. 읽음 시간 업데이트 (항상 업데이트, 브로드캐스트 여부 반환)
export async function upsertReadStatus(userId, roomId, lastReadTimestamp) {
    let connection;
    try {
        connection = await getDBConnection();
        const ts = lastReadTimestamp || Date.now();
        const numericRoomId = Number(roomId);

        // 1. 기존 값 조회
        const selectSql = `SELECT LASTREADTIMESTAMP FROM USERROOMREADSTATUS WHERE USER_ID = :userId AND ROOM_ID = :roomId`;
        const selectResult = await connection.execute(selectSql, { userId, roomId: numericRoomId });
        const existingTs = selectResult.rows?.[0]?.LASTREADTIMESTAMP || 0;

        console.log(`[Repository] upsertReadStatus: userId=${userId}, roomId=${numericRoomId}, newTs=${ts}, existingTs=${existingTs}`);

        // 2. 새 타임스탬프가 기존보다 클 때만 업데이트 (과거로 리셋 방지)
        if (ts <= existingTs) {
            console.log(`[Repository] Skipping update - new timestamp is not newer`);
            return { updated: false, timestamp: existingTs };
        }

        const sql = `
        MERGE INTO USERROOMREADSTATUS target 
        USING (SELECT :userId AS U_ID, :roomId AS R_ID, :ts AS TS FROM DUAL) source 
        ON (target.USER_ID = source.U_ID AND target.ROOM_ID = source.R_ID) 
        WHEN MATCHED THEN UPDATE SET target.LASTREADTIMESTAMP = source.TS 
        WHEN NOT MATCHED THEN INSERT (USER_ID, ROOM_ID, LASTREADTIMESTAMP) VALUES (source.U_ID, source.R_ID, source.TS)
        `;
        await connection.execute(sql, { userId, roomId: numericRoomId, ts }, { autoCommit: true });

        // 3. 업데이트 성공
        return { updated: true, timestamp: ts };
    } catch (err) {
        console.error('[Repository] upsertReadStatus error:', err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

// 5. 방 멤버 읽음 상태 조회
export async function getRoomReadStatus(roomId) {
    const numericRoomId = Number(roomId);
    const sql = `SELECT USER_ID, LASTREADTIMESTAMP FROM USERROOMREADSTATUS WHERE ROOM_ID = :roomId`;
    const res = await executeQuery(sql, { roomId: numericRoomId });
    return res.rows || [];
}

// 6. 메시지 검색 (오래된 순으로 정렬: 인덱스 0 = 가장 오래된, 마지막 = 가장 최신)
export async function searchMessages(roomId, keyword) {
    const sql = `
        SELECT m.MSG_ID, m.CONTENT, 
        (
            EXTRACT(DAY FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
            EXTRACT(HOUR FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
            EXTRACT(MINUTE FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
            EXTRACT(SECOND FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
        ) - 32400000 AS SENT_AT,
        NVL(u.NICKNAME, 'SYSTEM') AS NICKNAME, u.PROFILE_PIC 
        FROM T_MESSAGE m LEFT JOIN T_USER u ON m.SENDER_ID = u.USER_ID 
        WHERE m.ROOM_ID = :roomId AND (m.CONTENT LIKE :keyword OR m.FILE_NAME LIKE :keyword) ORDER BY m.MSG_ID ASC
    `;
    const res = await executeQuery(sql, { roomId: Number(roomId), keyword: `%${keyword}%` });
    return res.rows || [];
}

// 6-1. 첫 안읽은 메시지 ID 조회 (입장 시 스크롤 위치 결정용)
export async function getFirstUnreadMsgId(roomId, userId, lastReadTimestamp) {
    // lastReadTimestamp를 Oracle TIMESTAMP로 변환
    // JavaScript timestamp (ms) -> Oracle TIMESTAMP
    const sql = `
        SELECT MSG_ID FROM (
            SELECT m.MSG_ID
            FROM T_MESSAGE m
            WHERE m.ROOM_ID = :roomId
            AND m.SENDER_ID != :userId
            AND (
                EXTRACT(DAY FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
                EXTRACT(HOUR FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
                EXTRACT(MINUTE FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
                EXTRACT(SECOND FROM (m.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
            ) - 32400000 > :lastReadTs
            ORDER BY m.MSG_ID ASC
        ) WHERE ROWNUM = 1
    `;
    const res = await executeQuery(sql, {
        roomId: Number(roomId),
        userId: userId,
        lastReadTs: Number(lastReadTimestamp)
    });
    return res.rows?.[0]?.MSG_ID || null;
}

export async function getMessagesAroundId(roomId, targetMsgId, offset = 25) {
    const limitPlusOne = Number(offset) + 1;
    const binds = { roomId: Number(roomId), targetMsgId, limitCnt: offset, limitCntNext: limitPlusOne };

    const timeExtract = `(
        EXTRACT(DAY FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
        EXTRACT(HOUR FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
        EXTRACT(MINUTE FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
        EXTRACT(SECOND FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
    ) - 32400000 AS SENT_AT`;

    const sql = `
        SELECT * FROM (
            SELECT * FROM (
                SELECT * FROM (
                    SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, ${timeExtract},
                           T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, NVL(T2.NICKNAME, 'SYSTEM') AS NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1 LEFT JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID < :targetMsgId ORDER BY T1.MSG_ID DESC
                ) WHERE ROWNUM <= :limitCnt
            ) UNION ALL
            SELECT * FROM (
                SELECT * FROM (
                    SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, ${timeExtract},
                           T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, NVL(T2.NICKNAME, 'SYSTEM') AS NICKNAME, T2.PROFILE_PIC
                    FROM T_MESSAGE T1 LEFT JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
                    WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID >= :targetMsgId ORDER BY T1.MSG_ID ASC
                ) WHERE ROWNUM <= :limitCntNext
            )
        ) ORDER BY SENT_AT ASC
    `;
    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

// 8. 특정 메시지 이후 조회
export async function getMessagesAfterId(roomId, afterMsgId, limit = 50) {
    const binds = { roomId: Number(roomId), afterMsgId: Number(afterMsgId), limit: Number(limit) };

    const timeExtract = `(
        EXTRACT(DAY FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 86400000 +
        EXTRACT(HOUR FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 3600000 +
        EXTRACT(MINUTE FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 60000 +
        EXTRACT(SECOND FROM (T1.SENT_AT - TIMESTAMP '1970-01-01 00:00:00')) * 1000
    ) - 32400000 AS SENT_AT`;

    const sql = `
        SELECT * FROM (
            SELECT T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT, ${timeExtract},
                   T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME, NVL(T2.NICKNAME, 'SYSTEM') AS NICKNAME, T2.PROFILE_PIC
            FROM T_MESSAGE T1 LEFT JOIN T_USER T2 ON T1.SENDER_ID = T2.USER_ID
            WHERE T1.ROOM_ID = :roomId AND T1.MSG_ID > :afterMsgId ORDER BY T1.MSG_ID ASC
        ) WHERE ROWNUM <= :limit
    `;
    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

// 9. 방 파일 목록 조회
export async function getRoomFiles(roomId) {
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
    const res = await executeQuery(sql, { roomId: Number(roomId) });
    return res.rows || [];
}

// 10. 메시지 ID로 메시지 조회
export async function getMessageById(msgId) {
    const sql = `SELECT MSG_ID, ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME FROM T_MESSAGE WHERE MSG_ID = :msgId`;
    const res = await executeQuery(sql, { msgId: Number(msgId) });
    return res.rows?.[0] || null;
}

// 11. 메시지 수정/삭제
export async function updateMessageTx(p) {
    return await executeTransaction(`UPDATE T_MESSAGE SET CONTENT=:content WHERE MSG_ID=:msgId AND SENDER_ID=:senderId`, p, { autoCommit: true });
}

export async function deleteMessageTx(p) {
    return await executeTransaction(`DELETE FROM T_MESSAGE WHERE MSG_ID=:msgId AND SENDER_ID=:senderId`, p, { autoCommit: true });
}