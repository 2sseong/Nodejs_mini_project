// src/components/Room/RoomList/RoomItem.jsx
import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../Chatpage/Modals/ConfirmModal';

const API_BASE_URL = 'http://localhost:1337';

/**
 * 개별 채팅방 아이템 컴포넌트
 */
export default function RoomItem({ room, active, onClick, onLeaveRoom, onToggleNotification }) {
    const [contextMenu, setContextMenu] = useState(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    // 시간 포맷
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    // 프로필 이미지 URL 생성
    const getProfileUrl = (profilePic) => {
        if (!profilePic) return null;
        if (profilePic.startsWith('http')) return profilePic;
        return `${API_BASE_URL}${profilePic.startsWith('/') ? '' : '/'}${profilePic}`;
    };

    // 우클릭 메뉴 핸들러
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.pageX, y: e.pageY });
    };

    // 클릭 시 컨텍스트 메뉴 닫기
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // 나가기 클릭
    const handleLeaveClick = () => {
        setContextMenu(null);
        setIsLeaveModalOpen(true);
    };

    // 나가기 확인
    const handleConfirmLeave = () => {
        setIsLeaveModalOpen(false);
        if (onLeaveRoom) {
            onLeaveRoom(room.ROOM_ID);
        }
    };

    // 멤버 프로필 렌더링 (최대 4개)
    const renderAvatarGrid = () => {
        const profiles = room.MEMBER_PROFILES || [];
        const count = profiles.length;

        if (count === 0) {
            // 프로필 없으면 기본 아이콘
            return (
                <div className="avatar-single">
                    <i className="bi bi-chat-dots-fill"></i>
                </div>
            );
        }

        if (count === 1) {
            // 1명
            const profile = profiles[0];
            return (
                <div className="avatar-single">
                    {profile.PROFILE_PIC ? (
                        <img src={getProfileUrl(profile.PROFILE_PIC)} alt={profile.NICKNAME} />
                    ) : (
                        <span className="avatar-initial">{profile.NICKNAME?.charAt(0) || '?'}</span>
                    )}
                </div>
            );
        }

        if (count === 2) {
            // 2명
            return (
                <div className="avatar-grid-2">
                    {profiles.slice(0, 2).map((p, i) => (
                        <div key={p.USER_ID || i} className="avatar-item">
                            {p.PROFILE_PIC ? (
                                <img src={getProfileUrl(p.PROFILE_PIC)} alt={p.NICKNAME} />
                            ) : (
                                <span className="avatar-initial">{p.NICKNAME?.charAt(0) || '?'}</span>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        if (count === 3) {
            // 3명 (1 + 2 레이아웃)
            return (
                <div className="avatar-grid-3">
                    <div className="avatar-item top">
                        {profiles[0].PROFILE_PIC ? (
                            <img src={getProfileUrl(profiles[0].PROFILE_PIC)} alt={profiles[0].NICKNAME} />
                        ) : (
                            <span className="avatar-initial">{profiles[0].NICKNAME?.charAt(0) || '?'}</span>
                        )}
                    </div>
                    <div className="avatar-bottom-row">
                        {profiles.slice(1, 3).map((p, i) => (
                            <div key={p.USER_ID || i} className="avatar-item">
                                {p.PROFILE_PIC ? (
                                    <img src={getProfileUrl(p.PROFILE_PIC)} alt={p.NICKNAME} />
                                ) : (
                                    <span className="avatar-initial">{p.NICKNAME?.charAt(0) || '?'}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // 4명 이상 (2x2 그리드)
        return (
            <div className="avatar-grid-4">
                {profiles.slice(0, 4).map((p, i) => (
                    <div key={p.USER_ID || i} className="avatar-item">
                        {p.PROFILE_PIC ? (
                            <img src={getProfileUrl(p.PROFILE_PIC)} alt={p.NICKNAME} />
                        ) : (
                            <span className="avatar-initial">{p.NICKNAME?.charAt(0) || '?'}</span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <li
                className={`room-item ${active ? 'active' : ''}`}
                onClick={() => onClick(room.ROOM_ID)}
                onContextMenu={handleContextMenu}
            >
                {/* 방 아바타 */}
                <div className="room-avatar">
                    {renderAvatarGrid()}
                </div>

                {/* 방 정보 */}
                <div className="room-info">
                    <div className="room-name-row">
                        <span className="room-name">
                            {room.ROOM_NAME || '채팅방'}
                        </span>
                        {room.MEMBER_COUNT > 1 && (
                            <span className="member-count">{room.MEMBER_COUNT}</span>
                        )}
                        {room.NOTIFICATION_ENABLED === 0 && (
                            <i className="bi bi-bell-slash notification-off-icon" title="알림 꺼짐"></i>
                        )}
                    </div>
                    <span className="room-last-message">
                        {room.LAST_MESSAGE || '대화를 시작하세요'}
                    </span>
                </div>

                {/* 메타 정보 */}
                <div className="room-meta">
                    <span className="room-time">
                        {formatTime(room.LAST_MESSAGE_TIME)}
                    </span>
                    {room.UNREAD_COUNT > 0 && (
                        <span className="room-badge">
                            {room.UNREAD_COUNT > 99 ? '99+' : room.UNREAD_COUNT}
                        </span>
                    )}
                </div>
            </li>

            {/* 우클릭 컨텍스트 메뉴 */}
            {contextMenu && (
                <div
                    className="room-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
                >
                    <button onClick={() => {
                        setContextMenu(null);
                        if (onToggleNotification) {
                            onToggleNotification(room.ROOM_ID, room.NOTIFICATION_ENABLED !== 0);
                        }
                    }}>
                        <i className={`bi ${room.NOTIFICATION_ENABLED === 0 ? 'bi-bell' : 'bi-bell-slash'}`}></i>
                        {room.NOTIFICATION_ENABLED === 0 ? ' 알림 켜기' : ' 알림 끄기'}
                    </button>
                    <button className="danger-text" onClick={handleLeaveClick}>
                        <i className="bi bi-box-arrow-right"></i> 나가기
                    </button>
                </div>
            )}

            {/* 나가기 확인 모달 */}
            <ConfirmModal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                onConfirm={handleConfirmLeave}
                title="채팅방 나가기"
                message={`'${room.ROOM_NAME || '채팅방'}'에서 나가시겠습니까?`}
                confirmText="나가기"
                isDanger={true}
            />
        </>
    );
}
