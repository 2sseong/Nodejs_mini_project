// src/components/Chatpage/Input/MessageInput.jsx
import { useState, useRef, useEffect } from 'react';
import './MessageInput.css';

export default function MessageInput({ onSend, onSendFile, disabled }) {
    const [text, setText] = useState('');
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const trySendText = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setText('');
    };

    // 키보드 핸들러: Enter=전송, Shift+Enter=줄바꿈
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            trySendText();
        }
        // Shift+Enter는 기본 동작(줄바꿈)이 됨
    };

    // textarea 높이 자동 조절
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            // 최대 5줄 높이로 제한 (약 100px)
            textareaRef.current.style.height = Math.min(scrollHeight, 100) + 'px';
        }
    }, [text]);

    const handleFileButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            onSendFile({
                fileName: file.name,
                mimeType: file.type,
                fileData: reader.result,
            });
        };
        reader.onerror = (error) => {
            console.error('File reading error:', error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        };

        e.target.value = null;
    };

    return (
        <div className="input-area">
            {/* 파일 선택 버튼 */}
            <button
                onClick={handleFileButtonClick}
                disabled={disabled}
                className="file-upload-btn"
            >
                <i className="bi bi-plus-lg"></i>
            </button>

            {/* 숨겨진 파일 입력 */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {/* 텍스트 입력 (textarea로 변경) */}
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                disabled={disabled}
                rows={1}
            />

            {/* 텍스트 전송 버튼 */}
            <button onClick={trySendText} disabled={disabled || text.trim().length === 0}>
                <i className="bi bi-send-fill"></i>
            </button>
        </div>
    );
}