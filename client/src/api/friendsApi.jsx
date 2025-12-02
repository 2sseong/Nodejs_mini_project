import axios from 'axios';

// 백엔드 API 기본 URL (server.js의 포트: 1337에 맞게 설정)
const api = axios.create({
    baseURL: '/api',
});

// -- Mock 데이터 (아직 구현되지 않은 기능에만 사용)
const mockReceivedRequests = [
    { id: 1, requesterId: "dongdong", requesterName: "동동이", status: "PENDING" },
    { id: 2, requesterId: "mangmang", requesterName: "망망이", status: "PENDING" },
];


// 요청 인터셉터: 모든 요청에 자동으로 토큰 추가 (JWT 토큰 검증)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('✅ Authorization 헤더 추가됨:', token.substring(0, 20) + '...');
        } else {
            console.log('⚠️ 토큰 없음 - Authorization 헤더 없이 요청');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ==========================================================
// ✅ 구현 완료된 기능 (실제 API 연동)
// ==========================================================

// 1. 내 친구 목록 조회 API (GET /api/friends)
export const fetchFriendList = async () => {
    console.log("실제 API: 내 친구 목록 조회 요청");
    try {
        const response = await api.get(`/friends`);
        return response.data;
    } catch (error) {
        console.error("API Error: 친구 목록 조회 실패", error);
        throw new Error("친구 목록을 가져오는 데 실패했습니다.");
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

// 사용자 검색 함수 
export const searchAllUsers = async (query = '', userId) => {
    console.log("🔍 searchAllUsers 호출됨! query:", query);
    try {
        const response = await api.get('/friends/search', {
            params: {
                query: query,
            }
        });

        console.log("검색 API 응답:", response.data);

        if (Array.isArray(response.data)) {
            return response.data;
        }

        // 혹시 { users: [...] } 형태라면
        if (response.data.users && Array.isArray(response.data.users)) {
            return response.data.users;
        }

        return [];
    } catch (error) {
        console.error("API Error: 사용자 검색 실패", error);
        console.error("에러 상세:", error.response?.status, error.response?.data);
        throw new Error("사용자를 검색하는 데 실패했습니다.");
    }
};

// **********************************************
// * 즐겨찾기 토글 API 함수 추가
// **********************************************

/**
 * 즐겨찾기 상태를 토글하는 API 호출 함수
 * @param {string} targetUserId - 즐겨찾기 대상 ID (클릭된 사용자)
 * @param {boolean} isAdding - true면 추가 요청, false면 제거 요청
 * @returns {Promise<object>} - 서버 응답 (success 및 message 포함)
 */
export const toggleUserPick = async (targetUserId, isAdding) => {
    console.log("🚀 toggleUserPick 호출됨");
    console.log("targetUserId:", targetUserId);
    console.log("isAdding:", isAdding);
    const requestBody = {
        targetUserId: targetUserId,
        isAdding: isAdding
    };

    try {
        const response = await api.post('/friends/pick', requestBody);
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || '즐겨찾기 토글 중 알 수 없는 오류 발생';
        console.error("API Error - toggleUserPick:", error);
        throw new Error(errorMessage);
    }
};