import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import MessageItem from './MessageItem';
import './MessageList.css';

// --- [모듈화 1] 유틸리티 함수 분리 ---

/**
 * 디바운스 유틸리티
 */
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * [수정됨] DB 타임스탬프 문자열을 표준 Date 객체로 변환하는 함수
 * 입력 예시: "25/12/02 11:11:11.663000000" (YY/MM/DD HH:mm:ss.nnnnnnnnn)
 */
const parseDateString = (dateString) => {
    if (!dateString) return null;

    // 1. 표준 포맷(ISO 등)이면 바로 변환
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;

    // 2. DB 포맷 (YY/MM/DD ...) 수동 파싱
    try {
        // 공백을 기준으로 날짜와 시간 분리
        const parts = dateString.split(' '); 
        if (parts.length < 1) return null;

        const datePart = parts[0]; // "25/12/02"
        const timePart = parts[1] || "00:00:00"; // "11:11:11.663..."

        // 날짜 쪼개기 (슬래시 기준)
        const [yy, mm, dd] = datePart.split('/').map(Number);
        
        // 시간 쪼개기 (콜론 기준, 초 이하 소수점 제거)
        const timeSubParts = timePart.split(':');
        const hour = parseInt(timeSubParts[0], 10) || 0;
        const min = parseInt(timeSubParts[1], 10) || 0;
        const secStr = timeSubParts[2] || "0";
        const sec = parseInt(secStr.split('.')[0], 10) || 0;

        // 연도 보정 (2자리 연도 -> 2000년대)
        // 25 -> 2025
        const fullYear = yy < 100 ? 2000 + yy : yy;

        // 월은 0부터 시작하므로 -1
        return new Date(fullYear, mm - 1, dd, hour, min, sec);
    } catch (e) {
        console.error('Date parsing error:', dateString, e);
        return null;
    }
};

/**
 * 날짜 포맷팅 헬퍼 함수
 */
const getFormattedDate = (dateString) => {
    const date = parseDateString(dateString);
    if (!date) return ''; // 파싱 실패 시 빈 문자열

    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
};

// --- [메인 컴포넌트] ---

