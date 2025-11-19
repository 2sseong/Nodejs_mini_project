// src/hooks/useAuth.js
import { useEffect, useState } from 'react';
import sanitizeStorageValue from '../utils/sanitizeStorageValue';
import { isLoggedIn, logout as performLogout } from '../utils/authUtils'

export function useAuth() {
    const [authLoaded, setAuthLoaded] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userNickname, setUserNickname] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn()); // 초기 인증 상태 설정

    // 초기 인증 정보 로드 로직
    useEffect(() => {
        const tokenExists = isLoggedIn() // 토큰 유효성 확인

        if (tokenExists) {
            // 토큰이 있을 경우, userId와 nickname을 로드함
            const idRaw = localStorage.getItem('userid') ?? localStorage.getItem('userId');
            const nickRaw = localStorage.getItem('userNickname') ?? localStorage.getItem('nickname');

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
    // 의존성 배열을 비워, 컴포넌트 마운트 시 단 한 번만 실행되게 함
    }, []);

    // 2. 로그인 상태 업데이트 함수 (Login Page에서 사용)
    const login = () => {
        // 로그인 성공 후, 로컬 스토리지에서 새로운 정보를 다시 로드
        const idRaw = localStorage.getItem('userId');
        const nickRaw = localStorage.getItem('userNickname');

        const id = sanitizeStorageValue(idRaw);
        const nickname = sanitizeStorageValue(nickRaw);

        if (isLoggedIn() && id && nickname){
            setUserId(id);
            setUserNickname(nickname);
            setIsAuthenticated(true);
        }
    };

    // 3. 로그아웃 기능 함수 (Header에서 사용)
    const logout = () => {
        performLogout(); // authUtils의 실제 로직 호출
        setUserId(null);
        setUserNickname(null);
        setIsAuthenticated(false); // 리액트 상태 업데이트
    }

    return { authLoaded, isAuthenticated, userId, userNickname, login, logout };
}