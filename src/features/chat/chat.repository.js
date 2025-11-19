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

// [!!!] listRoomsByUser 함수 수정 (특수 공백 문자 모두 제거) [!!!]
export async function listRoomsByUser({ userId }) {
    // [!!!] 수정: 'SELECT' 앞/뒤의 모든 특수 공백(혻) 제거 [!!!]
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

// getHistory 함수 수정 
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
                ORDER BY SENT_AT ASC
                `;
    
    const res = await executeQuery(sql, binds);
    return res.rows || [];
}

/**
 * 일반 메시지 또는 파일 메시지를 T_MESSAGE 테이블에 저장합니다.
*/
export async function saveMessageTx(data) {

    const { roomId, senderId, content, messageType, fileUrl, fileName } = data; 
    const now = new Date();

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
            outSenderId: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outContent: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outMsgType: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileUrl: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
            outFileName: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
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
                SENT_AT: result.outBinds.outSentAt[0],
            };
            return savedRow; // [!!!] 완전한 객체를 리턴
        } else {
            throw new Error("메시지 저장 실패 (DB)");
        }

    } catch (err) {
        console.error("DB 에러 (saveMessageTx):", err);
        throw err; // 에러를 상위로 전파
    } finally {
        if (connection) {
            await connection.close(); // 또는 connection.release()
        }
    }
}


// --- 멤버 삭제 리포지토리 함수 ---
export async function deleteMember({ roomId, userId }) {
    let conn; // 1. conn 변수 선언 (ReferenceError 해결)
    try {
        conn = await getConnection(); // 2. 커넥션 획득

        const sql = `
            DELETE FROM T_ROOM_MEMBER
            WHERE ROOM_ID = :roomId AND USER_ID = :userId
        `;
        const binds = {
            roomId: Number(roomId),
            userId: userId
        };

        const result = await conn.execute(sql, binds, { autoCommit: false });

        await conn.commit(); // 4. 명시적 커밋 실행 (여기서 에러 발생 지점)

        const rowsAffected = result.rowsAffected;
        console.log(`[DB DELETE RESULT] rowsAffected: ${rowsAffected}`);

        return rowsAffected;

    } catch (e) {
        // 5. 에러 시 롤백
        if (conn) {
            console.error("Delete transaction failed, rolling back.");
            try { await conn.rollback(); } catch (rbkErr) { console.error("Rollback error:", rbkErr); }
        }
        throw e; // 서비스 레이어로 에러 던지기
    } finally {
        // 6. 커넥션 닫기
        if (conn) {
            try { await conn.close(); } catch (clsErr) { console.error("Close error:", clsErr); }
        }
    }
    
}

// [수정됨] 1. 방 멤버 수 조회 (executeQuery 사용)
export async function countRoomMembers(roomId) {
    // [주의] 테이블명 T_ROOM_MEMBER 인지 확인하세요.
    const sql = `
        SELECT COUNT(*) AS "cnt"
        FROM T_ROOM_MEMBER 
        WHERE ROOM_ID = :roomId
    `;
    
    // db.execute -> executeQuery 로 변경
    const result = await executeQuery(sql, { roomId });
    return result.rows[0]?.cnt || result.rows[0]?.CNT || 0;
}

export async function countReadStatusByMessageIds(roomId, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];

    const bindVars = {};
    messageIds.forEach((id, index) => {
        bindVars[`id${index}`] = id;
    });
    const inClause = messageIds.map((_, index) => `:id${index}`).join(', ');

    // [!!!] 핵심 수정: SYS_EXTRACT_UTC를 사용하여 타임존 오차 제거 [!!!]
    // 이 부분이 적용되어야 '이미 읽은 메시지'가 0으로 정확히 로드됩니다.
    const sql = `
        SELECT 
            m.MSG_ID,
            COUNT(DISTINCT r.USER_ID) AS "readCount"
        FROM T_MESSAGE m
        LEFT JOIN UserRoomReadStatus r 
            ON TO_CHAR(m.ROOM_ID) = r.ROOM_ID
            AND r.lastReadTimestamp >= (
                (CAST(SYS_EXTRACT_UTC(FROM_TZ(CAST(m.SENT_AT AS TIMESTAMP), SESSIONTIMEZONE)) AS DATE) - TO_DATE('1970-01-01','YYYY-MM-DD')) * 86400000
            )
        WHERE m.ROOM_ID = :roomId
          AND m.MSG_ID IN (${inClause})
        GROUP BY m.MSG_ID
    `;

    bindVars.roomId = roomId;

    const result = await executeQuery(sql, bindVars);
    return result.rows || []; 
}

// [수정됨] 3. 읽음 상태 저장/업데이트 (executeTransaction 사용)
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

// [추가] 방 멤버들의 읽음 상태 조회
export async function getRoomReadStatus(roomId) {
    const sql = `
        SELECT USER_ID, LASTREADTIMESTAMP
        FROM UserRoomReadStatus
        WHERE ROOM_ID = :roomId
    `;
    const result = await executeQuery(sql, { roomId });
    return result.rows || [];
}