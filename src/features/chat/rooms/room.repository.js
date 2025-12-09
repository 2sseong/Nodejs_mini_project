import db, { oracledb, executeQuery, executeTransaction, getConnection } from '../../../../db/oracle.js';

/**
 * 방 생성 + 생성자 멤버 추가를 하나의 트랜잭션으로 처리하기 위해
 * 수동 커넥션을 사용합니다.
 */
export async function createRoomWithCreatorTx({ roomName, creatorId }) {
    let conn;
    try {
        conn = await getConnection();
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

        const memberSql = `
                        INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
                        VALUES (:roomId, :userId, CURRENT_TIMESTAMP)
                        `;
        await conn.execute(memberSql, { roomId, userId: creatorId }, { autoCommit: false });

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
    let conn;
    try {
        conn = await getConnection();
        const sql = `
                    INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
                    VALUES (:roomId, :userId, :joinedAt)
                    `;
        const now = new Date();
        await executeTransaction(sql, { roomId, userId, joinedAt: now }, { autoCommit: false });

        await conn.commit();
    } catch (e) {
        if (conn) { try { await conn.rollback(); } catch { } }
    } finally {
        if (conn) { try { await conn.close(); } catch { } }
    }

    return true;
}

// --- 멤버 삭제 리포지토리 함수 ---
export async function deleteMember({ roomId, userId }) {
    let conn;
    try {
        conn = await getConnection();

        // [1] 트랜잭션 수동 시작 (필수)
        // 쿼리를 여러 번 날려야 하므로 autoCommit: false로 묶어야 안전합니다.

        // ---------------------------------------------------------
        // 1. 멤버 삭제
        // ---------------------------------------------------------
        const deleteMemberSql = `
            DELETE FROM T_ROOM_MEMBER
            WHERE ROOM_ID = :roomId AND USER_ID = :userId
        `;
        const deleteResult = await conn.execute(deleteMemberSql, { roomId, userId }, { autoCommit: false });

        if (deleteResult.rowsAffected === 0) {
            // 멤버가 없거나 이미 나간 경우 등
            await conn.rollback();
            return { success: false, message: "Member not found or already left." };
        }

        // ---------------------------------------------------------
        // 2. 남은 멤버 수 확인 (같은 트랜잭션 내에서 조회)
        // ---------------------------------------------------------
        const countSql = `
            SELECT COUNT(*) AS CNT
            FROM T_ROOM_MEMBER
            WHERE ROOM_ID = :roomId
        `;
        const countResult = await conn.execute(countSql, { roomId });
        const remainingMembers = countResult.rows[0].CNT; // 혹은 rows[0][0] (설정에 따라 다름)

        let roomDeleted = false;

        // ---------------------------------------------------------
        // 3. 남은 사람이 0명이면 방 자체를 삭제
        // ---------------------------------------------------------
        if (remainingMembers === 0) {
            console.log(`[INFO] Room ${roomId} is empty. Deleting the room...`);

            //  여기서 방을 지우면, 설정해둔 ON DELETE CASCADE에 의해
            //  T_MESSAGE, USERROOMREADSTATUS 데이터도 자동으로 같이 삭제
            const deleteRoomSql = `DELETE FROM T_CHAT_ROOM WHERE ROOM_ID = :roomId`;
            await conn.execute(deleteRoomSql, { roomId }, { autoCommit: false });

            roomDeleted = true;
        }

        // [4] 최종 커밋 (모든 변경사항 반영)
        await conn.commit();

        return {
            success: true,
            roomDeleted: roomDeleted,
            remainingMembers: remainingMembers
        };

    } catch (e) {
        // 에러 발생 시 전체 롤백
        if (conn) {
            try { await conn.rollback(); } catch (rbkErr) { console.error("Rollback error:", rbkErr); }
        }
        console.error("Error in deleteMember transaction:", e);
        throw e;
    } finally {
        // 커넥션 반납
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
            CASE 
                WHEN lm.MESSAGE_TYPE = 'FILE' THEN '(파일 전송)'
                -- [Fix] CLOB 컬럼을 DBMS_LOB.SUBSTR로 감싸서 VARCHAR2로 변환
                ELSE NVL(DBMS_LOB.SUBSTR(lm.CONTENT, 1000, 1), '대화 내용이 없습니다.') 
            END AS LAST_MESSAGE,
            NVL(lm.SENT_AT, r.CREATED_AT) AS LAST_MESSAGE_AT,
            (
                SELECT COUNT(*)
                FROM T_MESSAGE msg
                WHERE msg.ROOM_ID = r.ROOM_ID
                  AND msg.SENT_AT > NVL(
                      TO_DATE('1970-01-01','YYYY-MM-DD') + (urs.LASTREADTIMESTAMP / 86400000) + (9/24), 
                      r.CREATED_AT
                  )
                  AND msg.SENDER_ID != :userId 
            ) AS UNREAD_COUNT,
            (
                SELECT COUNT(*) 
                FROM T_ROOM_MEMBER mem 
                WHERE mem.ROOM_ID = r.ROOM_ID
            ) AS MEMBER_COUNT
        FROM T_ROOM_MEMBER rm
        JOIN T_CHAT_ROOM r ON rm.ROOM_ID = r.ROOM_ID
        LEFT JOIN USERROOMREADSTATUS urs 
               ON rm.ROOM_ID = urs.ROOM_ID 
              AND rm.USER_ID = urs.USER_ID
        LEFT JOIN (
            SELECT ROOM_ID, CONTENT, SENT_AT, MESSAGE_TYPE
            FROM (
                SELECT 
                    ROOM_ID, 
                    CONTENT, 
                    SENT_AT, 
                    MESSAGE_TYPE,
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

/**
 * 두 사용자 ID로 1:1 채팅방이 존재하는지 조회
 * @param {number} myUserId - 현재 로그인 사용자 ID
 * @param {number} targetUserId - 대상 사용자 ID
 * @returns {number | null} 존재하는 경우 ROOM_ID, 없으면 null
 */
export async function findOneToOneRoomId(myUserId, targetUserId) {
    const sql = `
        SELECT tcr.ROOM_ID
        FROM T_CHAT_ROOM tcr
        WHERE tcr.ROOM_TYPE = '1_TO_1'
          -- 1. 두 사용자가 모두 참여하는 방을 찾음
          AND tcr.ROOM_ID IN (
            SELECT trm.ROOM_ID
            FROM T_ROOM_MEMBER trm
            WHERE trm.USER_ID IN (:myUserId, :targetUserId)
            GROUP BY trm.ROOM_ID
            HAVING COUNT(trm.USER_ID) = 2 -- 두 사용자 모두 포함
          )
          -- 2. 해당 방의 전체 참가자 수가 2명인지 최종 확인
          AND (
            SELECT COUNT(*) FROM T_ROOM_MEMBER WHERE ROOM_ID = tcr.ROOM_ID
          ) = 2
        FETCH FIRST 1 ROW ONLY
    `;

    const bindParams = { myUserId, targetUserId };

    const result = await executeQuery(sql, bindParams);

    return result.rows?.length > 0 ? result.rows[0].ROOM_ID : null;
}

/**
 * 새로운 1:1 채팅방을 생성하고 두 사용자를 멤버로 추가 (트랜잭션)
 * @param {number} myUserId 
 * @param {number} targetUserId 
 * @param {string} roomName 
 * @returns {{roomId: number, roomName: string}} 새로 생성된 방 정보
 */
export async function createNewOneToOneRoom(myUserId, targetUserId, roomName) {
    let conn;
    try {
        conn = await getConnection(); // 수동 커넥션 획득

        // 1. T_CHAT_ROOM에 삽입
        const roomSql = `
            INSERT INTO T_CHAT_ROOM (ROOM_NAME, ROOM_TYPE, CREATED_AT)
            VALUES (:roomName, '1_TO_1', CURRENT_TIMESTAMP)
            RETURNING ROOM_ID INTO :roomId
        `;
        const roomBinds = {
            roomName,
            // ROOM_ID를 OUT BIND 변수로 설정하여 삽입 즉시 ID를 받아옴
            roomId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        };
        const roomRes = await conn.execute(roomSql, roomBinds, { autoCommit: false });
        const roomId = roomRes.outBinds.roomId[0]; // 삽입된 ROOM_ID 추출

        // 2. T_ROOM_MEMBER에 첫 번째 사용자(나) 추가
        const memberSql = `
            INSERT INTO T_ROOM_MEMBER (ROOM_ID, USER_ID, JOINED_AT)
            VALUES (:roomId, :userId, CURRENT_TIMESTAMP)
        `;
        await conn.execute(memberSql, { roomId, userId: myUserId }, { autoCommit: false });

        // 3. T_ROOM_MEMBER에 두 번째 사용자(상대방) 추가
        await conn.execute(memberSql, { roomId, userId: targetUserId }, { autoCommit: false });

        await conn.commit(); // 트랜잭션 커밋

        return { roomId, roomName };

    } catch (e) {
        if (conn) { try { await conn.rollback(); } catch (rbkErr) { console.error("Rollback error:", rbkErr); } }
        console.error("Error in createNewOneToOneRoom transaction:", e);
        throw e;
    } finally {
        if (conn) { try { await conn.close(); } catch (clsErr) { console.error("Close error:", clsErr); } }
    }
}

