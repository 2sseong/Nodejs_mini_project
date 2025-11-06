// src/components/Chatpage/Sidebar/RoomListItem.jsx
export default function RoomListItem({ room, active, onClick }) {
    return (
        <li
            className={`room-item ${active ? 'active' : ''}`}
            onClick={() => onClick(room.ROOM_ID)}
        >
            {room.ROOM_NAME || `방 이름: ${room.ROOM_NAME}`}
            <span className="room-type">{room.ROOM_TYPE === 'GROUP' ? '👨‍👦‍👦' : '😀'}</span>
        </li>
    );
}