// src/components/Room/Sidebar/RoomListItem.jsx
import React from 'react';

/**
 * 개별 채팅방 아이템 컴포넌트 (카카오톡 스타일)
 */
export default function RoomListItem({ room, active, onClick }) {
    // 방 이름에서 첫 글자 추출
    const getInitial = (name) => {
        return name ? name.charAt(0).toUpperCase() : '#';
    };

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

    return (
        <li
            className={`room-item ${active ? 'active' : ''}`}
            onClick={() => onClick(room.ROOM_ID)}
        >
            {/* 방 아바타 */}
            <div className="room-avatar">
                <i className="bi bi-chat-dots-fill"></i>
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
    );
}