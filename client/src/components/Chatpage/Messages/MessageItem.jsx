// src/components/Chatpage/Messages/MessageItem.jsx

// (서버 URL. .env 파일 등에서 관리하는 것이 좋음)
// const SERVER_BASE_URL = 'http://localhost:1337'; 

export default function MessageItem(props) {

    // 1. [핵심] props를 개별적으로 받음 (message 객체 X)
    const {
        mine,
        nickname,
        sentAt,
        content,
        messageType,
        fileUrl,
        fileName
    } = props;

    // 2. [핵심] 메시지 타입에 따라 내용 렌더링
    const renderMessageContent = () => {
        if (messageType === 'FILE') {
            // 4단계에서 설정한 정적 경로(/uploads)와 조합
            const downloadUrl = fileUrl;

            return (
                <div className="file-message">
                    {/* 파일을 클릭하면 'fileName'으로 다운로드됩니다. */}
                    <a href={downloadUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                        <strong>📄 {fileName || '파일 다운로드'}</strong>
                    </a>
                </div>
            );
        }

        // [텍스트 메시지] (기존 로직)
        // CSS의 .message-content 클래스 구조를 존중
        return <div className="message-content">{content}</div>;
    };

    // 3. (사용자)의 CSS 구조에 맞춘 JSX 반환
    return (
        // (CSS에 .theirs 대신 .other를 사용했다면 .theirs -> .other로 수정)
        <div className={`message-item ${mine ? 'mine' : 'theirs'}`}>

            {/* CSS 구조(.message-info)를 사용한다면 여기에 닉네임/시간 배치.
              지금은 제공된 CSS 중 .message-bubble 구조만 사용합니다.
            */}
            {!mine && <div className="sender-nickname">{nickname}</div>}

            <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`}>
                {renderMessageContent()}
            </div>

            <span className="timestamp">
                {sentAt ? new Date(sentAt).toLocaleTimeString() : ''}
            </span>
        </div>
    );
}