import * as friendRepository from './friendRepository.js';

/**
 * 친구 목록 조회 비즈니스 로직
 * Repository를 호출하여 데이터를 가져오고, 비즈니스 규칙을 처리
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @returns {Promise<Array<Object>>} - 친구 목록 (ID와 이름 포함)
 */
export const getFriendList = async (userId) => {
    // 1. 입력값 검증 (Service 계층의 책임)
    if (!userId) {
        // HTTP 400 Bad Request에 해당하는 에러를 던지도록 할 수 있음
        throw new Error("사용자 ID가 필요합니다.");
    }

    // 2. Repository를 통해 DB 데이터 가져오기
    const friends = await friendRepository.findFriendList(userId);

    // 3. 데이터 Controller에 반환
    return friends;
};

/**
 * 친구 추가 요청 비즈니스 로직
 * 1. 자기 자신에게 요청 불가 확인
 * 2. 기존 관계 (친구/요청) 존재 여부 확인
 * 3. 요청 레코드 생성
 * @param {string} requesterId - 요청을 보내는 사용자 ID
 * @param {string} recipientId - 요청을 받는 사용자 ID
 * @returns {Promise<Object>} - 요청 성공/실패 여부
 */
export const requestFriendship = async (requesterId, recipientId) => {
    // 1. 자기 자신에게 요청하는지 확인 (비즈니스 로직)
    if (requesterId === recipientId) {
        // 클라이언트에게 400 Bad Request에 해당하는 에러를 던짐
        throw new Error("자기 자신에게는 친구 요청을 보낼 수 없습니다.");
    }

    // 2. Repository를 통해 기존 관계가 있는지 확인 (DB 로직)
    const existingRelationship = await friendRepository.findExistingRelationship(requesterId, recipientId);

    if (existingRelationship.length > 0) {
        const status = existingRelationship[0].STATUS;
        if (status === 'ACCEPTED') {
            throw new Error("이미 친구 관계입니다.");
        }
        if (status === 'PENDING') {
            throw new Error("이미 처리되지 않은 친구 요청이 존재합니다.");
        }
    }

    // 3. Repository를 통해 새로운 친구 요청 레코드 생성
    const result = await friendRepository.createFriendRequest(requesterId, recipientId);

    return result;
};

/**
 * 사용자 검색 비즈니스 로직
 * 1. Repository를 통해 DB에서 사용자를 검색
 * 2. 친구 관계 상태(RELATIONSHIP_STATUS)를 프론트엔드가 사용하기 쉽도록 가공
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @returns {Promise<Array>} - 검색된 사용자 목록
 */
export const searchUsers = async (userId, query) => {
    console.log('====== [SERVICE searchUsers] ======');
    console.log('userId:', userId);
    console.log('query(raw):', query);
    const trimmed = (query ?? '').trim();
    
    // 1. 검색어 없으면 빈 문자열로 검색 (전체 목록 조회)
    const rawResults = await friendRepository.searchUsersByQuery(userId, trimmed);

    console.log('rawResults:', rawResults);

    const formattedResults = rawResults.map(user => {
        return {
            userId: user.USERID,
            username: user.USERNAME,
            userNickname: user.USERNICKNAME,
        }
    })
    // if(!trimmed){
    //     return await getAllUsers(userId);
    // }

    // console.log('trimmed:', trimmed);

    // // 2. Repository를 통해 DB에서 사용자 검색 및 관계 조회
    // const rawResults = await friendRepository.searchUsersByQuery(userId, trimmed);

    // console.log('rawResults:', rawResults);

    // // 3. 데이터를 프론트엔드 형식에 맞게 가공
    // const formattedResults = rawResults.map(user => {

    //     return {
    //         userId: user.USERID,
    //         username: user.USERNAME,
    //         userNickname: user.USERNICKNAME,
    //         relationshipStatus: user.RELATIONSHIPSTATUS,
    //     };
    // });

    return formattedResults;
};