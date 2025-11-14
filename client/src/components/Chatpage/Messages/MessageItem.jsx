// ...

// (서버 URL. .env 파일 등에서 관리하는 것이 좋음)
const SERVER_BASE_URL = 'http://localhost:1337'; 

export default function MessageItem({ message, isMine }) {
    const { nickname, CONTENT, SENT_AT, MESSAGE_TYPE, FILE_URL, FILE_NAME } = message;

    const renderMessageContent = () => {
        if (MESSAGE_TYPE === 'FILE') {
            // [파일] DB에 저장된 fileURL과 fileName을 사용해 다운로드 링크 생성
            // 4단계에서 설정한 정적 경로(/uploads)와 조합
            const downloadUrl = `${SERVER_BASE_URL}${FILE_URL}`;

            return (
                <div className="file-message">
                    <a href={downloadUrl} download={FILE_NAME} target="_blank" rel="noopener noreferrer">
                        {/* (아이콘 같은 것을 넣으면 더 좋습니다) */}
                        <strong>📄 {FILE_NAME || '파일 다운로드'}</strong>
                    </a>
                </div>
            );
        }

        // [텍스트] (기존 로직)
        return <div className="text-message">{CONTENT}</div>;
    };

    return (
        <div className={`message-item ${isMine ? 'mine' : 'other'}`}>
            {!isMine && <div className="sender-nickname">{nickname}</div>}
            <div className="message-bubble">
                {renderMessageContent()}
            </div>
            <span className="timestamp">{new Date(SENT_AT).toLocaleTimeString()}</span>
        </div>
    );
}