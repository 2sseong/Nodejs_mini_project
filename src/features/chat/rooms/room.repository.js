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