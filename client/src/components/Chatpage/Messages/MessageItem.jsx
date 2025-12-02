import { useRef, useState, useEffect } from "react";
import './MessageItem.css';

// [수정] 백엔드 포트 5000으로 설정 (server.js 포트와 일치해야 함)
const API_BASE_URL = 'http://localhost:1337'; 

export default function MessageItem(props) {
    const {
        msgId,
        mine,
        nickname,
        profilePic, 
        sentAt,
        content,
        messageType,
        fileUrl,
        fileName,
        unreadCount,
        onEdit,    
        onDelete,
        onImageLoad // [추가] 이미지 로딩 완료 콜백
    } = props;

    const [contextMenu, setContextMenu] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const bubbleRef = useRef(null);

    // 이미지 파일 판별
    const isImageFile = (name) => {
        if (!name) return false;
        return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
    };

    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    const handleContextMenu = (e) => {
        if (!mine || messageType === 'FILE') return; 
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

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

    // [추가] 이미지 로딩 완료 시 부모에게 알림 (스크롤 조정용)
    const handleImgLoad = () => {
        if (onImageLoad) onImageLoad();
    };

    // 메시지 내용 렌더링
    const renderMessageContent = () => {
        if (messageType === 'FILE') {
            let downloadUrl = fileUrl;
            if (fileUrl && !fileUrl.startsWith('http') && !fileUrl.startsWith('blob')) {
                 const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
                 downloadUrl = `${API_BASE_URL}${normalizedPath}`;
            }

            if (isImageFile(fileName)) {
                return (
                    <div className="file-message image-type">
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                            <img 
                                src={downloadUrl} 
                                alt={fileName} 
                                className="image-preview"
                                onLoad={handleImgLoad} // [핵심] 이미지 로딩 완료 시 호출
                            />
                        </a>
                        <div style={{ textAlign: 'right' }}>
                            <a href={downloadUrl} download={fileName} target="_blank" rel="noopener noreferrer" className={`download-link ${mine ? 'mine' : 'theirs'}`}>
                                ⬇ 저장
                            </a>
                        </div>
                    </div>
                );
            }
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
                    <textarea className="edit-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus />
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
    
    // 프로필 사진 URL 처리
    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('blob')) return path;
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${API_BASE_URL}${normalizedPath}`;
    };

    const avatarUrl = getAvatarUrl(profilePic);

    return (
        <div className={`message-item ${mine ? 'mine' : 'theirs'}`} id={`msg-${msgId}`}>
            {!mine ? (
                <div className="message-row-theirs">
                    {avatarUrl ? (
                        <img 
                            key={avatarUrl} // [핵심] URL 변경 시 강제 리렌더링으로 즉시 업데이트 반영
                            src={avatarUrl} 
                            alt={nickname} 
                            className="chat-profile-img" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="chat-profile-initials">
                            {getInitials(nickname)}
                        </div>
                    )}

                    <div className="message-content-wrapper">
                        <div className="sender-nickname">{nickname}</div>
                        <div className={`message-bubble theirs ${messageType === 'FILE' && isImageFile(fileName) ? 'is-file' : ''}`} onContextMenu={handleContextMenu} ref={bubbleRef}>
                            {renderMessageContent()}
                        </div>
                    </div>

                    <div className="message-info theirs">
                        {displayCount && <span className="unread-count">{displayCount}</span>}
                        <span className="timestamp">
                            {sentAt ? new Date(sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div className="message-info mine">
                        {displayCount && <span className="unread-count">{displayCount}</span>}
                        <span className="timestamp">
                            {sentAt ? new Date(sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                    </div>
                    <div className={`message-bubble mine ${messageType === 'FILE' && isImageFile(fileName) ? 'is-file' : ''}`} onContextMenu={handleContextMenu} ref={bubbleRef}>
                        {renderMessageContent()}
                    </div>
                </div>
            )}

            {contextMenu && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}>
                    <button onClick={handleClickEdit}>수정</button>
                    <button className="delete-option" onClick={handleClickDelete}>삭제</button>
                </div>
            )}
        </div>
    );
}