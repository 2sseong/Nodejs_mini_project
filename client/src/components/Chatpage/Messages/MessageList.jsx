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
                    key={m.MSG_ID || i} // 1. Key를 고유 ID로 변경
                    mine={m.SENDER_ID === userId}
                    nickname={m.SENDER_ID === userId ? m.NICKNAME : (m.NICKNAME || m.SENDER_ID)}
                    sentAt={m.SENT_AT}
                    content={m.CONTENT} // 2. '|| m.text' 제거 (파일일 때 CONTENT가 null임)

                    // 3. [핵심] 파일 정보 전달 추가
                    messageType={m.MESSAGE_TYPE}
                    fileUrl={m.FILE_URL}
                    fileName={m.FILE_NAME}
                />
            ))}
            <div ref={bottomRef} />
        </div>
    );
}