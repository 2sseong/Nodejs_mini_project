// src/components/Chatpage/Input/MessageInput.jsx
import { useState, useRef } from 'react';
import './MessageInput.css';

export default function MessageInput({ onSend, onSendFile, disabled }) {
    const [text, setText] = useState('');
    // 숨겨진 file input에 접근하기 위한 ref
    const fileInputRef = useRef(null);

    const trySendText = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t); // 텍스트 메시지 전송
        setText('');
    };

    // 파일 버튼 클릭 시
    const handleFileButtonClick = () => {
        fileInputRef.current.click();
    };

    // 파일이 선택되었을 때
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // FileReader를 사용해 파일을 Base64로 인코딩
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // 부모 컴포넌트(ChatPage)로 파일 데이터 전송
            onSendFile({
                fileName: file.name,
                mimeType: file.type,
                fileData: reader.result, // Base64 인코딩된 데이터
            });
        };
        reader.onerror = (error) => {
            console.error('File reading error:', error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        };

        // 같은 파일을 다시 선택할 수 있도록 input 값 초기화
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
                +
            </button>

            {/* 숨겨진 파일 입력 */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {/* 텍스트 입력 */}
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && trySendText()}
                placeholder="메시지를 입력하세요..."
                disabled={disabled}
            />

            {/* 텍스트 전송 버튼 */}
            <button onClick={trySendText} disabled={disabled || text.trim().length === 0}>
                보내기
            </button>
        </div>
    );
}