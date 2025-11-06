// src/components/Modals/InviteUserModal.jsx
import { useEffect, useRef, useState } from 'react';
import './Modals.css';
import { api } from '../../../lib/api';

export default function InviteUserModal({
    isOpen,
    onClose,
    currentRoomId,
    userId,
    selectRoom,
}) {
    const [inviteeId, setInviteeId] = useState('');
    const [inviteeUsername, setInviteeUsername] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const abortRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            // 초기화
            setInviteeId('');
            setInviteeUsername('');
            setSearchResults([]);
            setSearchError('');
            setIsSearching(false);
        }
    }, [isOpen]);

    if (!isOpen || !currentRoomId) return null;

    const handleSearchUsers = (input) => {
        const q = input.trim();
        setInviteeUsername(input);
        setSearchError('');

        if (q.length < 2) {
            if (abortRef.current) abortRef.current.abort();
            clearTimeout(debounceRef.current);
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();

            setIsSearching(true);
            setSearchResults([]);
            try {
                const resp = await api.get('/users/search', {
                    params: { query: q },
                    signal: abortRef.current.signal,
                });
                const payload = resp?.data;
                const list = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.users)
                        ? payload.users
                        : Array.isArray(payload?.data)
                            ? payload.data
                            : [];
                setSearchResults(list);
            } catch (err) {
                if (err.name === 'CanceledError') return;
                console.error('User search failed:', err.response?.data || err.message);
                setSearchError(err.response?.data?.message || '검색 중 오류가 발생했습니다.');
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    const handleUserSelect = (user) => {
        setInviteeId(String(user.USER_ID));
        setInviteeUsername(user.USERNAME);
        setSearchResults([]);
    };

    const handleInviteUser = async () => {
        if (isInviting || !currentRoomId || !inviteeId) return;
        if (inviteeId === userId) {
            alert('자기 자신을 초대할 수 없습니다.');
            return;
        }
        setIsInviting(true);
        try {
            const res = await api.post('/chats/invite', {
                roomId: String(currentRoomId),
                inviterId: userId,
                inviteeId,
            });
            if (res.data?.success) {
                alert(`${inviteeUsername} 님을 성공적으로 초대했습니다.`);
                onClose(true);
            } else {
                alert(`초대 실패: ${res.data?.message || '알 수 없는 오류'}`);
            }
        } catch (err) {
            console.error('Invite failed:', err.response?.data || err.message);
            alert(err.response?.data?.message || '초대 중 오류가 발생했습니다.');
        } finally {
            setIsInviting(false);
        }
    };

    const stop = (e) => e.stopPropagation();

    return (
        <div className="modal-backdrop" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={stop}>
                <h3>[{currentRoomId}]에 인원 초대</h3>

                <input
                    type="text"
                    value={inviteeUsername}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="초대할 사용자 이름(USERNAME) 검색"
                    disabled={isInviting}
                />

                <div className="search-results-wrap">
                    {isSearching && <div className="loading-indicator">검색 중...</div>}
                    {!isSearching && searchError && (
                        <div className="search-error">{searchError}</div>
                    )}
                    {!isSearching &&
                        !searchError &&
                        inviteeUsername.trim().length >= 2 &&
                        searchResults.length === 0 && (
                            <div className="search-empty">검색 결과가 없습니다.</div>
                        )}
                    {searchResults.length > 0 && (
                        <ul className="search-results-list">
                            {searchResults.map((user) => (
                                <li
                                    key={String(user.USER_ID)}
                                    onClick={() => handleUserSelect(user)}
                                >
                                    {user.USERNAME} {user.NICKNAME ? `(${user.NICKNAME})` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="modal-actions">
                    <button onClick={() => onClose(false)} disabled={isInviting}>
                        취소
                    </button>
                    <button onClick={handleInviteUser} disabled={isInviting || !inviteeId}>
                        {isInviting ? '초대 중...' : `초대 (${inviteeUsername || '선택 필요'})`}
                    </button>
                </div>
            </div>
        </div>
    );
}