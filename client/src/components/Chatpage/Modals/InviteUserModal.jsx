// src/components/Chatpage/Modals/InviteUserModal.jsx
import { useEffect, useRef, useState } from 'react';
import './Modals.css';
import { apiSearchUsers, apiInviteUser } from '../../../api/roomApi';
import ConfirmModal from './ConfirmModal'; // ConfirmModal import

export default function InviteUserModal({
    isOpen,
    onClose,
    currentRoomId,
    userId,
}) {
    const [inviteeId, setInviteeId] = useState('');
    const [inviteeUsername, setInviteeUsername] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    
    // [추가] ConfirmModal 상태 관리
    const [confirmModalState, setConfirmModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        isSuccess: false, // 성공 여부에 따라 닫기 동작 분기
    });

    const abortRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setInviteeId('');
            setInviteeUsername('');
            setSearchResults([]);
            setSearchError('');
            setIsSearching(false);
            setIsInviting(false);
            // 모달 상태 초기화
            setConfirmModalState({ isOpen: false, title: '', message: '', isSuccess: false });

            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        }
    }, [isOpen]);

    if (!isOpen || !currentRoomId) return null;

    const handleSearchUsers = (input) => {
        const q = input.trim();
        setInviteeUsername(input);
        setSearchError('');

        if (q.length < 2) {
            if (abortRef.current) abortRef.current.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
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
                const resp = await apiSearchUsers(q, abortRef.current.signal);
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

    // ConfirmModal 닫기 핸들러
    const closeConfirmModal = () => {
        // 성공했다면 InviteUserModal도 함께 닫음
        if (confirmModalState.isSuccess) {
            onClose(true);
        }
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
    };

    const handleInviteUser = async () => {
        if (isInviting || !currentRoomId || !inviteeId) {
             // [추가] 필수 값 누락 시에도 모달로 알림
            if (!inviteeId && !isInviting) {
                 setConfirmModalState({
                    isOpen: true,
                    title: '알림',
                    message: '초대할 사용자를 선택해주세요.',
                    isSuccess: false
                });
            }
            return;
        }

        if (inviteeId === String(userId)) {
            // [변경] alert -> ConfirmModal
             setConfirmModalState({
                isOpen: true,
                title: '초대 불가',
                message: '자기 자신을 초대할 수 없습니다.',
                isSuccess: false
            });
            return;
        }

        setIsInviting(true);
        try {
            const res = await apiInviteUser(
                String(currentRoomId),
                userId,
                inviteeId
            );

            if (res.data?.success) {
                console.log(`${inviteeUsername} 님을 성공적으로 초대했습니다.`);
                // [변경] 성공 모달 표시
                setConfirmModalState({
                    isOpen: true,
                    title: '초대 완료',
                    message: '사용자를 성공적으로 초대했습니다.',
                    isSuccess: true
                });
            } else {
                 // [변경] 실패 모달 표시
                setConfirmModalState({
                    isOpen: true,
                    title: '초대 실패',
                    message: res.data?.message || '알 수 없는 오류가 발생했습니다.',
                    isSuccess: false
                });
            }
        } catch (err) {
            console.error('Invite failed:', err.response?.data || err.message);
             // [변경] 에러 모달 표시
            setConfirmModalState({
                isOpen: true,
                title: '오류 발생',
                message: err.response?.data?.message || '초대 중 오류가 발생했습니다.',
                isSuccess: false
            });
        } finally {
            setIsInviting(false);
        }
    };

    const stop = (e) => e.stopPropagation();

    return (
        <>
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

            {/* ConfirmModal 렌더링 */}
            <ConfirmModal
                isOpen={confirmModalState.isOpen}
                onClose={closeConfirmModal}
                onConfirm={closeConfirmModal} // 확인 버튼 누르면 닫기 (성공 시 InviteUserModal도 닫힘)
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText="확인"
                // 취소 버튼을 숨기고 싶다면 ConfirmModal 수정 필요 (현재는 기본적으로 보임)
                // 단순히 알림 용도라면 취소 버튼 없이 확인 버튼만 있어도 됨 -> ConfirmModal props 확인 필요
                 // 여기서는 취소 버튼을 숨기기 위해 cancelText를 null로 주거나 ConfirmModal 로직에 따름
                 // 만약 ConfirmModal이 cancelText가 없으면 버튼을 안 그리게 되어 있다면 아래처럼:
                 cancelText={null} 
            />
        </>
    );
}