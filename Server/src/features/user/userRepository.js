import { getConnection, oracledb } from '../../../db/oracle.js';

// 즐겨찾기 ⭐
// 즐겨찾기 추가
export const addPick = async (userId, targetUserId) => {
    const sql = `
    INSERT INTO USER_PICK (USER_ID, TARGET_USER_ID)
    VALUES (:userId, :targetUserId)
    `;

    const binds = { userId: userId, targetUserId: targetUserId };

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds);

        // 명시적 커밋
        await connection.commit();

        return result.rowsAffected === 1;
    } catch (error) {
        // 에러 발생 시 롤백
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbError) {
                console.error("Rollback failed:", rbError);
            }
        }
        console.error("Repository Error: 즐겨찾기 추가 DB 실패", error);
        throw new Error("즐겨찾기 추가 DB 삽입 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
}

// 즐겨찾기 삭제
export const removePick = async (userId, targetUserId) => {
    const sql = `
    DELETE FROM USER_PICK
    WHERE USER_ID = :userId AND TARGET_USER_ID = :targetUserId
    `;

    const binds = { userId: userId, targetUserId: targetUserId };

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds);

        // 명시적 커밋
        await connection.commit();

        return result.rowsAffected === 1;
    } catch (error) {
        // 에러 발생 시 롤백
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbError) {
                console.error("Rollback failed:", rbError);
            }
        }
        console.error("Repository Error: 즐겨찾기 삭제 DB 실패", error);
        throw new Error("즐겨찾기 삭제 DB 삭제 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
}

// 즐겨찾기 조회
export const getUserPick = async (userId) => {
    const sql = `
    SELECT TARGET_USER_ID
    FROM USER_PICK
    WHERE USER_ID = :userId
    `;

    const binds = { userId: userId };

    let connection;

    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds);
        return result.rows;
    } catch (error) {
        console.error("Repository Error: 즐겨찾기 조회 DB 실패", error);
        throw new Error("즐겨찾기 조회 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
}

/**
 * 사용자 ID로 사용자 정보 조회 (본인 프로필)
 * @param {string} userId - 조회할 사용자 ID
 * @returns {Promise<Object>} - 사용자 정보 (USER_ID, USERNAME, NICKNAME, PROFILE_PIC)
 */
export const getUserById = async (userId) => {
    const sql = `
    SELECT
        U.USER_ID,
        U.USERNAME,
        U.NICKNAME,
        U.PROFILE_PIC
    FROM T_USER U
    WHERE U.USER_ID = :userId
    `;

    const binds = { userId: userId };

    let connection;

    try {
        connection = await getConnection();
        const options = {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        };

        const result = await connection.execute(sql, binds, options);

        // 결과가 있으면 첫 번째 행 반환, 없으면 null 반환
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error("Repository Error: 사용자 정보 조회 DB 실패:", error);
        throw new Error("사용자 정보 조회 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
}


/**
 * !!! 사용자 검색 및 사용자 상태 조회 (GET /users/search)
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @returns {Promise<Array>} - 검색된 사용자 목록 및 상태
 */
export const searchUsersByQuery = async (userId, query) => {

    const sql = `
SELECT
    U.USER_ID,
    U.USERNAME,
    U.NICKNAME,
    D.DEPT_NAME,
    P.POS_NAME,
    U.PROFILE_PIC,
    CASE
        WHEN UP.USER_ID IS NOT NULL THEN 1 -- 즐겨찾기 됨
        ELSE 0                           -- 즐겨찾기 안 됨
    END AS isPick
FROM T_USER U
JOIN DEPARTMENT D ON U.DEPT_ID = D.DEPT_ID
JOIN POSITION P ON U.POS_ID = P.POS_ID
-- 즐겨찾기 여부 확인
LEFT JOIN USER_PICK UP ON
    (UP.USER_ID = :userId AND UP.TARGET_USER_ID = U.USER_ID)
WHERE
    -- 사용자 ID, 이름, 닉네임으로 검색
    (U.USER_ID LIKE '%' || :query || '%' 
    OR U.USERNAME LIKE '%' || :query || '%'
    OR U.NICKNAME LIKE '%' || :query || '%')
`;

    const binds = { userId: userId, query: query };

    let connection;

    try {
        connection = await getConnection();
        // DB 드라이버에게 결과를 SQL에서 정의한 별칭을 키로 사용하는 객체 배열로 반환하라고 지시
        const options = {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        };

        // options 객체를 execute 함수의 세 번째 인자로 전달
        const result = await connection.execute(sql, binds, options);

        // 디버깅 코드
        // console.log("DB 응답 결과:", result.rows);

        return result.rows;
    } catch (error) {
        console.error("Repository Error: 사용자 검색 DB 조회 실패:", error);
        throw new Error("사용자 검색 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close()
    }
};

/**
 * 사용자의 전체 알림 설정 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} - 알림 활성화 여부 (기본값: true)
 */
export const getNotificationEnabled = async (userId) => {
    const sql = `
        SELECT NOTIFICATION_ENABLED 
        FROM T_USER 
        WHERE USER_ID = :userId
    `;

    let connection;
    try {
        connection = await getConnection();
        const options = { outFormat: oracledb.OUT_FORMAT_OBJECT };
        const result = await connection.execute(sql, { userId }, options);

        if (result.rows && result.rows.length > 0) {
            return result.rows[0].NOTIFICATION_ENABLED === 1;
        }
        return true; // 기본값: 켜짐
    } catch (error) {
        console.error("Repository Error: 알림 설정 조회 실패:", error);
        throw error;
    } finally {
        if (connection) await connection.close();
    }
};

/**
 * 사용자의 전체 알림 설정 변경
 * @param {string} userId - 사용자 ID
 * @param {boolean} enabled - 알림 활성화 여부
 * @returns {Promise<boolean>} - 성공 여부
 */
export const setNotificationEnabled = async (userId, enabled) => {
    const sql = `
        UPDATE T_USER 
        SET NOTIFICATION_ENABLED = :enabled 
        WHERE USER_ID = :userId
    `;

    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, {
            userId,
            enabled: enabled ? 1 : 0
        });
        await connection.commit();
        return result.rowsAffected > 0;
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { console.error("Rollback error:", e); }
        }
        console.error("Repository Error: 알림 설정 변경 실패:", error);
        throw error;
    } finally {
        if (connection) await connection.close();
    }
};