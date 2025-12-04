import db, { oracledb, executeQuery, executeTransaction, getConnection as getDBConnection } from '../../../../db/oracle.js';

// getHistory 함수
export async function getHistory({ roomId, limit = 50, beforeMsgId = null }) {
    const binds = {
        roomId: roomId,
        limit: Number(limit)
    };

    let innerSql = `
        SELECT 
            T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
            T1.SENT_AT, -- [수정] 복잡한 연산 제거 (자동 변환 사용)
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

    let connection;
    try {
        connection = await getDBConnection();

        const sql = `
            INSERT INTO T_MESSAGE(
                ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
            ) VALUES (
                :roomId, :senderId, :content, :messageType, :fileUrl, :fileName, SYSDATE
            )
            RETURNING 
                MSG_ID, ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
            INTO 
                :outId, :outRoomId, :outSenderId, :outContent, :outMsgType, :outFileUrl, :outFileName, :outSentAt
        `;

        const binds = {
            roomId, senderId, content, messageType, fileUrl, fileName,
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
            return {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]),
                SENDER_ID: result.outBinds.outSenderId[0],
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                FILE_URL: result.outBinds.outFileUrl[0],
                FILE_NAME: result.outBinds.outFileName[0],
                SENT_AT: result.outBinds.outSentAt[0]
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

    /**
     * [최적화 변경 사항]
     * 1. 나간 멤버 제외: T_ROOM_MEMBER(방 멤버 테이블)와 JOIN하여 현재 멤버인 경우만 카운트합니다.
     * (나간 사람은 membersInRoom(모수)에서도 빠지고, 여기서 readCount에서도 빠지므로 정합성이 유지됩니다.)
     * * 2. 성능 최적화: EXTRACT 연산을 제거하고 단순 날짜 비교로 변경하여 DB 인덱스를 사용할 수 있게 했습니다.
     * (오라클의 날짜 산술 연산을 사용하여 성능을 O(N) -> O(log N)으로 개선)
     * * ※ 주의: 'T_ROOM_MEMBER'는 실제 방 멤버 정보를 담고 있는 테이블명으로 변경해주세요.
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
        let timestampToUse = lastReadTimestamp;

        if (!timestampToUse) timestampToUse = Date.now();

        const sql = `
            MERGE INTO USERROOMREADSTATUS target
            USING (SELECT :userId AS U_ID, :roomId AS R_ID, :ts AS TS FROM DUAL) source
            ON (target.USER_ID = source.U_ID AND target.ROOM_ID = source.R_ID)
            WHEN MATCHED THEN
                UPDATE SET target.LASTREADTIMESTAMP = GREATEST(NVL(target.LASTREADTIMESTAMP, 0), source.TS)
            WHEN NOT MATCHED THEN
                INSERT (USER_ID, ROOM_ID, LASTREADTIMESTAMP)
                VALUES (source.U_ID, source.R_ID, source.TS)
        `;

        const result = await connection.execute(sql, {
            userId, roomId, ts: timestampToUse
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
        SELECT m.MSG_ID, m.CONTENT, m.SENT_AT, u.NICKNAME, u.PROFILE_PIC
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
                        T1.SENT_AT,
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
                        T1.SENT_AT,
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
                T1.SENT_AT,
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
            MSG_ID, SENDER_ID, SENT_AT, FILE_URL, FILE_NAME, MESSAGE_TYPE
        FROM T_MESSAGE
        WHERE ROOM_ID = :roomId
          AND MESSAGE_TYPE = 'FILE'
        ORDER BY SENT_AT DESC
    `;
    // 최신순 정렬
    const res = await executeQuery(sql, { roomId });
    return res.rows || [];
}