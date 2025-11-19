// src/features/auth/authRepository.js

import { executeTransaction, executeQuery } from '../../../db/oracle.js'; 

/**
 * 이메일로 사용자를 찾는 함수
 */
async function findUserByEmail(email) {
    const sql = `
        SELECT 
            USER_ID, USERNAME, PASSWORD_HASH, NICKNAME 
        FROM 
            T_USER 
        WHERE 
            USERNAME = :email
    `;
    const result = await executeQuery(sql, { email: email });
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 새로운 사용자 정보를 DB에 삽입하는 함수
 */
async function insertUser(userData) {
    const insertSql = `
        INSERT INTO T_USER 
            (USER_ID, USERNAME, PASSWORD_HASH, NICKNAME, CREATED_AT)
        VALUES 
            (:userId, :email, :hash, :nickname, CURRENT_TIMESTAMP)
    `;
    await executeTransaction(insertSql, { 
        userId: userData.userId, 
        email: userData.email, 
        hash: userData.hashedPassword, 
        nickname: userData.nickname 
    });
}

export {
    findUserByEmail,
    insertUser,
};

/**
 * 사용자 최종 로그인 시간을 업데이트하는 함수
 */
export async function updateLastLogin(userId) {
    const updateSql = `
        UPDATE T_USER
        SET LAST_LOGIN = CURRENT_TIMESTAMP
        WHERE USER_ID = :userId
    `;
    // INSERT/UPDATE/DELETE는 executeTransaction을 사용
    await executeTransaction(updateSql, { userId: userId });
}