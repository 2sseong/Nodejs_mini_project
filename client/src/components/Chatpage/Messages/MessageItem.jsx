// src/components/Chatpage/Messages/MessageItem.jsx

import { useRef, useState, useEffect } from "react";

export default function MessageItem(props) {

    // 1. [핵심] props를 개별적으로 받음 (message 객체 X)
    const {
        msgId,
        mine,
        nickname,
        sentAt,
        content,
        messageType,
        fileUrl,
        fileName,
        unreadCount,
        onEdit,   // [추가]
        onDelete,
    } = props;

    const [contextMenu, setContextMenu] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const bubbleRef = useRef(null);

    // 1. 우클릭 핸들러
    const handleContextMenu = (e) => {
        if (!mine || messageType === 'FILE') return; // 파일은 수정 불가, 본인 것만 가능
        e.preventDefault();
        
        // 버블 기준 상대 위치 계산 (혹은 화면 절대 위치 사용)
        // 여기서는 간단히 마우스 클릭 위치(pageX, pageY)를 사용합니다.
        setContextMenu({
            x: e.pageX,
            y: e.pageY
        });
    };
    // 2. 메뉴 닫기 (외부 클릭 감지)
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // 3. 수정/삭제 액션
    const handleClickEdit = () => {
        setIsEditing(true);
        setEditContent(content); // 초기화
    };

    const handleClickDelete = () => {
        if (window.confirm('정말 이 메시지를 삭제하시겠습니까?')) {
            onDelete(msgId);
        }
    };

    const handleSaveEdit = () => {
        if (editContent.trim() !== '') {
            onEdit(msgId, editContent);
            setIsEditing(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditContent(content);
    };

    // 4. 렌더링 로직 수정
    const renderMessageContent = () => {
        if (messageType === 'FILE') {
            const downloadUrl = fileUrl;
            return (
                <div className="file-message">
                    <a href={downloadUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                        <strong>📄 {fileName || '파일 다운로드'}</strong>
                    </a>
                </div>
            );
        }

        // [수정] 수정 모드일 때 입력창 표시
        if (isEditing) {
            return (
                <div className="edit-input-area" onClick={e => e.stopPropagation()}>
                    <textarea 
                        className="edit-input"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                    />
                    <div className="edit-actions">
                        <button className="edit-btn-cancel" onClick={handleCancelEdit}>취소</button>
                        <button className="edit-btn-save" onClick={handleSaveEdit}>저장</button>
                    </div>
                </div>
            );
        }

        return <div className="message-content">{content}</div>;
    };

    const displayCount = unreadCount > 0 ? unreadCount : null;

    return (
        <div className={`message-item ${mine ? 'mine' : 'theirs'}`} id={`msg-${msgId}`}>
            {!mine && <div className="sender-nickname">{nickname}</div>}

            {/* 말풍선 영역에 우클릭 이벤트 연결 */}
            <div 
                className={`message-bubble ${mine ? 'mine' : 'theirs'}`}
                onContextMenu={handleContextMenu}
                ref={bubbleRef}
            >
                {renderMessageContent()}
            </div>

            {/* 컨텍스트 메뉴 (수정/삭제 버튼) */}
            {contextMenu && (
                <div 
                    className="context-menu" 
                    style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
                >
                    <button onClick={handleClickEdit}>수정</button>
                    <button className="delete-option" onClick={handleClickDelete}>삭제</button>
                </div>
            )}

            {/* 읽음 카운트 */}
            {displayCount && (
                <span className="unread-count">
                    {displayCount}
                </span>
            )}

            {/* 전송 시간 */}
            <span className="timestamp">
                {sentAt ? new Date(sentAt).toLocaleTimeString() : ''}
            </span>
        </div>
    );
}