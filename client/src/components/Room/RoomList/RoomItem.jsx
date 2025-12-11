// src/components/Room/RoomList/RoomItem.jsx
import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../Chatpage/Modals/ConfirmModal';

const API_BASE_URL = 'http://localhost:1337';

/**
 * 개별 채팅방 아이템 컴포넌트
 */
export default function RoomItem({ room, active, onClick, currentUser, onLeaveRoom, onToggleNotification }) {
    const [contextMenu, setContextMenu] = useState(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    // [추가/수정] 채팅방 이름을 동적으로 결정하는 로직
    const getRoomDisplayName = () => {

        const storedName = room.ROOM_NAME;

        // 1. 현재 사용자 ID를 String으로 안전하게 준비
        const currentUserIdString = String(currentUser?.userId);

        // 2. 1:1 채팅방 (1_TO_1)인지 확인
        if (room.ROOM_TYPE === '1_TO_1' && currentUser && room.MEMBER_PROFILES?.length === 2) {

            // --- 2-1. 상대방 찾기 (핵심 로직) ---
            // MEMBER_PROFILES에서 현재 사용자의 ID와 일치하지 않는 프로필을 찾습니다.
            const otherUser = room.MEMBER_PROFILES.find(
                (profile) => String(profile.USER_ID) !== currentUserIdString
            );

            if (otherUser) {
                // --- 2-2. 동적 이름 표시 조건 확인 ---

                // A. 저장된 이름이 NULL인 경우 (이전 데이터)
                if (storedName === null) {
                    return otherUser.NICKNAME;
                }

                // B. 저장된 이름이 기본 이름 패턴인 경우 (현재 데이터: "XXX님과의 대화")
                // storedName이 null이 아니므로 .match()를 안전하게 호출
                const isDefaultPattern = storedName?.match(/^(.+)님과의 대화$/);

                if (isDefaultPattern) {
                    // 기본 이름 패턴이라면, 저장된 이름을 무시하고 상대방 닉네임을 반환
                    return `${otherUser.NICKNAME}님과의 대화`;
                }

                // C. 저장된 이름이 NULL도 아니고 기본 이름 패턴도 아니면, 사용자 지정 이름으로 간주하고 그대로 반환
                return storedName;
            }
        }

        // 3. 그룹 채팅이거나, 1:1인데 멤버를 못 찾은 경우, 또는 기본값이 저장된 경우
        if (storedName) {
            return storedName;
        }

        // 4. 최종 예외 처리
        return '채팅방';
    };

    const roomDisplayName = getRoomDisplayName(); // 동적 이름 계산   

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
                            {/* {room.ROOM_NAME || '채팅방'} */}
                            {/* DB 값 대신 동적으로 계산된 이름을 사용 */}
                            {roomDisplayName}
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
