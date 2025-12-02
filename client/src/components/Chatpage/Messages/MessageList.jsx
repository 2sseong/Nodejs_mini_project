import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import MessageItem from './MessageItem';
import './MessageList.css';

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const parseDateString = (dateString) => {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
    try {
        const parts = dateString.split(' '); 
        if (parts.length < 1) return null;
        const datePart = parts[0]; 
        const timePart = parts[1] || "00:00:00"; 
        const [yy, mm, dd] = datePart.split('/').map(Number);
        const timeSubParts = timePart.split(':');
        const hour = parseInt(timeSubParts[0], 10) || 0;
        const min = parseInt(timeSubParts[1], 10) || 0;
        const secStr = timeSubParts[2] || "0";
        const sec = parseInt(secStr.split('.')[0], 10) || 0;
        const fullYear = yy < 100 ? 2000 + yy : yy;
        return new Date(fullYear, mm - 1, dd, hour, min, sec);
    } catch (e) {
        console.log('Date parsing error:', e); 
        return null; }
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
    isInitialLoad, markAsRead, isReadStatusLoaded, 
    onEditMessage, onDeleteMessage, scrollToMsgId, searchKeyword,
    loadNewerMessages, hasFutureMessages, isLoadingNewer
}) {
    const [newMessagePreview, setNewMessagePreview] = useState(null);
    const isStickToBottomRef = useRef(true); 
    const lastMessageIdRef = useRef(null);
    const listRef = useRef(null);
    const prevScrollHeightRef = useRef(null);
    const isLoadingNewerRef = useRef(false);

    // 읽음 처리
    useEffect(() => {
        const handleActivity = () => {
            if (messages.length > 0 && markAsRead && isReadStatusLoaded && document.hasFocus()) {
                markAsRead();
            }
        };
        if (messages.length > 0 && markAsRead && isReadStatusLoaded && document.hasFocus()) {
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

    // [핵심] 스크롤 위치 체크
    const checkScrollPosition = () => {
        if (!listRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;
        
        // 50px 이내 오차범위로 바닥 감지
        const isAtBottom = scrollBottom <= 50;
        isStickToBottomRef.current = isAtBottom;

        // 바닥에 도달하면 미리보기 바 숨김
        if (isAtBottom && newMessagePreview) {
            setNewMessagePreview(null);
        }
    };

    const handleScroll = () => {
        if (!listRef.current) return;
        checkScrollPosition(); 

        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        if (scrollTop <= 50 && !isLoadingMore && hasMoreMessages) {
            prevScrollHeightRef.current = scrollHeight;
            onLoadMore();
        }
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

    const onNativeScroll = (e) => {
        checkScrollPosition();
        debouncedHandleScroll(e);
    };

    // [추가] 이미지 로딩 완료 시 스크롤 조정
    const handleImageLoad = useCallback(() => {
        if (isStickToBottomRef.current && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, []);
  
    // 스크롤 제어 로직
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const oldScrollHeight = prevScrollHeightRef.current;
        
        if (isLoadingNewerRef.current) {
            isLoadingNewerRef.current = false;
            return; 
        }
        
        if (isInitialLoad || oldScrollHeight === null) {
            list.scrollTop = list.scrollHeight;
            isStickToBottomRef.current = true;
        } 
        else if (oldScrollHeight !== null && list.scrollHeight > oldScrollHeight) {
             list.scrollTop = list.scrollHeight - oldScrollHeight;
             prevScrollHeightRef.current = null;
        }
        else {
            const lastMsg = messages[messages.length - 1];
            const lastMsgId = lastMsg?.MSG_ID || lastMsg?.msg_id || lastMsg?.TEMP_ID;
            const isNewMessageArrived = lastMessageIdRef.current !== lastMsgId;

            if (isNewMessageArrived) {
                if (isStickToBottomRef.current) {
                    // 바닥에 있으면 자동 스크롤
                    list.scrollTop = list.scrollHeight;
                } 
                else {
                    const myId = String(userId);
                    const senderId = String(lastMsg?.SENDER_ID || lastMsg?.sender_id);
                    
                    if (senderId === myId) {
                        // 내가 보낸 메시지는 무조건 바닥으로
                        list.scrollTop = list.scrollHeight;
                        isStickToBottomRef.current = true;
                        setNewMessagePreview(null);
                    } else {
                        // 상대방 메시지는 미리보기 띄우기
                        setNewMessagePreview({
                            nickname: lastMsg.NICKNAME || lastMsg.nickname || '알 수 없음',
                            content: lastMsg.CONTENT || lastMsg.content || (lastMsg.file_url ? '파일을 보냈습니다.' : '새로운 메시지'),
                            profilePic: lastMsg.PROFILE_PIC || lastMsg.profile_pic
                        });
                    }
                }
                lastMessageIdRef.current = lastMsgId;
            } else {
                // 메시지 업데이트(수정 등) 시 바닥 유지
                if (isStickToBottomRef.current) {
                    list.scrollTop = list.scrollHeight;
                }
            }
        }
    }, [messages, isInitialLoad, userId]);

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

    const handleScrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
            setNewMessagePreview(null);
            setTimeout(() => { isStickToBottomRef.current = true; }, 300);
        }
    };

    let lastDate = null;

    return (
        <div className="message-area" ref={listRef} onScroll={onNativeScroll}>
            {isLoadingMore && <div className="loading-spinner"><span>Loading...</span></div>}
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

                const messageDate = getFormattedDate(sentAt);
                const showDateSeparator = messageDate && (messageDate !== lastDate);
                if (messageDate) lastDate = messageDate;

                return (
                    <div key={uniqueKey} className="message-row-container">
                        {showDateSeparator && (
                            <div className="date-separator"><span className="date-text">{messageDate}</span></div>
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
                            onImageLoad={handleImageLoad} // 이미지 로딩 콜백 전달
                        />
                    </div>
                );
            })}

            {isLoadingNewer && (
                <div className="loading-spinner-bottom" style={{ textAlign: 'center', padding: '10px' }}>
                    <span>Loading newer messages...</span>
                </div>
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