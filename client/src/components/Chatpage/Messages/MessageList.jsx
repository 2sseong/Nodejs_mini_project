import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import MessageItem from './MessageItem';
import './MessageList.css';

// 날짜 파싱 헬퍼 함수
const parseDateString = (dateString) => {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
    return null;
};

const getFormattedDate = (dateString) => {
    const date = parseDateString(dateString);
    if (!date) return '';
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
};

export default function MessageList({
    messages, userId, onLoadMore, isLoadingMore, hasMoreMessages,
    isInitialLoad, markAsRead,
    onEditMessage, onDeleteMessage, onStartEdit, scrollToMsgId, searchKeyword,
    loadNewerMessages, hasFutureMessages, isLoadingNewer, firstUnreadMsgId, onSetNotice,
    hasNotice, isNoticeVisible, onToggleNotice
}) {
    const listRef = useRef(null);
    const [previewMsg, setPreviewMsg] = useState(null); // 미리보기 메시지 상태

    // 스크롤 상태 관리용 Ref
    const isAtBottomRef = useRef(true);
    const prevMsgLenRef = useRef(messages.length);
    const prevScrollHeightRef = useRef(0);
    const firstVisibleMsgIdRef = useRef(null); // 스크롤 위치 복원용
    const hasScrolledToInitialRef = useRef(false); // 초기 스크롤 완료 여부

    // 1. 스크롤 이벤트 핸들러
    const handleScroll = useCallback(() => {
        if (!listRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;

        // 바닥과의 거리 계산
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // 바닥 감지 (여유값 100px)
        const isBottom = distanceFromBottom < 100;
        isAtBottomRef.current = isBottom;

        // 바닥에 도달하면 미리보기 끄기
        if (isBottom) {
            setPreviewMsg(null);
        }

        // A. 상단 스크롤 (과거 메시지 로딩)
        if (scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            prevScrollHeightRef.current = scrollHeight;
            onLoadMore();
        }

        // B. 하단 스크롤 (미래 메시지 로딩)
        // 감도 150px로 설정
        if (distanceFromBottom < 150 && hasFutureMessages && !isLoadingNewer) {
            if (loadNewerMessages) {
                loadNewerMessages();
            }
        }
    }, [isLoadingMore, hasMoreMessages, onLoadMore, hasFutureMessages, isLoadingNewer, loadNewerMessages]);

    // 바닥 근처인데 미래 메시지가 남아있는 경우 강제 로딩 (ex: 메시지 로드 직후 스크롤이 덜 내려갔을 때)
    useEffect(() => {
        if (isAtBottomRef.current && hasFutureMessages && !isLoadingNewer) {
            if (loadNewerMessages) {
                loadNewerMessages();
            }
        }
    }, [messages, hasFutureMessages, isLoadingNewer, loadNewerMessages]);


    // 2. 메시지 변경 시 스크롤 제어 (핵심 로직)
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const currentLen = messages.length;
        const prevLen = prevMsgLenRef.current;
        prevMsgLenRef.current = currentLen;

        // 로딩 중에는 처리하지 않음
        if (isLoadingNewer) return;

        // A. 과거 메시지 불러온 경우 (스크롤 위치 유지) - 최우선 처리
        if (currentLen > prevLen && prevScrollHeightRef.current > 0) {
            const prevScrollHeight = prevScrollHeightRef.current;
            prevScrollHeightRef.current = 0;
            firstVisibleMsgIdRef.current = null;

            // 새로 추가된 메시지 높이만큼 스크롤 위치 보정
            requestAnimationFrame(() => {
                const newScrollHeight = list.scrollHeight;
                const scrollDiff = newScrollHeight - prevScrollHeight;
                list.scrollTop = scrollDiff;
            });
            return;
        }

        // B. 초기 로딩: 메시지가 있고 한 번만 실행
        if (isInitialLoad && currentLen > 0 && !hasScrolledToInitialRef.current) {
            hasScrolledToInitialRef.current = true;

            // firstUnreadMsgId가 있으면 별도 useEffect에서 처리하므로 건너뛰기
            if (firstUnreadMsgId) {
                return;
            }

            // 읽지 않은 메시지가 없으면 바닥으로 스크롤
            requestAnimationFrame(() => {
                list.scrollTop = list.scrollHeight;
                isAtBottomRef.current = true;
            });
            return;
        }

        // C. 새 메시지가 추가된 경우 (실시간 메시지)
        if (currentLen > prevLen) {
            // 한 번에 여러 메시지가 추가된 경우(Load Newer)는 자동 스크롤 하지 않음
            if (currentLen - prevLen > 1) {
                return;
            }

            const lastMsg = messages[currentLen - 1];
            const isMyMsg = String(lastMsg.SENDER_ID || lastMsg.sender_id) === String(userId);

            if (isMyMsg) {
                // 내가 쓴 글은 무조건 바닥으로
                requestAnimationFrame(() => {
                    list.scrollTop = list.scrollHeight;
                });
                isAtBottomRef.current = true;
                setPreviewMsg(null);
            } else {
                if (isAtBottomRef.current) {
                    // 바닥에 있었으면 계속 바닥으로 (자동 스크롤)
                    requestAnimationFrame(() => {
                        list.scrollTop = list.scrollHeight;
                    });
                } else {
                    // 스크롤이 올라가 있었으면 -> 미리보기 표시
                    setPreviewMsg(lastMsg);
                }
            }
        }
    }, [messages, isInitialLoad, userId, isLoadingNewer, firstUnreadMsgId]);

    // 2-1. 읽지 않은 메시지 위치로 스크롤 (firstUnreadMsgId가 설정되면)
    useEffect(() => {
        if (firstUnreadMsgId && listRef.current) {
            const el = document.getElementById(`msg-${firstUnreadMsgId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'center' });
                el.classList.add('highlight-flash');
                setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                isAtBottomRef.current = false;
            }
        }
    }, [firstUnreadMsgId]);

    // 3. 읽음 처리 트리거
    useEffect(() => {
        const triggerRead = () => {
            if (messages.length > 0 && markAsRead && document.hasFocus()) {
                markAsRead();
            }
        };

        triggerRead();

        window.addEventListener('focus', triggerRead);
        window.addEventListener('click', triggerRead);

        return () => {
            window.removeEventListener('focus', triggerRead);
            window.removeEventListener('click', triggerRead);
        };
    }, [messages, markAsRead]);

    // 4. 검색 등으로 특정 메시지로 이동
    useEffect(() => {
        if (scrollToMsgId && listRef.current) {
            const el = document.getElementById(`msg-${scrollToMsgId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-flash');
                setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                isAtBottomRef.current = false;
            }
        }
    }, [scrollToMsgId]);

    // 5. 미리보기 클릭 시 바닥 이동
    const handleClickPreview = () => {
        if (listRef.current) {
            listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
            setPreviewMsg(null);
            setTimeout(() => { isAtBottomRef.current = true; }, 300);
        }
    };

    // 이미지 로딩 시 스크롤 보정
    const handleImageLoad = useCallback(() => {
        if (isAtBottomRef.current && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, []);

    let lastDate = null;

    return (
        <div className="message-area" ref={listRef} onScroll={handleScroll}>
            {/* 공지 토글 버튼 - 공지가 있고 숨겨져 있을 때만 표시 */}
            {hasNotice && !isNoticeVisible && (
                <button
                    className="notice-toggle-floating-btn"
                    onClick={onToggleNotice}
                    title="공지 표시"
                >
                    <i className="bi bi-megaphone"></i>
                </button>
            )}

            {isLoadingMore && <div className="loading-spinner">Wait...</div>}

            {!isLoadingMore && !hasMoreMessages && messages.length > 0 && (
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#ccc', margin: '10px' }}>
                    대화의 시작입니다
                </div>
            )}

            {messages.map((m, i) => {
                const msgId = m.MSG_ID || m.msg_id || m.TEMP_ID || i;
                const sentAt = m.SENT_AT || m.sent_at;
                const messageDate = getFormattedDate(sentAt);
                const showDate = messageDate && messageDate !== lastDate;
                if (showDate) lastDate = messageDate;

                const isMine = String(m.SENDER_ID || m.sender_id) === String(userId);
                const messageType = m.MESSAGE_TYPE || m.message_type;

                // 시스템 메시지 렌더링 (초대/퇴장 등)
                if (messageType === 'SYSTEM') {
                    return (
                        <div key={msgId} className="message-row-container">
                            {showDate && (
                                <div className="date-separator">
                                    <span className="date-text">{messageDate}</span>
                                </div>
                            )}
                            <div className="system-message">
                                <span className="system-message-text">{m.CONTENT || m.content}</span>
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={msgId} className="message-row-container">
                        {showDate && (
                            <div className="date-separator">
                                <span className="date-text">{messageDate}</span>
                            </div>
                        )}
                        <MessageItem
                            msgId={msgId}
                            mine={isMine}
                            nickname={m.NICKNAME || m.nickname}
                            profilePic={m.PROFILE_PIC || m.profile_pic}
                            sentAt={sentAt}
                            content={m.CONTENT || m.content}
                            messageType={messageType}
                            fileUrl={m.FILE_URL || m.file_url}
                            fileName={m.FILE_NAME || m.file_name}
                            unreadCount={m.unreadCount}
                            onEdit={onEditMessage}
                            onDelete={onDeleteMessage}
                            onStartEdit={onStartEdit}
                            onImageLoad={handleImageLoad}
                            searchKeyword={searchKeyword}
                            onSetNotice={onSetNotice}
                        />
                    </div>
                );
            })}

            {isLoadingNewer && (
                <div className="loading-spinner-bottom">
                    <span>Loading newer messages...</span>
                </div>
            )}

            {previewMsg && (
                <div className="floating-preview-bar" onClick={handleClickPreview}>
                    <div className="preview-info">
                        <span className="preview-name">
                            {previewMsg.NICKNAME || previewMsg.nickname || '상대방'}
                        </span>
                        <span className="preview-desc">
                            {previewMsg.MESSAGE_TYPE === 'FILE'
                                ? '파일을 보냈습니다.'
                                : (previewMsg.CONTENT || previewMsg.content)}
                        </span>
                    </div>
                    <div className="preview-arrow">⬇</div>
                </div>
            )}

            <div style={{ height: 10 }}></div>
        </div>
    );
}