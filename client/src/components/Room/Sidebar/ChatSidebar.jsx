// src/components/Roompage/Sidebar/ChatSidebar.jsx
import { useState, useMemo } from 'react';
import RoomListItem from './RoomListItem.jsx';
import './ChatSidebar.css';

export default function ChatSidebar({
    connected,
    rooms,
    currentRoomId,
    onSelectRoom,
    onOpenCreateModal,
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // [최적화] 검색어 필터링: 시간복잡도 O(N), rooms나 searchTerm이 변경될 때만 연산 수행
    const filteredRooms = useMemo(() => {
        if (!searchTerm.trim()) return rooms;
        const lowerTerm = searchTerm.toLowerCase();
        return rooms.filter((room) =>
            (room.ROOM_NAME || '').toLowerCase().includes(lowerTerm)
        );
    }, [rooms, searchTerm]);

    const handleToggleSearch = () => {
        setIsSearchOpen(prev => !prev);
        if (isSearchOpen) setSearchTerm(''); // 닫을 때 검색어 초기화
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3>채팅방 목록</h3>
            </div>

            <div className="connection-status">
                연결 상태:{' '}
                <span className={connected ? 'connected' : 'disconnected'}>
                    {connected ? 'ON' : 'OFF'}
                </span>
            </div>

            {/* 기능 버튼 영역 (검색 / 방 만들기) */}
            <div className="sidebar-actions">
                <button
                    className="icon-btn search-btn"
                    onClick={handleToggleSearch}
                    title="채팅방 검색"
                >
                    <i className="bi bi-search"></i> 검색
                </button>
                <button
                    className="icon-btn create-room-btn"
                    onClick={onOpenCreateModal}
                    title="새 채팅방 만들기"
                >
                    <i className="bi bi-plus-circle"></i> 방 만들기
                </button>
            </div>

            {/* 검색창 (조건부 렌더링) */}
            {isSearchOpen && (
                <div className="search-container">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="채팅방 제목 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
            )}

            <ul className="room-list">
                {filteredRooms.length > 0 ? (
                    filteredRooms.map((room) => (
                        <RoomListItem
                            key={room.ROOM_ID}
                            room={room}
                            active={String(room.ROOM_ID) === String(currentRoomId)}
                            onClick={onSelectRoom}
                        />
                    ))
                ) : (
                    <li className="no-room-message">
                        {searchTerm ? '검색 결과가 없습니다.' : '참여 중인 채팅방이 없습니다.'}
                    </li>
                )}
            </ul>
        </div>
    );
}