import db, { oracledb, executeQuery, executeTransaction, getConnection } from '../../../../db/oracle.js';

// getHistory 함수 (정렬 기준 강화 유지)
export async function getHistory({ roomId, limit = 50, beforeMsgId = null }) {
    const binds = {
        roomId: roomId,
        limit: Number(limit)
    };

    let innerSql = `
                    SELECT 
                        T1.MSG_ID, T1.ROOM_ID, T1.SENDER_ID, T1.CONTENT,
                        T1.SENT_AT, T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                        T2.NICKNAME
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
    const now = new Date(); // [중요] Node.js의 정확한 현재 시간 (UTC)

    let connection;
    try {
        connection = await db.getConnection(); 

        const sql = `
                    INSERT INTO T_MESSAGE(
                        ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
                    ) VALUES (
                        :roomId, :senderId, :content, :messageType, :fileUrl, :fileName, :sentAt)
                    RETURNING
                        MSG_ID, ROOM_ID, SENDER_ID, CONTENT, MESSAGE_TYPE, FILE_URL, FILE_NAME, SENT_AT
                    INTO
                        :outId, :outRoomId, :outSenderId, :outContent, :outMsgType, :outFileUrl, :outFileName, :outSentAt
                    `;

        const binds = {
            roomId: roomId,
            senderId: senderId,
            content: content,
            messageType: messageType,
            fileUrl: fileUrl,
            fileName: fileName,
            sentAt: now,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outRoomId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            outSenderId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
            outContent: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }, 
            outMsgType: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 },
            outFileUrl: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
            outFileName: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 1000 },
            outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
        };

        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 1 && result.outBinds) {
            const savedRow = {
                MSG_ID: result.outBinds.outId[0],
                ROOM_ID: String(result.outBinds.outRoomId[0]), 
                SENDER_ID: result.outBinds.outSenderId[0],
                CONTENT: result.outBinds.outContent[0],
                MESSAGE_TYPE: result.outBinds.outMsgType[0],
                FILE_URL: result.outBinds.outFileUrl[0],
                FILE_NAME: result.outBinds.outFileName[0],
                // [핵심 수정 1] DB가 반환한 값(outSentAt)은 드라이버가 타임존을 왜곡할 수 있으므로,
                // 우리가 넣은 정확한 'now' 객체를 그대로 사용합니다. -> '+1 에러' 해결
                SENT_AT: now, 
            };
            return savedRow; 
        } else {
            throw new Error("메시지 저장 실패 (DB)");
        }

    } catch (err) {
        console.error("DB 에러 (saveMessageTx):", err);
        throw err; 
    } finally {
        if (connection) {
            await connection.close(); 
        }
    }
}

export async function countReadStatusByMessageIds(roomId, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];

    const bindVars = {};
    messageIds.forEach((id, index) => {
        bindVars[`id${index}`] = id;
    });
    const inClause = messageIds.map((_, index) => `:id${index}`).join(', ');

    // [핵심 수정 2] SYS_EXTRACT_UTC 제거하고 단순 날짜 차이(DATE - DATE)로 복귀.
    // CAST(m.SENT_AT AS DATE)는 DB에 저장된 시간(UTC components)을 그대로 가져옵니다.
    // -> '읽지 않은 인원도 읽음 처리' 해결
    const sql = `
        SELECT 
            m.MSG_ID,
            COUNT(DISTINCT r.USER_ID) AS "readCount"
        FROM T_MESSAGE m
        LEFT JOIN UserRoomReadStatus r 
            ON TO_CHAR(m.ROOM_ID) = r.ROOM_ID
            AND r.lastReadTimestamp >= (
                (CAST(m.SENT_AT AS DATE) - TO_DATE('1970-01-01','YYYY-MM-DD')) * 86400000
            )
        WHERE m.ROOM_ID = :roomId
          AND m.MSG_ID IN (${inClause})
        GROUP BY m.MSG_ID
    `;

    bindVars.roomId = roomId;

    const result = await executeQuery(sql, bindVars);
    return result.rows || []; 
}

// 3. 읽음 상태 저장/업데이트
export async function upsertReadStatus(userId, roomId, lastReadTimestamp) {
    const sql = `
        MERGE INTO USERROOMREADSTATUS t
        USING (SELECT :userId AS U_ID, :roomId AS R_ID FROM DUAL) s
        ON (t.USER_ID = s.U_ID AND t.ROOM_ID = s.R_ID)
        WHEN MATCHED THEN
            UPDATE SET t.lastReadTimestamp = :ts
            WHERE t.lastReadTimestamp < :ts
        WHEN NOT MATCHED THEN
            INSERT (USER_ID, ROOM_ID, lastReadTimestamp)
            VALUES (:userId, :roomId, :ts)
    `;

    const result = await executeTransaction(sql, { 
        userId, 
        roomId, 
        ts: lastReadTimestamp 
    }, { autoCommit: true });

    return result.rowsAffected;
}

// 방 멤버들의 읽음 상태 조회
export async function getRoomReadStatus(roomId) {
    const sql = `
        SELECT USER_ID, LASTREADTIMESTAMP
        FROM UserRoomReadStatus
        WHERE ROOM_ID = :roomId
    `;
    const result = await executeQuery(sql, { roomId });
    return result.rows || [];
}

// 메시지 수정
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

// 메시지 삭제
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

// 1. 대화 내용 검색
export async function searchMessages(roomId, keyword) {
    const sql = `
        SELECT MSG_ID, CONTENT, SENT_AT
        FROM T_MESSAGE
        WHERE ROOM_ID = :roomId
          AND (CONTENT LIKE :keyword OR FILE_NAME LIKE :keyword)
        ORDER BY SENT_AT ASC
    `;
    
    const searchPattern = `%${keyword}%`;
    
    const result = await executeQuery(sql, { 
        roomId, 
        keyword: searchPattern 
    });
    
    return result.rows || [];
}

// 2. 특정 메시지 기준 앞뒤 문맥 조회
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
                        T1.SENT_AT, T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                        T2.NICKNAME
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
                        T1.SENT_AT, T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                        T2.NICKNAME
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

// 3. 특정 메시지 이후의 데이터 조회
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
                T1.SENT_AT, T1.MESSAGE_TYPE, T1.FILE_URL, T1.FILE_NAME,
                T2.NICKNAME
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