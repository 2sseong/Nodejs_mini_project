// src/components/Chatpage/Input/MessageInput.jsx
import { useState } from 'react';
import './MessageInput.css';

export default function MessageInput({ onSend, disabled }) {
    const [text, setText] = useState('');

    const trySend = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setText('');
    };

    return (
        <div className="input-area">
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && trySend()}
                placeholder="메시지를 입력하세요..."
                disabled={disabled}
            />
            <button onClick={trySend} disabled={disabled || text.trim().length === 0}>
                보내기
            </button>
        </div>
    );
}