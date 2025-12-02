// client/src/components/Chatpage/Messages/MessageItem.jsx

import { useRef, useState, useEffect } from "react";
import './MessageItem.css';

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

    // 이름에서 첫 글자 추출 (없으면 '?')
    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    // --- (이벤트 핸들러들은 기존과 동일하게 유지) ---
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
    // ---------------------------------------------

    // 메시지 내용 렌더링
    const renderMessageContent = () => {
        if (messageType === 'FILE') {
            const downloadUrl = fileUrl;
            if (isImageFile(fileName)) {
                return (
                    <div className="file-message image-type">
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                            <img src={downloadUrl} alt={fileName} className="image-preview" />
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
    
    // [수정] 프로필 사진 URL 생성 (없으면 null 반환)
    const avatarUrl = profilePic ? `http://localhost:1337${profilePic}` : null;

    return (
        <div className={`message-item ${mine ? 'mine' : 'theirs'}`} id={`msg-${msgId}`}>
            
            {!mine ? (
                <div className="message-row-theirs">
                    {/* [수정] 이미지가 있으면 img 태그, 없으면 이니셜 div 태그 */}
                    {avatarUrl ? (
                        <img 
                            src={avatarUrl} 
                            alt={nickname} 
                            className="chat-profile-img" 
                            onError={(e) => {
                                // 이미지 로드 실패 시(경로 문제 등) 이니셜 아바타로 대체하기 위해 숨김 처리하거나 부모 컴포넌트 제어 필요
                                // 여기서는 간단히 기본 이미지 처리 (옵션)
                                e.target.style.display = 'none'; 
                                // 실제로는 state로 에러 처리를 하거나 해야 하지만, 
                                // 일단 안 보이면 이니셜이 보이게끔 형제 요소를 추가하는 방식이 나음.
                                // 가장 간단한 방법: 그냥 엑박 대신 투명하게 만듦
                            }}
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