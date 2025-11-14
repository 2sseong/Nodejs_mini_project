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

// getHistory 수정안
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
 * 일반 메시지 또는 파일 메시지를 T_MESSAGE 테이블에 저장합니다.
 * @param {object} params
 * @param {string} params.roomId
 * @param {string} params.senderId
 * @param {string} params.content - 텍스트 메시지의 본문 (CLOB)
 * @param {string} [params.messageType='TEXT'] - 'TEXT' 또는 'FILE'
 * @param {string} [params.fileUrl=null] - 파일 메시지의 URL
 * @param {string} [params.fileName=null] - 파일 메시지의 원본 이름
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

    // CLOB은 파일 메시지일 경우 NULL이 되어야 하므로, 조건부로 바인딩합니다.
    const contentVal = (messageType === 'FILE') ? null : content;

    const binds = {
        roomId: Number(roomId),
        senderId,
        content: contentVal ? { val: contentVal, type: oracledb.CLOB } : null, // FILE 타입일 때 NULL 바인딩
        messageType,
        fileUrl: fileUrl,
        fileName: fileName,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        outSentAt: { dir: oracledb.BIND_OUT, type: oracledb.DATE },
    };

    // NOTE: executeTransaction이 autoCommit: false를 가정하고 트랜잭션을 실행한다고 가정합니다.
    const res = await executeTransaction(sql, binds, { autoCommit: false });

    const msgId = res.outBinds.outId[0];
    // Oracle DATE 객체를 JavaScript timestamp (ms)로 변환
    const sentAt = res.outBinds.outSentAt[0]?.getTime?.() ?? Date.now();

    // 저장된 모든 정보를 반환하여 Service Layer에서 브로드캐스트에 사용
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

        // 3. 쿼리 실행 (autoCommit: false)
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
