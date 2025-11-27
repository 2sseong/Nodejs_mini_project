import db, { oracledb, executeQuery, executeTransaction, getConnection } from '../../../../db/oracle.js';

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

        await conn.commit(); // 4. 명시적 커밋 실행

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

export async function listRoomsByUser({ userId }) {
    const sql = `
        SELECT 
            r.ROOM_ID,
            r.ROOM_NAME,
            r.ROOM_TYPE,
            NVL(lm.CONTENT, '대화 내용이 없습니다.') AS LAST_MESSAGE,
            NVL(lm.SENT_AT, r.CREATED_AT) AS LAST_MESSAGE_AT,
            (
                SELECT COUNT(*)
                FROM T_MESSAGE msg
                WHERE msg.ROOM_ID = r.ROOM_ID
                  -- [핵심 수정] NUMBER(밀리초) -> DATE 변환 후 비교
                  AND msg.SENT_AT > NVL(
                      TO_DATE('1970-01-01','YYYY-MM-DD') + (urs.LASTREADTIMESTAMP / 86400000), 
                      r.CREATED_AT
                  )
                  AND msg.SENDER_ID != :userId 
            ) AS UNREAD_COUNT
        FROM T_ROOM_MEMBER rm
        JOIN T_CHAT_ROOM r ON rm.ROOM_ID = r.ROOM_ID
        LEFT JOIN USERROOMREADSTATUS urs 
               ON rm.ROOM_ID = urs.ROOM_ID 
              AND rm.USER_ID = urs.USER_ID
        LEFT JOIN (
            SELECT ROOM_ID, CONTENT, SENT_AT
            FROM (
                SELECT 
                    ROOM_ID, 
                    CONTENT, 
                    SENT_AT,
                    ROW_NUMBER() OVER(PARTITION BY ROOM_ID ORDER BY SENT_AT DESC) as rn
                FROM T_MESSAGE
            )
            WHERE rn = 1
        ) lm ON r.ROOM_ID = lm.ROOM_ID
        WHERE rm.USER_ID = :userId
        ORDER BY LAST_MESSAGE_AT DESC
    `;
    
    const res = await executeQuery(sql, { userId });
    return res.rows || [];
}

/**
 * [수정됨] 방 입장 시 '마지막 읽은 시간' 업데이트
 * - 컬럼 타입(NUMBER)에 맞춰 현재 시간을 밀리초(Epoch)로 변환하여 저장
 */
export async function updateLastReadAt({ roomId, userId }) {
    const sql = `
        MERGE INTO USERROOMREADSTATUS t
        USING (
            SELECT 
                :userId AS U_ID, 
                :roomId AS R_ID, 
                -- [핵심 수정] UTC 변환 없이 현재 DB 세션 시간(CURRENT_TIMESTAMP) 사용
                (CAST(CURRENT_TIMESTAMP AS DATE) - TO_DATE('1970-01-01','YYYY-MM-DD')) * 86400000 AS NOW 
            FROM DUAL
        ) s
        ON (t.USER_ID = s.U_ID AND t.ROOM_ID = s.R_ID)
        WHEN MATCHED THEN
            UPDATE SET t.LASTREADTIMESTAMP = s.NOW
        WHEN NOT MATCHED THEN
            INSERT (USER_ID, ROOM_ID, LASTREADTIMESTAMP)
            VALUES (s.U_ID, s.R_ID, s.NOW)
    `;
    
    await executeTransaction(sql, { roomId, userId });
}