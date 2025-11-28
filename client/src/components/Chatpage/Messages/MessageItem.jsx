// src/components/Chatpage/Messages/MessageItem.jsx

import { useRef, useState, useEffect } from "react";

export default function MessageItem(props) {

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
        onEdit,   
        onDelete,
    } = props;

    const [contextMenu, setContextMenu] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const bubbleRef = useRef(null);

    // 파일명 확장자를 확인하여 이미지인지 판별하는 함수
    const isImageFile = (name) => {
        if (!name) return false;
        return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
    };

    // 1. 우클릭 핸들러
    const handleContextMenu = (e) => {
        if (!mine || messageType === 'FILE') return; 
        e.preventDefault();
        
        setContextMenu({
            x: e.pageX,
            y: e.pageY
        });
    };

    // 2. 메뉴 닫기
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // 3. 수정/삭제 액션
    const handleClickEdit = () => {
        setIsEditing(true);
        setEditContent(content); 
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
            
            // [수정] 이미지 파일인 경우: 미리보기 + 저장 버튼
            if (isImageFile(fileName)) {
                return (
                    <div className="file-message image-type">
                        {/* 1. 이미지 미리보기 (클릭 시 새 탭 원본 확인) */}
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                            <img 
                                src={downloadUrl} 
                                alt={fileName} 
                                style={{ 
                                    maxWidth: '250px', 
                                    maxHeight: '300px', 
                                    borderRadius: '8px',
                                    display: 'block',
                                    cursor: 'pointer',
                                    marginBottom: '6px' // 버튼과 간격
                                }} 
                            />
                        </a>
                        
                        {/* 2. 다운로드 버튼 추가 */}
                        <div style={{ textAlign: 'right' }}>
                            <a 
                                href={downloadUrl} 
                                download={fileName} // 다운로드 속성
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                    fontSize: '0.85em', 
                                    color: mine ? '#fff' : '#666', // 내 메시지는 흰색, 상대방은 회색
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: 'bold',
                                    opacity: 0.9
                                }}
                            >
                                ⬇ 저장
                            </a>
                        </div>
                    </div>
                );
            }

            // 이미지가 아닌 경우 (기존 유지)
            return (
                <div className="file-message">
                    <a href={downloadUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                        <strong>📄 {fileName || '파일 다운로드'}</strong>
                    </a>
                </div>
            );
        }

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

            <div 
                className={`message-bubble ${mine ? 'mine' : 'theirs'}`}
                onContextMenu={handleContextMenu}
                ref={bubbleRef}
                // 이미지일 경우 말풍선 스타일 조정 (패딩, 배경 등)
                style={ 
                    messageType === 'FILE' && isImageFile(fileName) 
                    ? { padding: '8px', backgroundColor: mine ? '#007bff' : '#f1f0f0' } 
                    : {} 
                } 
            >
                {renderMessageContent()}
            </div>

            {contextMenu && (
                <div 
                    className="context-menu" 
                    style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
                >
                    <button onClick={handleClickEdit}>수정</button>
                    <button className="delete-option" onClick={handleClickDelete}>삭제</button>
                </div>
            )}

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