// src/components/Chatpage/Messages/MessageList.jsx
import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import './MessageList.css';

export default function MessageList({ messages, userId }) {
    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="message-area">
            {messages.map((m, i) => (
                <MessageItem
                    key={i}
                    mine={m.SENDER_ID === userId}
                    nickname={m.SENDER_ID === userId ? m.NICKNAME : (m.NICKNAME || m.SENDER_ID)}
                    sentAt={m.SENT_AT}
                    content={m.CONTENT || m.text}
                />
            ))}
            <div ref={bottomRef} />
        </div>
    );
}