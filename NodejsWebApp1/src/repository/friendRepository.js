import db from '../../db/oracle.js';
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
            -- T_USER 테이블(U)에서 친구의 이름(USER_NAME)을 가져옴
            U.USER_NAME AS FRIEND_NAME 
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

    try {
        const result = await db.execute(sql, { userId });
        return result.rows;
    } catch (error) {
        console.error("Repository Error: 친구 목록 조회 실패:", error);
        throw new Error("친구 목록 DB 조회 중 오류 발생");
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

    try {
        const result = await db.execute(sql, binds);
        return result.rows;
    } catch (error) {
        console.error("Repository Error: 기존 관계 조회 실패", error);
        throw new Error("DB 관계 조회 중 오류 발생");
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
            FRIEND_ID, USER_ID, FRIEND_USER_ID, STATUS
        ) VALUES (
            -- FRIEND_ID는 시퀀스(nextval)를 사용하거나, 테이블 정의에 따라 NULL 처리
            NULL, 
            :requesterId, 
            :recipientId, 
            'PENDING'
        )
    `;

    const binds = {
        requesterId: requesterId,
        recipientId: recipientId
    };

    try {
        // DB 실행 (INSERT 문)
        const result = await db.execute(sql, binds);
        return result;
    } catch (error) {
        console.error("Repository Error: 친구 요청 생성 실패", error);
        throw new Error("친구 요청 DB 삽입 중 오류 발생");
    }
};

/**
 * !!! 사용자 검색 및 친구 관계 상태 조회 (GET /users/search)
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @returns {Promise<Array>} - 검색된 사용자 목록 및 친구 상태
 */
export const searchUsersByQuery = async (userId, query) => {
    const sql = `
        SELECT
            U.USER_ID,
            U.USER_NAME,
            -- 관계 상태를 숫자로 반환 (PENDING 포함)
            CASE
                WHEN F.STATUS = 'ACCEPTED' THEN 1 -- 친구임
                WHEN F.STATUS = 'PENDING' THEN 2 -- 요청 중
                ELSE 0                         -- 관계 없음
            END AS RELATIONSHIP_STATUS
        FROM T_USER U
        -- T_FRIEND 테이블과 LEFT JOIN 합니다.
        -- 관계가 (U.USER_ID <-> :userId) 또는 (:userId <-> U.USER_ID) 인 레코드를 찾습니다.
        LEFT JOIN T_FRIEND F ON
            (F.USER_ID = U.USER_ID AND F.FRIEND_USER_ID = :userId) 
            OR (F.USER_ID = :userId AND F.FRIEND_USER_ID = U.USER_ID)
        WHERE
            -- 1. 검색어가 ID나 이름에 포함되고
            (U.USER_ID LIKE '%' || :query || '%' OR U.USER_NAME LIKE '%' || :query || '%')
            -- 2. 로그인 사용자(자기 자신)는 제외합니다.
            AND U.USER_ID != :userId
    `;

    const binds = { userId: userId, query: query };

    try {
        const result = await db.execute(sql, binds);
        return result.rows;
    } catch (error) {
        console.error("Repository Error: 사용자 검색 DB 조회 실패:", error);
        throw new Error("사용자 검색 DB 조회 중 오류 발생");
    }
};