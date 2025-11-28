// src/utils/uthUtils.js
// localStorage에 접근해서 인증 정보를 없애거나 확인하는 로직을 담음
// 로그인 상태 확인하는 유틸리티 함수
export const getAuthToken = () => {
    // 로컬 스토리지에서 토큰을 가져옴
    return localStorage.getItem('authToken');
};

export const isLoggedIn = () => {
    // 토큰이 존재하고 유효한지 여부를 반환
    // 단순히 토큰의 존재 유무만 확인
    return !!getAuthToken();
};

export const logout = () => {
    // 토큰과 저장된 사용자 정보를 모두 제거
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userNickname');
    localStorage.removeItem('username');
    // 필요한 경우 추가적인 상태 정리 로직을 포함
};