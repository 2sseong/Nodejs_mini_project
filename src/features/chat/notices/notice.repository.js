import { executeQuery, getConnection } from '../../../../db/oracle.js';

// 공지 생성 (기존 활성 공지는 비활성화)
export async function createNotice(roomId, msgId, content, createdBy) {
    const connection = await getConnection();
    try {
        // 기존 활성 공지 비활성화
        await connection.execute(
            `UPDATE T_ROOM_NOTICE SET IS_ACTIVE = 0 WHERE ROOM_ID = :roomId AND IS_ACTIVE = 1`,
            { roomId: Number(roomId) }
        );

        // 새 공지 생성
        const sql = `
            INSERT INTO T_ROOM_NOTICE (NOTICE_ID, ROOM_ID, MSG_ID, CONTENT, CREATED_BY, IS_ACTIVE)
            VALUES (SEQ_ROOM_NOTICE.NEXTVAL, :roomId, :msgId, :content, :createdBy, 1)
        `;
        await connection.execute(sql, {
            roomId: Number(roomId),
            msgId: msgId ? Number(msgId) : null,
            content,
            createdBy
        }, { autoCommit: true });

        return true;
    } catch (err) {
        console.error('[NoticeRepo] createNotice error:', err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}

// 활성 공지 조회
export async function getActiveNotice(roomId) {
    const sql = `
        SELECT n.NOTICE_ID, n.ROOM_ID, n.MSG_ID, n.CONTENT, n.CREATED_BY, 
               n.CREATED_AT, u.NICKNAME AS CREATED_BY_NICKNAME
        FROM T_ROOM_NOTICE n
        LEFT JOIN T_USER u ON n.CREATED_BY = u.USER_ID
        WHERE n.ROOM_ID = :roomId AND n.IS_ACTIVE = 1
        ORDER BY n.CREATED_AT DESC
        FETCH FIRST 1 ROW ONLY
    `;
    const res = await executeQuery(sql, { roomId: Number(roomId) });
    return res.rows?.[0] || null;
}

// 공지 비활성화
export async function deactivateNotice(roomId) {
    const sql = `UPDATE T_ROOM_NOTICE SET IS_ACTIVE = 0 WHERE ROOM_ID = :roomId AND IS_ACTIVE = 1`;
    await executeQuery(sql, { roomId: Number(roomId) });
    return true;
}

// 전체 공지 목록 조회 (활성/비활성 모두)
export async function getAllNotices(roomId) {
    const sql = `
        SELECT n.NOTICE_ID, n.ROOM_ID, n.MSG_ID, n.CONTENT, n.CREATED_BY, 
               n.CREATED_AT, n.IS_ACTIVE, u.NICKNAME AS CREATED_BY_NICKNAME
        FROM T_ROOM_NOTICE n
        LEFT JOIN T_USER u ON n.CREATED_BY = u.USER_ID
        WHERE n.ROOM_ID = :roomId
        ORDER BY n.CREATED_AT DESC
    `;
    const res = await executeQuery(sql, { roomId: Number(roomId) });
    return res.rows || [];
}

// 개별 공지 삭제
export async function deleteNotice(noticeId) {
    const connection = await getConnection();
    try {
        const sql = `DELETE FROM T_ROOM_NOTICE WHERE NOTICE_ID = :noticeId`;
        await connection.execute(sql, { noticeId: Number(noticeId) }, { autoCommit: true });
        return true;
    } catch (err) {
        console.error('[NoticeRepo] deleteNotice error:', err);
        throw err;
    } finally {
        if (connection) await connection.close();
    }
}
