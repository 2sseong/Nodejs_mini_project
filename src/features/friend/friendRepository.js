// import db from '../../db/oracle.js';
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

// -- 친구추가요청
/**
 * !!! 두 사용자 간의 기존 친구/요청 관계를 조회
 * USER_ID와 FRIEND_USER_ID의 순서에 관계없이 조회해야 함
 * @param {string} userId1 - 사용자 ID 1
 * @param {string} userId2 - 사용자 ID 2
 * @returns {Promise<Array<Object>>} - STATUS ('ACCEPTED', 'PENDING' 등)를 포함한 레코드
 */
export const findExistingRelationship = async (userId1, userId2) => {
    // T_FRIEND 테이블에서 두 사용자 ID를 양방향으로 조회
    const sql = `
        SELECT STATUS
        FROM T_FRIEND
        WHERE (USER_ID = :userId1 AND FRIEND_USER_ID = :userId2)
           OR (USER_ID = :userId2 AND FRIEND_USER_ID = :userId1)
    `;

    const binds = { userId1, userId2 };

    let connection;

    try {
        // getConnection을 사용하여 커넥션 획득
        connection = await getConnection();

        // db.execute 대신 connection.execute 사용
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT // db에서 데이터 배열로 넘어오는거 방지. 객체 속성 참조
        });

        return result.rows;
    } catch (error) {
        console.error("Repository Error: 기존 관계 조회 실패", error);
        throw new Error("DB 관계 조회 중 오류 발생");
    } finally {
        // 작업이 끝나면 반드시 커넥션 해제
        if (connection) {
            try {
                await connection.close();
            } catch (e) {
                console.error("Error closing connection:", e);
            }
        }
    }
};


/**
 * !!! 친구 요청 레코드를 DB에 삽입 (상태는 'PENDING')
 * @param {string} requesterId - 요청을 보낸 사용자 ID (USER_ID)
 * @param {string} recipientId - 요청을 받는 사용자 ID (FRIEND_USER_ID)
 * @returns {Promise<Object>} - 삽입 결과
 */
