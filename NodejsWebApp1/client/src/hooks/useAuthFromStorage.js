// src/hooks/useAuthFromStorage.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sanitizeStorageValue from '../utils/sanitizeStorageValue';

export function useAuthFromStorage() {
    const navigate = useNavigate();
    const [authLoaded, setAuthLoaded] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userNickname, setUserNickname] = useState(null);

    useEffect(() => {
        const idRaw = localStorage.getItem('userid') ?? localStorage.getItem('userId');
        const nickRaw = localStorage.getItem('userNickname') ?? localStorage.getItem('nickname');

        const id = sanitizeStorageValue(idRaw);
        const nickname = sanitizeStorageValue(nickRaw);

        setUserId(id);
        setUserNickname(nickname);
        setAuthLoaded(true);

        if (!id || !nickname) {
            console.error('로그인 정보가 null/invalid. 로그인으로 리디렉션.');
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    return { authLoaded, userId, userNickname };
}