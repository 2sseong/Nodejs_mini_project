import * as friendRepository from './friendRepository.js';
// 1. friendRepository의 함수들을 import합니다. (경로는 사용자 환경에 맞게 수정 필요)
import {
    addPick as addPickRepo, // 서비스 함수랑 이름이 겹침
    removePick as removePickRepo,
    searchUsersByQuery
} from './friendRepository.js';

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
 * 사용자 검색 비즈니스 로직 + 즐겨찾기 상태 포함
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} query - 검색어
 * @param {number|null} deptId - 부서 ID (필터링 조건)
 * @returns {Promise<Array<Object>>} - 검색된 사용자 목록 (isPick 포함)
 */
export const searchUsers = async (userId, query, deptId) => {
    const trimmed = (query ?? '').trim();

    try {
        // 1. 검색어 없으면 빈 문자열로 검색 (전체 목록 조회)
        const rawResults = await searchUsersByQuery(userId, trimmed);

        const formattedResults = rawResults.map(user => {
            return {
                userId: user.USER_ID,
                username: user.USERNAME,
                userNickname: user.NICKNAME,
                department: user.DEPT_NAME,
                position: user.POS_NAME,
                isPick: user.ISPICK,
            }
        });

        return formattedResults;
    } catch (error) {
        console.error("Service Error: 사용자 검색 중 DB 오류 발생", error);
        throw error;
    }
};


// 즐겨찾기 ⭐
/**
 * 즐겨찾기 추가
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} targetUserId - 즐겨찾기 대상 사용자 ID
 * @returns {Promise<{success: boolean, message: string}>} - 처리 결과
 */
export const addPick = async (userId, targetUserId) => {
    // Repository 함수를 호출하여 DB에 즐겨찾기 레코드를 삽입
    try {
        // userId와 targetUserId는 클라이언트(프론트)에서 서버로 보낸 요청을 거쳐
        // 서비스 계층으로 전달됨(컨트롤러에서 정의)
        const isSuccess = await addPickRepo(userId, targetUserId);

        // Repository 함수는 성공 시 true, 실패 시 false를 반환하도록 가정합니다.
        if (isSuccess) {
            return { success: true, message: '즐겨찾기가 성공적으로 추가되었습니다.' };
        } else {
            // rowsAffected가 0인 경우 (이론적으로는 일어나기 어려움)
            return { success: false, message: 'DB 삽입 작업에 실패했습니다.' };
        }
    } catch (error) {
        // DB에서 발생한 오류를 처리 (예: 유니크 제약 조건 위반 등)
        console.error("Service Error: 즐겨찾기 추가 중 DB 오류 발생", error);
        throw error; // Controller가 오류를 처리할 수 있도록 다시 던집니다.
    }
};


/**
 * 즐겨찾기 삭제
 * @param {string} userId - 현재 로그인된 사용자 ID
 * @param {string} targetUserId - 즐겨찾기 대상 사용자 ID
 * @returns {Promise<{success: boolean, message: string}>} - 처리 결과
 */
export const removePick = async (userId, targetUserId) => {

    // Repository 함수를 호출하여 DB에서 즐겨찾기 레코드를 삭제합니다.
    try {
        const isSuccess = await removePickRepo(userId, targetUserId);

        if (isSuccess) {
            return { success: true, message: '즐겨찾기가 성공적으로 제거되었습니다.' };
        } else {
            // isSuccess가 false인 경우: 레코드가 없어서 삭제된 행이 0개인 경우
            // 이 경우 사용자 입장에서는 '제거 성공'과 동일하게 처리해도 무방합니다.
            return { success: true, message: '이미 즐겨찾기 상태가 아니었거나 제거되었습니다.' };
        }
    } catch (error) {
        console.error("Service Error: 즐겨찾기 제거 중 DB 오류 발생", error);
        throw error;
    }
};