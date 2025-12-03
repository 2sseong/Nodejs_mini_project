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
 * (주의: userData.department, userData.position에는 이제 ID값이 들어와야 함)
 */
async function insertUser(userData) {
    const insertSql = `
        INSERT INTO T_USER 
            (USER_ID, USERNAME, PASSWORD_HASH, NICKNAME, CREATED_AT, DEPT_ID, POS_ID)
        VALUES 
            (:userId, :email, :hash, :nickname, CURRENT_TIMESTAMP, :department, :position)
    `;
    await executeTransaction(insertSql, {
        userId: userData.userId,
        email: userData.email,
        hash: userData.hashedPassword,
        nickname: userData.nickname,
        department: userData.department, // DEPT_ID 값
        position: userData.position      // POS_ID 값
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
    await executeTransaction(updateSql, { userId: userId });
}


// ------------------- MyInfoPage 관련 추가 기능 ---------------------------------

/**
 * ID로 사용자 정보 조회 (비밀번호 제외)
 */
export async function findUserById(userId) {
    const sql = `
        SELECT 
            U.USER_ID, 
            U.USERNAME, 
            U.NICKNAME, 
            U.PROFILE_PIC, 
            U.CREATED_AT, 
            D.DEPT_NAME AS DEPARTMENT, 
            P.POS_NAME AS POSITION
        FROM T_USER U
        LEFT JOIN DEPARTMENT D ON U.DEPT_ID = D.DEPT_ID
        LEFT JOIN POSITION P ON U.POS_ID = P.POS_ID
        WHERE U.USER_ID = :userId
    `;
    const result = await executeQuery(sql, { userId });
    return result.rows.length > 0 ? result.rows[0] : null;
}

// 비밀번호 해시 조회 (본인 확인용)
export async function findPasswordHashById(userId) {
    const sql = `SELECT PASSWORD_HASH FROM T_USER WHERE USER_ID = :userId`;
    const result = await executeQuery(sql, { userId });
    return result.rows.length > 0 ? result.rows[0].PASSWORD_HASH : null;
}

// 프로필 사진 업데이트
export async function updateProfilePic(userId, filePath) {
    const sql = `UPDATE T_USER SET PROFILE_PIC = :filePath WHERE USER_ID = :userId`;
    await executeTransaction(sql, { filePath, userId });
}

/**
 * 사용자 정보(닉네임, 부서, 직급) 수정
 */
export async function updateUserInfo(userId, { nickname, department, position }) {
    const sql = `
        UPDATE T_USER 
        SET NICKNAME = :nickname,
            DEPT_ID = :department,
            POS_ID = :position
        WHERE USER_ID = :userId
    `;
    // department와 position 파라미터에는 프론트엔드에서 보낸 ID값이 들어있어야 합니다.
    await executeTransaction(sql, { nickname, department, position, userId });
}

// 비밀번호 변경 함수
export async function updateUserPassword(userId, passwordHash) {
    const sql = `UPDATE T_USER SET PASSWORD_HASH = :passwordHash WHERE USER_ID = :userId`;
    await executeTransaction(sql, { passwordHash, userId });
}


/**
 * 팀별(부서별)로 사용자 목록 조회
 */
export async function getUsersByTeam() {
    const sql = `
        SELECT 
            U.USER_ID,
            U.USERNAME,
            U.NICKNAME,
            U.PROFILE_PIC,
            D.DEPT_NAME AS DEPARTMENT,
            P.POS_NAME AS POSITION
        FROM T_USER U
        LEFT JOIN DEPARTMENT D ON U.DEPT_ID = D.DEPT_ID
        LEFT JOIN POSITION P ON U.POS_ID = P.POS_ID
        WHERE U.DEPT_ID IS NOT NULL
        ORDER BY D.DEPT_NAME ASC, U.NICKNAME ASC
    `;
    const result = await executeQuery(sql);
    return result.rows || [];
}