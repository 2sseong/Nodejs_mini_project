// src/lib/api.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BASE_URL || '/';

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

// 요청 인터셉터: 모든 요청에 자동으로 토큰 추가
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export { BASE_URL };