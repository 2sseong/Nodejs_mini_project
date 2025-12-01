import React, { useState, useRef, useEffect } from 'react';
import ConfirmModal from '../Modals/ConfirmModal';
import './ChatHeader.css';

export default function ChatHeader({ 
    title, 
    memberCount, // [추가] 인원수 props
    onOpenInvite, 
    onOpenDrawer, // [추가] 서랍 열기 핸들러
    disabled, 
    onLeaveRoom, 
    onSearch,      
    onNextMatch,   
    onPrevMatch,   
    matchCount,    
    currentMatchIdx 
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // [추가] 메뉴 드롭다운 상태
    const [keyword, setKeyword] = useState('');
    const searchInputRef = useRef(null);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    // 검색 바 포커스
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    // 외부 클릭 시 메뉴 닫기 (간단 구현)
    useEffect(() => {
        const handleClickOutside = () => setIsMenuOpen(false);
        if (isMenuOpen) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isMenuOpen]);

    const toggleSearch = () => {
        if (isSearchOpen) {
            setIsSearchOpen(false);
            setKeyword('');
            if (onSearch) onSearch('');
        } else {
            setIsSearchOpen(true);
        }
    };

    // 검색 핸들러
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

    const handleLeaveClick = () => {
        if (disabled || isLeaving) return;
        setIsLeaveModalOpen(true);
    };

    const handleConfirmLeave = async () => {
        setIsLeaving(true);
        try {
            await onLeaveRoom(); 
            setIsLeaveModalOpen(false);
        } catch (error) {
            console.error('방 나가기 실패:', error);
            setIsLeaving(false);
            setIsLeaveModalOpen(false); 
            const errMsg = error.response?.data?.message || '오류가 발생했습니다.';
            alert(errMsg);
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="chat-header-container">
            {/* 1. 메인 헤더 */}
            <div className="chat-header-main">
                {/* [수정] 제목 및 인원수 표시 */}
                <div className="chat-header-info">
                    <h2 className="room-title">{title || '채팅방'}</h2>
                    {memberCount > 0 && (
                        <span className="member-count">({memberCount})</span>
                    )}
                </div>

                <div className="chat-header-buttons">
                    <button 
                        className={`search-toggle-btn ${isSearchOpen ? 'active' : ''}`}
                        onClick={toggleSearch}
                        title="대화 내용 검색"
                        disabled={disabled}
                    >
                        🔍
                    </button>

                    {/* [변경] 메뉴 버튼 (기존 초대/나가기 버튼 대체) */}
                    <div className="menu-container" onClick={(e) => e.stopPropagation()}>
                        <button 
                            className="menu-toggle-btn"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            disabled={disabled}
                            title="메뉴"
                        >
                            ☰
                        </button>

                        {/* 드롭다운 메뉴 */}
                        {isMenuOpen && (
                            <div className="header-dropdown">
                                <button onClick={() => { setIsMenuOpen(false); onOpenInvite(); }}>
                                    + 초대하기
                                </button>
                                <button onClick={() => { setIsMenuOpen(false); onOpenDrawer(); }}>
                                    📁 채팅방 서랍
                                </button>
                                <div className="divider"></div>
                                <button onClick={() => { setIsMenuOpen(false); handleLeaveClick(); }} className="danger-text">
                                    나가기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. 하단 검색 바 (기존 유지) */}
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

            {/* 3. 나가기 확인 모달 (기존 유지) */}
            <ConfirmModal
                isOpen={isLeaveModalOpen}
                title="방 나가기"
                message={`'${title}' 방을 정말 나가시겠습니까? \n나가시면 대화 내용 확인이 불가능할 수 있습니다.`}
                confirmText="나가기"
                isDanger={true}
                isLoading={isLeaving}
                onClose={() => !isLeaving && setIsLeaveModalOpen(false)}
                onConfirm={handleConfirmLeave}
            />
        </div>
    );
}