export default function MessageList({
    messages,
    userId,
    onLoadMore,
    isLoadingMore,
    hasMoreMessages,
    isInitialLoad,
    markAsRead,
    isReadStatusLoaded,
    onEditMessage,
    onDeleteMessage,
    scrollToMsgId,
    searchKeyword,
    loadNewerMessages,
    hasFutureMessages,
    isLoadingNewer
}) {
    // 1. 상태 및 Ref 선언
    const [newMessagePreview, setNewMessagePreview] = useState(null);
    const isStickToBottomRef = useRef(true);
    const lastMessageIdRef = useRef(null);
    const listRef = useRef(null);
    const prevScrollHeightRef = useRef(null);
    const isLoadingNewerRef = useRef(false);

    // 2. 읽음 처리 로직
    useEffect(() => {
        const handleActivity = () => {
            if (messages.length > 0 && markAsRead && isReadStatusLoaded && document.hasFocus()) {
                markAsRead();
            }
        };

        // 초기 로딩/메시지 갱신 시 자동 체크
        if (messages.length > 0 && markAsRead && isReadStatusLoaded && document.hasFocus()) {
            // 약간의 딜레이를 주어 렌더링 후 처리
            const timer = setTimeout(markAsRead, 300);
            return () => clearTimeout(timer);
        }

        window.addEventListener('focus', handleActivity);
        window.addEventListener('click', handleActivity);
        document.addEventListener('visibilitychange', handleActivity);

        return () => {
            window.removeEventListener('focus', handleActivity);
            window.removeEventListener('click', handleActivity);
            document.removeEventListener('visibilitychange', handleActivity);
        };
    }, [messages, markAsRead, isReadStatusLoaded]);

    // 3. 스크롤 핸들러 (API 호출 로직)
    const handleScroll = () => {
        if (!listRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        // [상태 갱신] 바닥 감지 (100px 이내)
        isStickToBottomRef.current = scrollBottom <= 100;

        if (isStickToBottomRef.current && newMessagePreview) {
            setNewMessagePreview(null);
        }

        // [API] 과거 메시지 로딩
        if (scrollTop <= 50 && !isLoadingMore && hasMoreMessages) {
            prevScrollHeightRef.current = scrollHeight;
            onLoadMore();
        }

        // [API] 미래 메시지 로딩
        if (scrollBottom <= 50 && hasFutureMessages && !isLoadingNewer) {
            isLoadingNewerRef.current = true;
            if (loadNewerMessages) loadNewerMessages();
        }
    };

    const handleScrollRef = useRef(handleScroll);
    useEffect(() => { handleScrollRef.current = handleScroll; });

    const debouncedHandleScroll = useRef(
        debounce((...args) => handleScrollRef.current?.(...args), 200)
    ).current;

    // 4. 네이티브 스크롤 이벤트 (즉각 반응용)
    const onNativeScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        // 바닥 감지 즉시 업데이트
        isStickToBottomRef.current = scrollBottom <= 100;

        if (isStickToBottomRef.current && newMessagePreview) {
            setNewMessagePreview(null);
        }

        debouncedHandleScroll(e);
    };

    // 5. 스크롤 위치 조정 및 새 메시지 처리 (LayoutEffect)
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const oldScrollHeight = prevScrollHeightRef.current;

        // (A) 아래로 로딩 중이면 스크롤 유지
        if (isLoadingNewerRef.current) {
            isLoadingNewerRef.current = false;
            return;
        }

        // (B) 초기 로딩 -> 바닥으로
        if (isInitialLoad || oldScrollHeight === null) {
            list.scrollTop = list.scrollHeight;
            isStickToBottomRef.current = true;
        }
        // (C) 위로 로딩(과거 내역) -> 위치 복구
        else if (oldScrollHeight !== null && list.scrollHeight > oldScrollHeight) {
            list.scrollTop = list.scrollHeight - oldScrollHeight;
            prevScrollHeightRef.current = null;
        }
        // (D) 새 메시지 수신 또는 리스트 갱신
        else {
            const lastMsg = messages[messages.length - 1];
            const lastMsgId = lastMsg?.MSG_ID || lastMsg?.msg_id || lastMsg?.TEMP_ID;
            const isNewMessageArrived = lastMessageIdRef.current !== lastMsgId;

            if (isNewMessageArrived) {
                // 바닥에 있었으면 계속 바닥 유지 (자동 스크롤)
                if (isStickToBottomRef.current) {
                    list.scrollTop = list.scrollHeight;
                }
                // 스크롤이 위에 있었을 때
                else {
                    const myId = String(userId);
                    const senderId = String(lastMsg?.SENDER_ID || lastMsg?.sender_id);

                    // 내가 보낸 건 무조건 바닥으로
                    if (senderId === myId) {
                        list.scrollTop = list.scrollHeight;
                        isStickToBottomRef.current = true;
                        setNewMessagePreview(null);
                    } else {
                        // 남이 보낸 건 미리보기 토스트
                        setNewMessagePreview({
                            nickname: lastMsg.NICKNAME || lastMsg.nickname || '알 수 없음',
                            content: lastMsg.CONTENT || lastMsg.content || (lastMsg.file_url ? '파일을 보냈습니다.' : '새로운 메시지'),
                            profilePic: lastMsg.PROFILE_PIC || lastMsg.profile_pic
                        });
                    }
                }
                lastMessageIdRef.current = lastMsgId;
            } else {
                // 메시지 내용은 바꼈지만 새 메시지는 아님 (수정 등) -> 바닥 유지
                if (isStickToBottomRef.current) {
                    list.scrollTop = list.scrollHeight;
                }
            }
        }
    }, [messages, isInitialLoad, userId]);

    // 6. 검색 이동
    useEffect(() => {
        if (scrollToMsgId) {
            const element = document.getElementById(`msg-${scrollToMsgId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-flash');
                setTimeout(() => element.classList.remove('highlight-flash'), 2000);
                isStickToBottomRef.current = false;
            }
        }
    }, [scrollToMsgId]);

    // 7. 프리뷰 클릭 핸들러
    const handleScrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
            setNewMessagePreview(null);
            isStickToBottomRef.current = true;
        }
    };

    // 8. 렌더링 (날짜 계산용 변수)
    let lastDate = null;

    return (
        <div
            className="message-area"
            ref={listRef}
            onScroll={onNativeScroll}
        >
            {isLoadingMore && (
                <div className="loading-spinner"><span>Loading...</span></div>
            )}

            {!isLoadingMore && !hasMoreMessages && messages.length > 0 && (
                <div className="history-end"><span>대화 내역의 시작입니다.</span></div>
            )}

            {messages.map((m, index) => {
                const msgId = m.MSG_ID || m.msg_id || m.TEMP_ID;
                const uniqueKey = msgId ? `${msgId}` : `msg_${index}`;

                const senderId = m.SENDER_ID || m.sender_id;
                const nickname = m.NICKNAME || m.nickname;
                const sentAt = m.SENT_AT || m.sent_at;
                const content = m.CONTENT || m.content;
                const messageType = m.MESSAGE_TYPE || m.message_type;
                const fileUrl = m.FILE_URL || m.file_url;
                const fileName = m.FILE_NAME || m.file_name;
                const unreadCount = m.unreadCount;
                const profilePic = m.PROFILE_PIC || m.profile_pic;

                // [날짜 구분선 로직]
                const messageDate = getFormattedDate(sentAt);
                
                // 날짜가 유효하고, 이전 메시지 날짜와 다를 때만 구분선 표시
                const showDateSeparator = messageDate && (messageDate !== lastDate);
                
                if (messageDate) {
                    lastDate = messageDate;
                }

                return (
                    <div key={uniqueKey} className="message-row-container">
                        {showDateSeparator && (
                            <div className="date-separator">
                                <span className="date-text">{messageDate}</span>
                            </div>
                        )}

                        <MessageItem
                            msgId={msgId}
                            mine={String(senderId) === String(userId)}
                            nickname={nickname}
                            profilePic={profilePic}
                            sentAt={sentAt}
                            content={content}
                            messageType={messageType}
                            fileUrl={fileUrl}
                            fileName={fileName}
                            unreadCount={unreadCount}
                            onEdit={onEditMessage}
                            onDelete={onDeleteMessage}
                            searchKeyword={searchKeyword}
                        />
                    </div>
                );
            })}

            {isLoadingNewer && (
                <div className="loading-spinner-bottom"><span>Loading newer messages...</span></div>
            )}

            {newMessagePreview && (
                <div className="new-message-preview" onClick={handleScrollToBottom}>
                    <div className="preview-content">
                        <span className="preview-sender">{newMessagePreview.nickname}</span>
                        <span className="preview-text">{newMessagePreview.content}</span>
                    </div>
                    <div className="preview-arrow">⬇</div>
                </div>
            )}
        </div>
    );
}