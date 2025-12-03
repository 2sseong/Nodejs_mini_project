import { getConnection, oracledb } from '../../../db/oracle.js';
export const findFriendList = async (userId) => {

    // !!! 친구목록조회
    // T_USER 테이블과 JOIN하여 친구 이름을 가져옴
    const sql = `
        SELECT 
            -- 친구의 ID를 결정 (두 ID 중 현재 사용자가 아닌 쪽)
            CASE
                WHEN F.USER_ID = :userId THEN F.FRIEND_USER_ID
                ELSE F.USER_ID
            END AS FRIEND_USER_ID,
            -- T_USER 테이블(U)에서 친구의 이름(USERNAME)을 가져옴
            U.USERNAME AS FRIEND_NAME 
        FROM T_FRIEND F
        -- T_USER 테이블(U)과 조인. U.USER_ID는 T_USER 테이블의 PK
        JOIN T_USER U ON U.USER_ID = 
            CASE
                WHEN F.USER_ID = :userId THEN F.FRIEND_USER_ID
                ELSE F.USER_ID
            END
        -- 현재 사용자가 포함되어 있고, 상태가 'ACCEPTED'인 친구 관계만 조회
        WHERE (F.USER_ID = :userId OR F.FRIEND_USER_ID = :userId) 
          AND F.STATUS = 'ACCEPTED'
    `;
    const binds = { userId: userId };

    let connection; // DB 커넥션 변수 선언

    try {
        connection = await getConnection();
        const result = await connection.execute(sql, binds, { autoCommit: true });
        return result;
    } catch (error) {
        console.error("Repository Error: 친구 목록 조회 실패:", error);
        throw new Error("친구 목록 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
};

// export const createFriendRequest = async (requesterId, recipientId) => {
//     // T_FRIEND 테이블에 새로운 요청 레코드를 INSERT
//     const sql = `
//         INSERT INTO T_FRIEND (
//             USER_ID, FRIEND_USER_ID, STATUS, CREATED_AT
//         ) VALUES (
//             :requesterId, 
//             :recipientId, 
//             'PENDING',
//             CURRENT_TIMESTAMP
//         )
//     `;

//     const binds = {
//         requesterId: requesterId,
//         recipientId: recipientId
//     };

//     let connection;

//     try {
//         connection = await getConnection();
//         const options = { autoCommit: true };
//         // DB 실행 (INSERT 문)
//         const result = await connection.execute(sql, binds, options);
//         // 삽입 성공(1건) 여부를 반환
//         return result.rowsAffected === 1;;
//     } catch (error) {
//         console.error("Repository Error: 친구 요청 생성 실패", error);
//         throw new Error("친구 요청 DB 삽입 중 오류 발생");
//     } finally {
//         if (connection) await connection.close();
//     }
// };

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
    -- 본인 제외
    AND U.USER_ID != :userId
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
        console.log("DB 응답 결과:", result.rows);

        return result.rows;
    } catch (error) {
        console.error("Repository Error: 사용자 검색 DB 조회 실패:", error);
        throw new Error("사용자 검색 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close()
    }
};