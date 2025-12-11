import React, { useState, useRef, useEffect } from 'react';
import ConfirmModal from '../Modals/ConfirmModal';
import './ChatHeader.css';

export default function ChatHeader({
    title,
    memberCount,
    onOpenInvite,
    onOpenDrawer,
    onOpenNotices,
    disabled,
    onLeaveRoom,
    onSearch,
    onNextMatch,
    onPrevMatch,
    matchCount,
    currentMatchIdx,
    onToggleMemberPanel,
    isRoomNotificationEnabled,
    onToggleRoomNotification,
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const searchInputRef = useRef(null);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: ''
    });

    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (!isSearchOpen) {
                    setIsSearchOpen(true);
                }
                setTimeout(() => searchInputRef.current?.focus(), 0);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isSearchOpen]);

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

    const handleSearchChange = (e) => {
        setKeyword(e.target.value);
        if (onSearch) onSearch(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                if (onPrevMatch) onPrevMatch();
            } else {
                if (onNextMatch) onNextMatch();
            }
        }
    };

    const handleLeaveClick = () => {
        if (disabled || isLeaving) return;
        setIsLeaveModalOpen(true);
    };

    const closeAlert = () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
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
            setAlertModal({
                isOpen: true,
                title: '오류 발생',
                message: errMsg
            });
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="chat-header-container">
            {/* 메인 헤더 */}
            <div className="chat-header-main">
                <div className="chat-header-info" onClick={onToggleMemberPanel} style={{ cursor: 'pointer' }}>
                    <h2 className="room-title">
                        {title || '채팅방'}

                    </h2>
                    {memberCount > 0 && (
                        <span className="member-count">참여자 {memberCount}명</span>
                    )}
                </div>

                <div className="chat-header-buttons">
                    {/* 채팅방 알림 켜기/끄기 */}
                    <button
                        className={`notification-toggle-btn ${isRoomNotificationEnabled ? 'enabled' : 'disabled'}`}
                        onClick={onToggleRoomNotification}
                        title={isRoomNotificationEnabled ? '알림 끄기' : '알림 켜기'}
                        disabled={disabled}
                    >
                        <i className={`bi ${isRoomNotificationEnabled ? 'bi-bell-fill' : 'bi-bell-slash'}`}></i>
                    </button>

                    <button
                        className={`search-toggle-btn ${isSearchOpen ? 'active' : ''}`}
                        onClick={toggleSearch}
                        title="대화 내용 검색"
                        disabled={disabled}
                    >
                        <i className="bi bi-search"></i>
                    </button>

                    <div className="menu-container" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="menu-toggle-btn"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            disabled={disabled}
                            title="메뉴"
                        >
                            <i className="bi bi-list"></i>
                        </button>

                        {isMenuOpen && (
                            <div className="header-dropdown">
                                <button onClick={() => { setIsMenuOpen(false); onOpenInvite(); }}>
                                    <i className="bi bi-person-plus"></i> 초대하기
                                </button>
                                <button onClick={() => { setIsMenuOpen(false); onOpenDrawer(); }}>
                                    <i className="bi bi-folder2-open"></i> 채팅방 서랍
                                </button>
                                <button onClick={() => { setIsMenuOpen(false); if (onOpenNotices) onOpenNotices(); }}>
                                    <i className="bi bi-megaphone"></i> 공지 목록
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

            {/* 검색 바 */}
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
                        <button onClick={onPrevMatch} title="이전(위) 내용"><i className="bi bi-chevron-up"></i></button>
                        <button onClick={onNextMatch} title="다음(아래) 내용"><i className="bi bi-chevron-down"></i></button>
                    </div>

                    <button className="search-close-btn" onClick={toggleSearch}>닫기</button>
                </div>
            )}

            {/* 나가기 확인 모달 */}
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

            {/* 에러 알림 모달 */}
            <ConfirmModal
                isOpen={alertModal.isOpen}
                onClose={closeAlert}
                onConfirm={closeAlert}
                title={alertModal.title}
                message={alertModal.message}
                confirmText="확인"
                cancelText={null}
            />
        </div>
    );
}