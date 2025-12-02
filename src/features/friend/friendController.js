import {
    searchUsers as searchUsersService,
    addPick as addPickService,
    removePick as removePickService
} from './friendService.js';
import { addPick, removePick, searchUsersByQuery } from './friendRepository.js';

// -- GET /api/friends - 친구 목록 조회

export const getFriendList = async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const friends = await searchUsersService(currentUserId, null);
        console.log("getFriendList에서 받은 friends:", friends);
        return res.status(200).json(friends);
    } catch (error) {
        console.error("친구 목록 조회 중 Controller 오류:", error.message);
        return res.status(500).json({
            message: "친구 목록을 불러오는데 실패했습니다."
        });
    }
};

/**
 * 사용자 검색 API 핸들러
 * GET /api/friends/search?query=검색어
 * @param {object} req - 요청 객체 (query, userId 포함)
 * @param {object} res - 응답 객체
 */
export const searchUsers = async (req, res) => {
    // 1. URL 쿼리 파라미터에서 검색어(query)와 userId 추출
    const { query } = req.query; // paramUserId로 쿼리에서 받음

    // 2. 로그인 사용자 ID 확정: 프론트엔드에서 보낸 ID를 사용
    const userId = req.user.userId;

    if (!userId) {
        console.error('인증된 사용자 ID를 찾을 수 없습니다.')
        return res.status(400).json({ error: '사용자 ID를 제공해야 합니다.' });
    }

    try {
        const results = await searchUsersService(userId, query);
        console.log("컨트롤러에서 받은 results:", results);
        return res.status(200).json(results);
    } catch (error) {
        console.error("searchUsersService 실행 중 오류 발생:", error);
        return res.status(500).json({ error: "사용자 검색 처리 중 서버 오류가 발생했습니다." });
    }
};

/**
 * 즐겨찾기 상태를 토글하는 POST 요청 처리
 * 요청 본문: { targetUserId: '대상 ID', isAdding: true/false }
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 */
export const togglePick = async (req, res) => {
    const userId = req.user.userId;
    const { targetUserId, isAdding } = req.body;
    // 3. 유효성 검사
    if (!userId || !targetUserId || typeof isAdding !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: '필수 요청 데이터가 누락되었거나 형식이 잘못되었습니다.'
        });
    }

    try {
        let result;

        // 4. [토글 로직]: isAdding 값에 따라 Service 함수를 분기하여 호출합니다.
        if (isAdding) {
            // isAdding이 true면, 즐겨찾기 추가 함수 호출
            result = await addPickService(userId, targetUserId);
        } else {
            // isAdding이 false면, 즐겨찾기 제거 함수 호출
            result = await removePickService(userId, targetUserId);
        }

        // 5. 응답 반환: Service에서 받은 결과를 클라이언트에게 JSON 형태로 반환
        return res.status(200).json(result);

    } catch (error) {
        // DB나 Service 계층에서 발생한 오류 처리
        console.error("Controller Error: 즐겨찾기 토글 실패:", error);
        return res.status(500).json({
            success: false,
            message: '서버 내부 오류가 발생했습니다.'
        });
    }
};