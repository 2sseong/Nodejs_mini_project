// src/components/Roompage/Sidebar/RoomListItem.jsx
import React from 'react';

/**
 * 개별 채팅방 아이템 컴포넌트
 * - 구조: [방 이름(인원수) + 최근 메시지] 좌측, [안 읽은 배지] 우측
 */
export default function RoomListItem({ room, active, onClick }) {
    return (
        <li
            className={`room-item ${active ? 'active' : ''}`}
            onClick={() => onClick(room.ROOM_ID)}
            style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 15px',
                cursor: 'pointer'
            }}
        >
            <div className="room-info" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden', 
                flex: 1,
                marginRight: '10px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '4px',
                    width: '100%'
                }}>
                    <span className="room-name" style={{ 
                        fontWeight: 'bold', 
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '80%'
                    }}>
                        {room.ROOM_NAME || '채팅방'}
                    </span>
                    
                    {/* 인원 수 표시 (데이터가 있을 경우에만 렌더링, 없으면 기본값 1 처리 혹은 숨김) */}
                    <span className="member-count" style={{
                        fontSize: '0.8em',
                        color: active ? '#e6f7ff' : '#999',
                        marginLeft: '6px',
                        flexShrink: 0
                    }}>
                        {room.MEMBER_COUNT || 1}
                    </span>
                </div>

                <span className="room-last-message" style={{ 
                    fontSize: '0.85em', 
                    color: active ? '#e6f7ff' : '#888',
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                }}>
                    {room.LAST_MESSAGE || '대화 내용이 없습니다.'}
                </span>
            </div>

            {/* 안 읽은 메시지 카운트 */}
            {room.UNREAD_COUNT > 0 && (
                <div className="unread-badge" style={{
                    backgroundColor: '#ff4d4f',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '0 6px',
                    fontSize: '0.75rem',
                    height: '20px',
                    minWidth: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                }}>
                    {room.UNREAD_COUNT > 99 ? '99+' : room.UNREAD_COUNT}
                </div>
            )}
        </li>
    );
}