import axios from 'axios';

// 백엔드 API 기본 URL
const api = axios.create({
    baseURL: '/api',
});

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

/**
 * 사용자 검색 API
 * @param {string} query - 검색어
 * @param {string} userId - 사용자 ID (사용하지 않지만 호환성 유지)
 * @returns {Promise<Array>} - 검색된 사용자 목록
 */
export const searchAllUsers = async (query = '', userId) => {
    console.log("🔍 searchAllUsers 호출됨! query:", query);
    try {
        const response = await api.get('/users/search', {
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
        const response = await api.post('/users/pick', requestBody);
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || '즐겨찾기 토글 중 알 수 없는 오류 발생';
        console.error("API Error - toggleUserPick:", error);
        throw new Error(errorMessage);
    }
};