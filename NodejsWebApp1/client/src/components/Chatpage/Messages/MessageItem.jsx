// src/components/Chatpage/Messages/MessageItem.jsx
export default function MessageItem({ mine, nickname, sentAt, content }) {
    return (
        <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`}>
            <div className="message-info">
                <span className="message-user">{nickname}</span>
                <span className="message-time">{new Date(sentAt).toLocaleTimeString()}</span>
            </div>
            <div className="message-content">{content}</div>
        </div>
    );
}