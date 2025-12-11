import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// 서버 URL 설정 (개발 시 PC의 로컬 IP 사용)
// 배포 시 실제 서버 URL로 변경
const API_BASE_URL = 'http://192.168.0.20:1337'; // TODO: 실제 IP로 변경

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 요청 인터셉터: 토큰 자동 추가
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStore.getItemAsync('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.log('Token retrieval error:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 응답 인터셉터: 에러 처리
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // 토큰 만료 시 로그아웃 처리
            await SecureStore.deleteItemAsync('accessToken');
            // TODO: 로그인 화면으로 이동
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_BASE_URL };
