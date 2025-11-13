import { executeQuery } from '../../../db/oracle.js';

export async function searchUsersByPrefix(q, limit = 10) {
    const sql = `
    SELECT USER_ID, USERNAME, NICKNAME
    FROM T_USER
    WHERE (USERNAME LIKE :1
    OR NICKNAME LIKE :2)
    AND ROWNUM <= :3
  `;
    const res = await executeQuery(sql, [`${q}%`, `${q}%`, limit]);
    return res.rows || [];
}

// 전체 유저 목록 조회
export async function findAllUsers() {
    // 필터(WHERE) 조건 없이 모든 유저를 가져오는 쿼리
    const sql = `
        SELECT USER_ID, USERNAME, NICKNAME
        FROM T_USER
        ORDER BY USERNAME
    `;

    try {
        const result = await executeQuery(sql);
        // DB 결과는 result.rows에 객체 배열로 들어감
        return result.rows; 
    } catch (error) {
        console.error('Error fetching all users from DB:', error);
        throw error;
    }
}