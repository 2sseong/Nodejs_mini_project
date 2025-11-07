import { executeQuery } from '../../../db/oracle.js';

export async function searchUsersByPrefix(q, limit = 10) {
    const sql = `
    SELECT USER_ID, USERNAME, NICKNAME
    FROM T_USER
    WHERE USERNAME LIKE :1
    AND ROWNUM <= :2
  `;
    const res = await executeQuery(sql, [`${q}%`, limit]);
    return res.rows || [];
}