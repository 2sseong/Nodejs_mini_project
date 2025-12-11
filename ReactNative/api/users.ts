import api from './client';

export interface User {
    USER_ID: string;
    USER_NICKNAME: string;
    NICKNAME?: string;  // alias for compatibility
    PROFILE_IMG?: string;
    DEPT_NAME?: string;
    POS_NAME?: string;
    POSITION_NAME?: string;  // alias for compatibility
    EMAIL?: string;
}

export interface UserProfile {
    userId: string;
    nickname: string;
    email: string;
    profileImg?: string;
    deptName?: string;
    posName?: string;
}

// ============ 사용자 검색 ============

// 사용자 검색 (초대용)
export const searchUsers = async (query: string): Promise<User[]> => {
    try {
        const response = await api.get('/api/users/search', {
            params: { query }
        });

        if (Array.isArray(response.data)) {
            return response.data;
        }

        // { users: [...] } 형태인 경우
        if (response.data.users && Array.isArray(response.data.users)) {
            return response.data.users;
        }

        return [];
    } catch (error) {
        console.error('사용자 검색 실패:', error);
        throw new Error('사용자를 검색하는 데 실패했습니다.');
    }
};

// ============ 즐겨찾기 ============

// 즐겨찾기 토글
export const toggleUserPick = async (targetUserId: string, isAdding: boolean): Promise<any> => {
    const response = await api.post('/api/users/pick', {
        targetUserId,
        isAdding
    });
    return response.data;
};

// ============ 프로필 ============

// 본인 프로필 조회
export const getMyProfile = async (): Promise<UserProfile> => {
    const response = await api.get('/api/users/my-profile');

    if (response.data.success && response.data.data) {
        return response.data.data;
    }

    throw new Error('프로필 데이터 형식이 올바르지 않습니다.');
};

// 다른 사용자 프로필 조회
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
    const response = await api.get(`/api/users/${userId}/profile`);
    return response.data;
};
