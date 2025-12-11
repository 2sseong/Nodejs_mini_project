import api from './client';
import * as SecureStore from 'expo-secure-store';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: {
        userId: string;
        nickname: string;
        username: string;
    };
}

export interface SignupRequest {
    email: string;
    password: string;
    nickname: string;
    deptId: number;
    posId: number;
    phone?: string;
    address?: string;
    addressDetail?: string;
}

// 토큰 저장 키
const TOKEN_KEY = 'authToken';
const USER_DATA_KEY = 'userData';

// ============ 인증 관련 ============

// 로그인
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/login', { email: data.email, password: data.password });
    const { token, user } = response.data;

    // 토큰 저장
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user));

    return response.data;
};

// 로그아웃
export const logout = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
};

// 회원가입
export const signup = async (data: SignupRequest): Promise<any> => {
    const response = await api.post('/api/auth/signup', data);
    return {
        ok: response.status >= 200 && response.status < 300,
        data: response.data,
    };
};

// 토큰 확인
export const checkAuth = async (): Promise<boolean> => {
    try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        return !!token;
    } catch {
        return false;
    }
};

// 저장된 사용자 정보 가져오기
export const getStoredUser = async (): Promise<any | null> => {
    try {
        const userData = await SecureStore.getItemAsync(USER_DATA_KEY);
        return userData ? JSON.parse(userData) : null;
    } catch {
        return null;
    }
};

// 저장된 토큰 가져오기
export const getStoredToken = async (): Promise<string | null> => {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        return null;
    }
};

// ============ 사용자 정보 ============

// 내 정보 조회
export const getMyInfo = async (): Promise<any> => {
    const response = await api.get('/api/auth/me');
    return response.data;
};

// 비밀번호 확인
export const verifyPassword = async (password: string): Promise<any> => {
    const response = await api.post('/api/auth/verify-password', { password });
    return response.data;
};

// 사용자 정보 수정 (닉네임 변경 또는 비밀번호 변경)
export const updateUserInfo = async (data: { nickname?: string; currentPassword?: string; newPassword?: string }): Promise<any> => {
    const response = await api.put('/api/auth/update', data);
    return response.data;
};

// 프로필 이미지 업로드 (FormData를 직접 받음)
export const uploadProfileImage = async (formData: FormData): Promise<any> => {
    const response = await api.post('/api/auth/profile-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// ============ 부서/직급 ============

// 부서 목록 조회
export const getDepartments = async (): Promise<any[]> => {
    const response = await api.get('/api/auth/departments');
    return response.data.data || [];
};

// 직급 목록 조회
export const getPositions = async (): Promise<any[]> => {
    const response = await api.get('/api/auth/positions');
    return response.data.data || [];
};

// ============ 비밀번호 찾기 ============

// 비밀번호 찾기 (이메일 전송)
export const forgotPassword = async (email: string): Promise<any> => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
};
