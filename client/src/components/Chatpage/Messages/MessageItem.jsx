import { useRef, useState, useEffect } from "react";
import './MessageItem.css';
import ConfirmModal from '../Modals/ConfirmModal'; // [추가] 모달 컴포넌트 import

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
        onDelete,
        onStartEdit,
        onImageLoad,
        searchKeyword,
        onSetNotice,
        showProfile = true, // 기본값: 프로필 표시
        showTime = true, // 기본값: 시간 표시
    } = props;

    const [contextMenu, setContextMenu] = useState(null);

    // [추가] 삭제 확인 모달 상태
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
        // 본인 메시지만 우클릭 메뉴 표시 (수정/삭제)
        // 파일 메시지는 삭제만 가능, 텍스트 메시지는 수정/삭제/공지 등록 가능
        if (!mine) return;
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY });
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // 수정 클릭 시 부모에게 수정 시작 알림
    const handleClickEdit = () => {
        if (onStartEdit) {
            onStartEdit({ msgId, content });
        }
        setContextMenu(null);
    };

    // 삭제 버튼 클릭 시 모달 열기
    const handleClickDelete = () => {
        setIsDeleteModalOpen(true);
        setContextMenu(null);
    };

    // 모달에서 '삭제' 확인 클릭 시 호출
    const handleConfirmDelete = () => {
        onDelete(msgId);
        setIsDeleteModalOpen(false);
    };

    // 공지로 등록 클릭 시
    const handleClickSetNotice = () => {
        if (onSetNotice && content) {
            onSetNotice(msgId, content);
        }
        setContextMenu(null);
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

            // [추가] 이미지 클릭 핸들러 (Electron 미리보기 창 열기)
            const handleImageClick = (e) => {
                e.preventDefault();
                if (window.electronAPI?.openImagePreview) {
                    window.electronAPI.openImagePreview(downloadUrl, fileName);
                } else {
                    // 웹 브라우저 환경에서는 새 탭으로 열기
                    window.open(downloadUrl, '_blank');
                }
            };

            // [추가] 파일 저장 핸들러 (Electron 저장 대화상자)
            const handleSaveClick = async (e) => {
                e.preventDefault();
                if (window.electronAPI?.downloadFile) {
                    const result = await window.electronAPI.downloadFile(downloadUrl, fileName);
                    if (result.success) {
                        console.log('파일 저장 완료:', result.filePath);
                    } else if (result.message !== '취소됨') {
                        console.error('파일 저장 실패:', result.message);
                    }
                } else {
                    // 웹 브라우저 환경에서는 새 탭으로 열기
                    window.open(downloadUrl, '_blank');
                }
            };

            if (isImageFile(fileName)) {
                return (
                    <div className="file-message image-type">
                        <img
                            src={downloadUrl}
                            alt={fileName}
                            className="image-preview"
                            onClick={handleImageClick}
                            onLoad={handleImgLoad}
                            style={{ cursor: 'pointer' }}
                        />
                        <div style={{ textAlign: 'right' }}>
                            <button
                                onClick={handleSaveClick}
                                className={`download-link ${mine ? 'mine' : 'theirs'}`}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 0'
                                }}
                            >
                                ⬇ 저장
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <div className="file-message">
                    <button
                        onClick={handleSaveClick}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'inherit',
                            fontWeight: 500,
                            padding: 0
                        }}
                    >
                        <strong>📄 {fileName || '파일 다운로드'}</strong>
                    </button>
                </div>
            );
        }

        // 일반 텍스트 메시지
        return <div className="message-content">{highlightKeyword(content?.trim())}</div>;
    };

    // 검색 키워드 하이라이트 함수
    const highlightKeyword = (text) => {
        if (!text || !searchKeyword || searchKeyword.trim() === '') {
            return text;
        }

        const keyword = searchKeyword.trim();
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part) ? (
                <mark key={index} className="search-highlight">{part}</mark>
            ) : part
        );
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
        <div className={`message-item ${mine ? 'mine' : 'theirs'} ${!showProfile && !mine ? 'grouped' : ''}`} id={`msg-${msgId}`}>
            {!mine ? (
                <>
                    {showProfile && <div className="sender-nickname">{nickname}</div>}
                    <div className="message-row-theirs">
                        {showProfile ? (
                            avatarUrl ? (
                                <img
                                    key={avatarUrl}
                                    src={avatarUrl}
                                    alt={nickname}
                                    className="chat-profile-img"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="chat-profile-initials">
                                    {getInitials(nickname)}
                                </div>
                            )
                        ) : (
                            <div className="chat-profile-placeholder"></div>
                        )}

                        <div className={`message-bubble theirs ${messageType === 'FILE' && isImageFile(fileName) ? 'is-file' : ''}`} onContextMenu={handleContextMenu} ref={bubbleRef}>
                            {renderMessageContent()}
                        </div>

                        <div className="message-info theirs">
                            {displayCount && <span className="unread-count">{displayCount}</span>}
                            {showTime && (
                                <span className="timestamp">
                                    {sentAt ? new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="message-row-mine">
                    <div className="message-info mine">
                        {displayCount && <span className="unread-count">{displayCount}</span>}
                        {showTime && (
                            <span className="timestamp">
                                {sentAt ? new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        )}
                    </div>
                    <div className={`message-bubble mine ${messageType === 'FILE' && isImageFile(fileName) ? 'is-file' : ''}`} onContextMenu={handleContextMenu} ref={bubbleRef}>
                        {renderMessageContent()}
                    </div>
                </div>
            )}

            {contextMenu && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}>
                    {/* 파일 메시지가 아닐 때만 수정 버튼 표시 */}
                    {mine && messageType !== 'FILE' && (
                        <button onClick={handleClickEdit}>수정</button>
                    )}
                    {mine && (
                        <button className="delete-option" onClick={handleClickDelete}>삭제</button>
                    )}
                    {/* 공지로 등록 - 텍스트 메시지만 */}
                    {messageType !== 'FILE' && (
                        <button onClick={handleClickSetNotice}>공지로 등록</button>
                    )}
                </div>
            )}

            {/* 삭제 확인 모달 */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="메시지 삭제"
                message="정말 이 메시지를 삭제하시겠습니까?"
                confirmText="삭제"
                isDanger={true}
            />
        </div>
    );
}