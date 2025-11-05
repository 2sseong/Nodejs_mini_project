import axios from 'axios';

// 백엔드 API 기본 URL (server.js의 포트: 1337에 맞게 설정)
const API_URL = 'http://localhost:1337/api/friends';

// -- Mock 데이터 (아직 구현되지 않은 기능에만 사용)
const mockReceivedRequests = [
    { id: 1, requesterId: "dongdong", requesterName: "동동이", status: "PENDING" },
    { id: 2, requesterId: "mangmang", requesterName: "망망이", status: "PENDING" },
];


// ==========================================================
// ✅ 구현 완료된 기능 (실제 API 연동)
// ==========================================================

// 1. 내 친구 목록 조회 API (GET /api/friends/friends)
export const fetchFriendList = async () => {
    console.log("실제 API: 내 친구 목록 조회 요청");
    try {
        // 실제 API 호출
        // const response = await axios.get(`${API_URL}/friends`);
        const response = await axios.get(`/friends`);
        return response.data;
    } catch (error) {
        console.error("API Error: 친구 목록 조회 실패", error);
        throw new Error("친구 목록을 가져오는 데 실패했습니다.");
    }
};

// 2. 친구 요청 보내기 API (POST /api/friends/request) 
export const sendFriendRequest = async (recipientId) => {
    console.log(`실제 API: ${recipientId}에게 친구 요청 전송. (요청자: ${requesterId})`);
    const data = { recipientId };

    try {
        const response = await axios.post(`${API_URL}/request`,
            { recipientId }, // POST 요청의 body
            {
                params: { userId: requesterId } // 👈 요청자 ID를 쿼리 파라미터 'userId'로 전달
            }
        );
        return response.data;
    } catch (error) {
        console.error("API Error: 친구 요청 전송 실패", error);

        // 백엔드에서 던진 비즈니스 오류 메시지를 프론트엔드에 전달
        if (error.response && error.response.data && error.response.data.message) {
            throw new Error(error.response.data.message);
        }

        throw new Error("친구 요청을 보내는 데 실패했습니다.");
    }
};

// ==========================================================
// ❌ 미구현 기능 (Mock 데이터 유지)
// ==========================================================

// 3. 받은 친구 요청 목록 조회 API (GET /api/v1/friends/requests/received)
export const fetchReceivedRequests = () => {
    console.log("Mock API: 받은 친구 요청 목록 조회");
    return Promise.resolve(mockReceivedRequests);
};

// 4. 친구 요청 수락 API (PATCH /api/v1/friends/requests/:id)
export const acceptFriendRequest = (requestId) => {
    console.log(`Mock API: 요청 ID ${requestId} 수락 처리`);
    return Promise.resolve({ success: true, message: "요청이 수락되었습니다." });
};

// 5. 사용자 검색 API (GET /api/v1/users/search?query=...)
export const searchUsers = async (query, userId) => {
    const response = await axios.get(`${API_URL}/search`, {
        params: {
            query: query,
            userId: userId
        }
    });
    return response.data;
};