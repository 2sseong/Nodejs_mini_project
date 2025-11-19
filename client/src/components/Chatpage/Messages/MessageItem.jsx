// src/components/Chatpage/Messages/MessageItem.jsx

export default function MessageItem(props) {

    // 1. [핵심] props를 개별적으로 받음 (message 객체 X)
    const {
        mine,
        nickname,
        sentAt,
        content,
        messageType,
        fileUrl,
        fileName,
        unreadCount
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

        // 0보다 크면 숫자, 0 이하면 빈 문자열
        const displayCount = unreadCount > 0 ? unreadCount : null;
    return (
        // (CSS에 .theirs 대신 .other를 사용했다면 .theirs -> .other로 수정)
        <div className={`message-item ${mine ? 'mine' : 'theirs'}`}>
            {!mine && <div className="sender-nickname">{nickname}</div>}

            <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`}>
                {renderMessageContent()}
            </div>

            {/* * 내가 보낸 메시지(mine)이고, 
              * 표시할 숫자(displayCount)가 있을 때만 <span.unread-count>를 표시
            */}
            {displayCount && (
                <span className="unread-count">
                    {displayCount}
                </span>
            )}

            <span className="timestamp">
                {sentAt ? new Date(sentAt).toLocaleTimeString() : ''}
            </span>
        </div>
    );
}