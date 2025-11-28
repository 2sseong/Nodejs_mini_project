// src/components/Chatpage/Header/ChatHeader.jsx
import React, { useState, useRef, useEffect } from 'react';
import ConfirmModal from '../Modals/ConfirmModal'; // [추가] 모달 import
import './ChatHeader.css';

export default function ChatHeader({ 
    title, 
    onOpenInvite, 
    disabled, 
    onLeaveRoom, 
    // 검색 관련 props
    onSearch,      
    onNextMatch,   
    onPrevMatch,   
    matchCount,    
    currentMatchIdx 
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const searchInputRef = useRef(null);

    // [변경] 나가기 '모달' 상태와 '로딩' 상태 분리
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    // 검색 바 열릴 때 input에 포커스
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    const toggleSearch = () => {
        if (isSearchOpen) {
            setIsSearchOpen(false);
            setKeyword('');
            if (onSearch) onSearch('');
        } else {
            setIsSearchOpen(true);
        }
    };

    const handleSearchChange = (e) => {
        setKeyword(e.target.value);
        if (onSearch) onSearch(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                if (onNextMatch) onNextMatch();
            } else {
                if (onPrevMatch) onPrevMatch();
            }
        }
    };

    // 1. 나가기 버튼 클릭 시 -> 모달만 오픈
    const handleLeaveClick = () => {
        if (disabled || isLeaving) return;
        setIsLeaveModalOpen(true);
    };

    // 2. 모달에서 '나가기' 확정 클릭 시 -> 실제 로직 수행
    const handleConfirmLeave = async () => {
        setIsLeaving(true); // 로딩 시작 (모달 버튼 비활성화)

        try {
            await onLeaveRoom(); // API 호출
            
            // 성공 시: 모달 닫기
            setIsLeaveModalOpen(false);
            
            // 성공 알림은 여기서 띄워도 안전함 (이미 상태 업데이트 됨)
            // 상위 컴포넌트에서 페이지를 닫거나 이동시키므로 alert가 필수는 아님
        } catch (error) {
            console.error('방 나가기 실패:', error);
            
            // 실패 시: 로딩 끄고 모달 닫기 (또는 모달 유지하고 에러 표시)
            setIsLeaving(false);
            setIsLeaveModalOpen(false); 
            
            const errMsg = error.response?.data?.message || '오류가 발생했습니다.';
            alert(errMsg); // 에러 알림
        } finally {
            // 안전 장치: 컴포넌트가 언마운트 되지 않았다면 로딩 끄기
            setIsLeaving(false);
        }
    };

    return (
        <div className="chat-header-container">
            {/* 1. 메인 헤더 */}
            <div className="chat-header-main">
                <h2>{title || '채팅방'}</h2>

                <div className="chat-header-buttons">
                    <button 
                        className={`search-toggle-btn ${isSearchOpen ? 'active' : ''}`}
                        onClick={toggleSearch}
                        title="대화 내용 검색"
                        disabled={disabled}
                    >
                        🔍
                    </button>

                    <button
                        className="invite-user-btn"
                        onClick={onOpenInvite}
                        title="인원 초대"
                        disabled={disabled}
                    >
                        + 초대
                    </button>

                    <button
                        className="leave-room-btn" 
                        onClick={handleLeaveClick}
                        title="방 나가기"
                        disabled={disabled}
                        style={{ 
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.7 : 1
                        }}
                    >
                        나가기
                    </button>
                </div>
            </div>

            {/* 2. 하단 검색 바 */}
            {isSearchOpen && (
                <div className="chat-search-bar">
                    <div className="search-input-wrapper">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="대화 내용 검색"
                            value={keyword}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                        />
                        <span className="search-count">
                            {matchCount > 0 ? `${currentMatchIdx + 1}/${matchCount}` : '0/0'}
                        </span>
                    </div>
                    
                    <div className="search-nav-buttons">
                        <button onClick={onPrevMatch} title="이전(위) 내용">▲</button>
                        <button onClick={onNextMatch} title="다음(아래) 내용">▼</button>
                    </div>
                    
                    <button className="search-close-btn" onClick={toggleSearch}>닫기</button>
                </div>
            )}

            {/* 3. [추가] 나가기 확인 모달 */}
            <ConfirmModal
                isOpen={isLeaveModalOpen}
                title="방 나가기"
                message={`'${title}' 방을 정말 나가시겠습니까? \n나가시면 대화 내용 확인이 불가능할 수 있습니다.`}
                confirmText="나가기"
                isDanger={true} // 빨간 버튼
                isLoading={isLeaving}
                onClose={() => !isLeaving && setIsLeaveModalOpen(false)}
                onConfirm={handleConfirmLeave}
            />
        </div>
    );
}