import React, { useState, useRef, useEffect } from 'react';
import './ChatHeader.css';

export default function ChatHeader({ 
    title, 
    onOpenInvite, 
    disabled, 
    onLeaveRoom,
    // 검색 관련 props 추가
    onSearch,      // (keyword) => void
    onNextMatch,   // () => void (아래/다음)
    onPrevMatch,   // () => void (위/이전)
    matchCount,    // number (총 매칭 수)
    currentMatchIdx // number (현재 매칭 순번, 1-based)
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const searchInputRef = useRef(null);

    // 검색 바 열릴 때 input에 포커스
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    const toggleSearch = () => {
        if (isSearchOpen) {
            // 닫을 때 검색어 초기화
            setIsSearchOpen(false);
            setKeyword('');
            onSearch('');
        } else {
            setIsSearchOpen(true);
        }
    };

    const handleSearchChange = (e) => {
        setKeyword(e.target.value);
        onSearch(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // 엔터키 누르면 '위로(이전 대화)' 검색이 국룰 (Shift+Enter는 아래로 등 커스텀 가능)
            if (e.shiftKey) {
                onNextMatch();
            } else {
                onPrevMatch();
            }
        }
    };

    return (
        <div className="chat-header-container">
            {/* 1. 메인 헤더 (제목 + 버튼들) */}
            <div className="chat-header-main">
                <h2>{title || '채팅방'}</h2>

                <div className="chat-header-buttons">
                    {/* 검색 토글 버튼 */}
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
                        onClick={onLeaveRoom}
                        title="방 나가기"
                    >
                        나가기
                    </button>
                </div>
            </div>

            {/* 2. 하단 검색 바 (조건부 렌더링) */}
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
        </div>
    );
}