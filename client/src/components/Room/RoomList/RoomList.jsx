// src/components/Room/RoomList/RoomList.jsx
import { useState, useMemo, useEffect, useRef } from 'react';
import RoomItem from './RoomItem.jsx';
import './RoomList.css';

export default function RoomList({
    connected,
    rooms,
    currentRoomId,
    onSelectRoom,
    onOpenCreateModal,
    currentUser,
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef(null);

    // 검색어 필터링
    // romm.ROOM_NAME이 NULL일 때 상대방 닉네임으로도 검색되도록 수정 +)
    const filteredRooms = useMemo(() => {
        if (!searchTerm.trim()) return rooms;
        const lowerTerm = searchTerm.toLowerCase();
        // return rooms.filter((room) =>
        //     (room.ROOM_NAME || '').toLowerCase().includes(lowerTerm)
        // ); -- 필터링 수정전 부분 주석처리

        // DB에 NULL값 포함하는 내용을 검색어 필터에 적용하기 위해 수정된 부분 -- 여기부터
        return rooms.filter((room) => {
            // 1. DB에 저장된 이름이 검색어에 포함되는지 확인
            if (room.ROOM_NAME && room.ROOM_NAME.toLowerCase().includes(lowerTerm)) {
                return true;
            }

            // 2. 1:1 채팅이고 DB 이름이 NULL이며, 현재 유저 정보가 있는 경우
            if (room.ROOM_TYPE === 'I_TO_1' && room.ROOM_NAME === null && currentUser && room.MEMBER_PROFILES?.length === 2) {
                // 현재 유저를 제외한 상대방을 찾습니다.
                const otherUser = room.MEMBER_PROFILES.find(
                    (profile) => profile.USER_ID !== currentUser.userId
                );

                // 상대방 닉네임으로 검색되는지 확인
                if (otherUser && otherUser.NICKNAME?.toLowerCase().includes(lowerTerm)) {
                    return true;
                }
            }

            return false;
        });
        // --여기까지
    }, [rooms, searchTerm, currentUser]); // currentUser 추가

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
                        <RoomItem
                            key={room.ROOM_ID}
                            room={room}
                            active={String(room.ROOM_ID) === String(currentRoomId)}
                            onClick={onSelectRoom}
                            currentUser={currentUser} // RoomItem으로 전달
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
