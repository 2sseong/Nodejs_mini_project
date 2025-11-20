import React, { createContext, useContext, useEffect, useState } from 'react';
// authUtils.js에서 필요한 함수들을 가져옵니다.
// 경로 오류 해결: 파일 확장자(.js)를 명시합니다.
import { isLoggedIn as checkLoggedIn, logout as authLogout, getAuthToken } from '../utils/authUtils.js';
import sanitizeStorageValue from '../utils/sanitizeStorageValue.js';

const AuthContext = createContext({
    isAuthenticated: false,
    userId: null,
    userNickname: null,
    login: () => {}, // 로그인 시 상태 업데이트 함수
    logout: () => {}, // 로그아웃 시 상태 업데이트 함수
    authLoaded: false, // 초기 인증 정보 로드 완료 여부
});

// useAuth 훅을 내부에서 구현하여 Context의 값을 쉽게 사용
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

/**
 * 전역 인증 상태를 관리하고 제공하는 Provider 컴포넌트입니다.
 */
export const AuthProvider = ({ children }) => {
    const [authLoaded, setAuthLoaded] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userNickname, setUserNickname] = useState(null);
    // 초기 상태는 authUtils.js의 isLoggedIn을 통해 로컬 스토리지 기반으로 설정
    const [isAuthenticated, setIsAuthenticated] = useState(checkLoggedIn());

    // Context 내부에서 로그아웃 로직을 실행하는 헬퍼 함수
    const performLogout = () => {
        authLogout(); // authUtils의 실제 로직 호출 (로컬 스토리지 제거)
        setUserId(null);
        setUserNickname(null);
        setIsAuthenticated(false);
    }

    // 1. 초기 인증 정보 로드 로직 (컴포넌트 마운트 시 1회 실행)
    useEffect(() => {
        const tokenExists = checkLoggedIn(); // 토큰 유효성 확인

        if (tokenExists) {
            // 토큰이 있을 경우, userId와 nickname을 로드함
            const idRaw = localStorage.getItem('userId');
            const nickRaw = localStorage.getItem('userNickname');

            const id = sanitizeStorageValue(idRaw);
            const nickname = sanitizeStorageValue(nickRaw);
            
            // 상태 업데이트: 유효한 정보일 때만 설정
            if (id && nickname) {
                setUserId(id);
                setUserNickname(nickname);
                setIsAuthenticated(true);
            } else {
                // 토큰은 있는데 사용자 정보가 없을 경우, 안전하게 로그아웃 처리
                performLogout();
                setIsAuthenticated(false);
            }
        } else {
            // 토큰이 없는 경우: 상태 초기화
            setUserId(null);
            setUserNickname(null);
            setIsAuthenticated(false);
        }

        setAuthLoaded(true); // 로드 완료
    }, []);

    // 2. 로그인 상태 업데이트 함수 (Login Page에서 사용됨)
    const login = () => {
        // 로그인 성공 후, LoginPage에서 저장된 로컬 스토리지 정보를 다시 로드하여 Context 상태 업데이트
        const idRaw = localStorage.getItem('userId');
        const nickRaw = localStorage.getItem('userNickname');

        const id = sanitizeStorageValue(idRaw);
        const nickname = sanitizeStorageValue(nickRaw);

        if (checkLoggedIn() && id && nickname){
            setUserId(id);
            setUserNickname(nickname);
            setIsAuthenticated(true);
        } else {
            // 로컬 스토리지 저장에 문제가 있었던 경우, 안전하게 로그아웃 처리
            performLogout();
        }
    };

    // 3. 로그아웃 기능 함수
    const logout = () => {
        performLogout(); // authUtils의 실제 로직 호출 및 리액트 상태 업데이트
    }

    const contextValue = {
        authLoaded,
        isAuthenticated,
        userId,
        userNickname,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};