// src/components/Chatpage/Sidebar/ChatSidebar.jsx
import RoomListItem from './RoomListItem';
import './ChatSidebar.css';

export default function ChatSidebar({
    userNickname,
    connected,
    rooms,
    currentRoomId,
    onSelectRoom,
    onOpenCreateModal,
}) {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3>참여중인 채팅방</h3>
                <button className="create-room-btn" onClick={onOpenCreateModal} title="새 채팅방 만들기">
                    + 방 만들기
                </button>
            </div>

            <div className="connection-status">
                현재 사용자: <strong>{userNickname}</strong>
            </div>
            <div className="connection-status">
                연결 상태:{' '}
                <span className={connected ? 'connected' : 'disconnected'}>
                    {connected ? 'ON' : 'OFF'}
                </span>
            </div>

            <ul className="room-list">
                {rooms.map((room) => (
                    <RoomListItem
                        key={room.ROOM_ID}
                        room={room}
                        active={String(room.ROOM_ID) === String(currentRoomId)}
                        onClick={onSelectRoom}
                    />
                ))}
            </ul>
        </div>
    );
}