console.log('🚀 friendApi.js 파일 로드됨!');
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
            console.log('✅ Authorization 헤더 추가됨');
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
        // 실제 API 호출
        // const response = await axios.get(`${API_URL}/friends`);
        const response = await api.get(`/friends`);
        return response.data;
    } catch (error) {
        console.error("API Error: 친구 목록 조회 실패", error);
        throw new Error("친구 목록을 가져오는 데 실패했습니다.");
    }
};

// 2. 친구 요청 보내기 API (POST /api/friends/request) 
export const sendFriendRequest = async (recipientId, requesterId) => {
    console.log(`실제 API: ${recipientId}에게 친구 요청 전송. (요청자: ${requesterId})`);

    try {
        // const response = await axios.post(`${API_URL}/request`,
        const response = await axios.post(`/api/friends/request`, {
            recipientId: recipientId,
            requesterId: requesterId // 로그인 ID를 백엔드에 전달
        });
        return response.data;
    } catch (error) {
        console.error("API Error: 친구 요청 전송 실패", error);

        // 백엔드 메시지를 안전하게 추출하고, 없으면 기본 메시지를 사용
        const backendMessage = error.response?.data?.message;

        if (backendMessage) {
            // 백엔드에서 받은 비즈니스 오류 메시지를 프론트엔드에 전달
            throw new Error(backendMessage);
        }

        // 서버 응답(response)이 없거나 (네트워크 오류 등) 메시지가 없는 경우
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

// 5. 사용자 검색 API (구현)

// export const searchUsers = async (query, userId) => {
//     const response = await axios.get(`${API_URL}/search`, {
//         params: {
//             query: query,
//             userId: userId
//         }
//     });

//     console.log("검색 API 응답 원본 데이터 구조:", response.data);

//     if (Array.isArray(response.data)) {
//         return response.data;
//     }

//     return []; // 배열이 아니거나 결과가 없으면 빈 배열 반환
// };

// 사용자 검색 함수 
export const searchAllUsers = async (query = '', userId) => {
    console.log("🔥🔥🔥 searchAllUsers 호출됨! baseURL:", api.defaults.baseURL);
    console.log("실제 API: 사용자 검색 요청", { query, userId });
    try {
        // api 인스턴스 사용 + 괄호 사용
        const response = await api.get('/friends/search', {
            params: {
                query: query,
            }
        });
        
        console.log("검색 API 응답 원본 데이터 구조:", response.data);
        
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
        throw new Error("사용자를 검색하는 데 실패했습니다.");
    }
};