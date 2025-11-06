// src/components/Chatpage/Header/ChatHeader.jsx
import './ChatHeader.css';

export default function ChatHeader({ title, onOpenInvite, disabled }) {
    return (
        <div className="chat-header">
            <h2>{title || '채팅방'}</h2>
            <button
                className="invite-user-btn"
                onClick={onOpenInvite}
                title="인원 초대"
                disabled={disabled}
            >
                + 초대
            </button>
        </div>
    );
}