// src/components/Roompage/Sidebar/RoomListItem.jsx
import React from 'react';

/**
 * 개별 채팅방 아이템 컴포넌트
 * - 구조: [방 이름 + 최근 메시지] 좌측 정렬, [안 읽은 배지] 우측 정렬
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
                padding: '10px 15px',
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
                <span className="room-name" style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {room.ROOM_NAME || '채팅방'}
                </span>
                <span className="room-last-message" style={{ 
                    fontSize: '0.85em', 
                    color: active ? '#e6f7ff' : '#888', // 활성화 시 텍스트 색상 조정
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                }}>
                    {room.LAST_MESSAGE || '대화 내용이 없습니다.'}
                </span>
            </div>

            {/* 안 읽은 메시지 카운트 (0보다 클 때만 표시) */}
            {room.UNREAD_COUNT > 0 && (
                <div className="unread-badge" style={{
                    backgroundColor: '#ff4d4f', // 붉은색 계열 (알림 강조)
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