export const createFriendRequest = async (requesterId, recipientId) => {
    // T_FRIEND 테이블에 새로운 요청 레코드를 INSERT
    const sql = `
        INSERT INTO T_FRIEND (
            USER_ID, FRIEND_USER_ID, STATUS, CREATED_AT
        ) VALUES (
            :requesterId, 
            :recipientId, 
            'PENDING',
            CURRENT_TIMESTAMP
        )
    `;

    const binds = {
        requesterId: requesterId,
        recipientId: recipientId
    };

    let connection;

    try {
        connection = await getConnection();
        const options = { autoCommit: true };
        // DB 실행 (INSERT 문)
        const result = await connection.execute(sql, binds, options);
        // 삽입 성공(1건) 여부를 반환
        return result.rowsAffected === 1;;
    } catch (error) {
        console.error("Repository Error: 친구 요청 생성 실패", error);
        throw new Error("친구 요청 DB 삽입 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
};

/**
 * !!! 사용자 검색 및 친구 관계 상태 조회 (GET /users/search)
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @returns {Promise<Array>} - 검색된 사용자 목록 및 친구 상태
 */
// export const searchUsersByQuery = async (userId, query) => {

//     const sql = `
// SELECT
//     U.USER_ID AS userId,
//     U.USERNAME AS username,
//     U.NICKNAME AS userNickname,
//     CASE
//         WHEN F.STATUS = 'ACCEPTED' THEN 1
//         WHEN F.STATUS = 'PENDING' THEN 2
//         ELSE 0
//     END AS relationshipStatus
// FROM T_USER U
// LEFT JOIN T_FRIEND F ON
//     (F.USER_ID = U.USER_ID AND F.FRIEND_USER_ID = :userId)
//     OR (F.USER_ID = :userId AND F.FRIEND_USER_ID = U.USER_ID)
// WHERE
//     (U.USER_ID LIKE '%' || :query || '%' 
//     OR U.USERNAME LIKE '%' || :query || '%'
//     OR U.NICKNAME LIKE '%' || :query || '%')
//     AND U.USER_ID != :userId
// `;

//     const binds = { userId: userId, query: query };

//     let connection;

//     try {
//         connection = await getConnection();
//         // DB 드라이버에게 결과를 SQL에서 정의한 별칭을 키로 사용하는 객체 배열로 반환하라고 지시
//         const options = {
//             outFormat: oracledb.OUT_FORMAT_OBJECT
//         };

//         // options 객체를 execute 함수의 세 번째 인자로 전달
//         const result = await connection.execute(sql, binds, options);

//         // 디버깅 코드
//         console.log("DB 응답 결과:", result.rows);

//         return result.rows;
//     } catch (error) {
//         console.error("Repository Error: 사용자 검색 DB 조회 실패:", error);
//         throw new Error("사용자 검색 DB 조회 중 오류 발생");
//     } finally {
//         if (connection) await connection.close()
//     }
// };

// 즐겨찾기 ⭐
export const addUserPick = async (userId, pickUserId) => {
    // 즐겨찾기 추가 (User_Pick 테이블에 사용자 ID와 대상 사용자 ID를 INSERT)
    const sql = `
    INSERT INTO USER_PICK (USER_ID, TARGET_USER_ID)
    VALUES (:userId, :pickUserId)
    `;

    const binds = { userId: userId, pickUserId: pickUserId };

    let connection; // DB 커넥션 획득

    try {
        connection = await getConnection();
        // const options = { autoCommit: true }; 
        const result = await connection.execute(sql, binds);

        // 삽입이 성공적으로 1건 되었는지 확인하고 true/false반환
        return result.rowsAffected === 1;
    } catch (error) {
        console.error("Repository Error: 즐겨찾기 추가 DB 실패", error);
        throw new Error("즐겨찾기 추가 DB 삽입 중 오류 발생");
    } finally {
        if (connection) await connection.close();
    }
}

// 즐겨찾기 삭제
export const removeUserPick = async (userId, pickUserId) => {
    const sql = `
    DELETE FROM USER_PICK
    WHERE USER_ID = :userId AND TARGET_USER_ID = :pickUserId
    `;

    const binds = { userId: userId, pickUserId: pickUserId };

    let connection;

    try {
        connection = await getConnection();
        // const options = { autoCommit: true }; 
        const result = await connection.execute(sql, binds);

        return result.rowsAffected === 1;
    } catch (error) {
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
        // const options = { autoCommit: true }; 
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
 * !!! 사용자 검색 및 즐겨찾기 상태 조회 (GET /users/search)
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @returns {Promise<Array>} - 검색된 사용자 목록 및 즐겨찾기 상태 (isPick)
 */
export const searchUsersByQuery = async (userId, query) => {

    const sql = `
SELECT
    U.USER_ID, U.USERNAME, U.NICKNAME,
    -- 즐겨찾기 상태 조회 (P.USER_ID가 NULL이 아니면 1, 맞으면 0)
    CASE
        WHEN P.USER_ID IS NOT NULL THEN 1 -- 즐겨찾기 됨
        ELSE 0                           -- 즐겨찾기 안 됨
    END AS isPick
FROM T_USER U
-- 즐겨찾기 상태 조인을 위한 LEFT JOIN (USER_PICK)
LEFT JOIN USER_PICK P ON 
    -- 로그인된 사용자가 (P.USER_ID = :userId) 
    -- 검색 대상 사용자(U.USER_ID)를 즐겨찾기 했는지 (P.TARGET_USER_ID = U.USER_ID) 확인
    P.TARGET_USER_ID = U.USER_ID AND P.USER_ID = :userId
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
        const options = {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        };

        const result = await connection.execute(sql, binds, options);
        console.log("DB 응답 결과:", result.rows);
        return result.rows;
    } catch (error) {
        console.error("Repository Error: 사용자 검색 DB 조회 실패:", error);
        throw new Error("사용자 검색 DB 조회 중 오류 발생");
    } finally {
        if (connection) await connection.close()
    }
};