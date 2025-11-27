import * as friendService from './friendService.js';

// -- GET /api/friends/friends - 친구 목록 조회

export const getFriendList = async (req, res) => {
    // 실제 인증 미들웨어를 통해 req.user.id에서 로그인된 사용자 ID를 가져와야 함
    // 임시로 'TEST_USER_A'를 사용 (나중에 req.user.id로 변경하기)-> 구현
    // const currentUserId = 'TEST_USER_A';
    const currentUserId = req.user.id; 

    try {
        // 1. Service 계층에게 비즈니스 로직 실행을 위임합'
        // 검색어는 null로 전달
        const friends = await friendService.searchUsers(currentUserId, null);

        // 2. HTTP 상태 코드 200(OK)과 함께 결과를 JSON 형태로 클라이언트에게 응답
        return res.status(200).json(friends);

    } catch (error) {
        // 3. 에러 처리 (Service나 Repository에서 던져진 에러를 받음)
        console.error("친구 목록 조회 중 Controller 오류:", error.message);

        // 입력값 오류 등 클라이언트 문제라면 400 Bad Request를 줄 수 있지만,
        // 현재는 일반적인 서버 오류(500)로 처리
        return res.status(500).json({
            message: "친구 목록을 불러오는데 실패했습니다."
        });
    }
};

/**
 * POST /api/friends/request - 친구 추가 요청
 */
export const requestFriendship = async (req, res) => {
    // 실제 인증 미들웨어를 통해 로그인된 사용자 ID를 가져와야 함
    const { recipientId, requesterId } = req.body;

    // 1. HTTP 요청 본문에서 요청을 받는 사람의 ID를 가져옴
    // 프론트엔드에서 { recipientId: '...' } 형태로 보냄

    try {
        // 2. 입력값 검증 (Controller 책임)
        if (!recipientId || !requesterId) {
            return res.status(400).json({ message: "요청을 받는 사용자 ID가 필요합니다." });
        }

        // 3. Service 계층에게 비즈니스 로직 실행을 위임
        await friendService.requestFriendship(requesterId, recipientId);

        // 4. 성공 응답: HTTP 상태 코드 201 (Created)
        return res.status(201).json({
            message: "친구 요청이 성공적으로 전송되었습니다."
        });

    } catch (error) {
        console.error("친구 요청 중 Controller 오류:", error.message);

        // Service에서 발생시킨 비즈니스 로직 오류 처리
        if (error.message.includes('본인 입니다') || error.message.includes('이미 친구') || error.message.includes('이미 처리되지 않은 요청')) {
            return res.status(400).json({ message: error.message });
        }

        // 일반 서버 오류 처리
        return res.status(500).json({
            message: "친구 요청 처리에 실패했습니다."
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
        const results = await friendService.searchUsers(userId, query);
        return res.status(200).json(results);
    } catch (error) {
        console.error("⭐⭐⭐⭐friendService.searchUsers 실행 중 오류 발생:", error);
        return res.status(500).json({ error: "사용자 검색 처리 중 서버 오류가 발생했습니다." });
    }
};