// src/components/Room/Sidebar/ChatSidebar.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
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
    const searchInputRef = useRef(null);

    // 검색어 필터링
    const filteredRooms = useMemo(() => {
        if (!searchTerm.trim()) return rooms;
        const lowerTerm = searchTerm.toLowerCase();
        return rooms.filter((room) =>
            (room.ROOM_NAME || '').toLowerCase().includes(lowerTerm)
        );
    }, [rooms, searchTerm]);

    const handleToggleSearch = () => {
        setIsSearchOpen(prev => !prev);
        if (isSearchOpen) setSearchTerm('');
    };

    // Ctrl+F 키보드 단축키 핸들러
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (!isSearchOpen) {
                    setIsSearchOpen(true);
                }
                // 다음 렌더링 후 포커스
                setTimeout(() => searchInputRef.current?.focus(), 0);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen]);

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3>채팅</h3>
            </div>

            <div className="connection-status">
                <span className={connected ? 'connected' : 'disconnected'}>
                    {connected ? '● 연결됨' : '○ 연결 끊김'}
                </span>
            </div>

            {/* 기능 버튼 영역 */}
            <div className="sidebar-actions">
                <button
                    className="icon-btn search-btn"
                    onClick={handleToggleSearch}
                    title="채팅방 검색 (Ctrl+F)"
                >
                    <i className="bi bi-search"></i>
                </button>
                <button
                    className="icon-btn create-room-btn"
                    onClick={onOpenCreateModal}
                    title="새 채팅방"
                >
                    <i className="bi bi-plus-lg"></i>
                </button>
            </div>

            {/* 검색창 */}
            {isSearchOpen && (
                <div className="search-container">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="채팅방 검색..."
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
                        {searchTerm ? '검색 결과 없음' : '채팅방이 없습니다'}
                    </li>
                )}
            </ul>
        </div>
    );
}