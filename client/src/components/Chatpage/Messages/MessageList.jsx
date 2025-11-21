// src/components/Chatpage/Messages/MessageList.jsx
import { useRef, useEffect, useLayoutEffect } from 'react'; // [변경] useLayoutEffect 추가
import MessageItem from './MessageItem';
import './MessageList.css';

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

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
    onDeleteMessage
}) {

    // 1. 읽음 처리 로직 (이건 useEffect 유지 - 화면 그려진 후 천천히 실행돼도 됨)
    useEffect(() => {
        if (messages.length > 0 && markAsRead && isReadStatusLoaded) {
            const timer = setTimeout(() => {
                markAsRead();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [messages, markAsRead, isReadStatusLoaded]);

    const listRef = useRef(null);
    const prevScrollHeightRef = useRef(null);

    // 2. 스크롤 핸들러 (로그가 잘 찍히던 그 로직 그대로)
    const handleScroll = () => {
        if (!listRef.current) return;
        
        const { scrollTop, scrollHeight } = listRef.current;

        // 이제 여기서 최신 isLoadingMore, hasMoreMessages 값을 참조합니다.
        if (scrollTop <= 50 && !isLoadingMore && hasMoreMessages) {
            console.log('Near top, loading more...');
            prevScrollHeightRef.current = scrollHeight;
            onLoadMore(); // 최신 소켓이 담긴 onLoadMore가 실행됩니다.
        }
    };

    // (A) 최신 handleScroll 함수를 항상 ref에 저장해 둡니다.
    const handleScrollRef = useRef(handleScroll);
    
    // (B) 렌더링 될 때마다 ref를 최신 함수로 업데이트합니다.
    useEffect(() => {
        handleScrollRef.current = handleScroll;
    });

    // (C) 디바운스 함수는 "한 번만" 생성되지만, 실행될 때는 "ref에 들어있는 최신 함수"를 꺼내 씁니다.
    const debouncedHandleScroll = useRef(
        debounce((...args) => {
            // ref.current를 호출하므로 항상 최신 props/state에 접근 가능!
            if (handleScrollRef.current) {
                handleScrollRef.current(...args);
            }
        }, 200)
    ).current;
  
    // 3. [핵심 수정] 스크롤 위치 복구 로직
    // useEffect -> useLayoutEffect로 변경하여 깜빡임 제거
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const oldScrollHeight = prevScrollHeightRef.current;
        
        // 처음 로딩이거나, 저장된 높이가 없으면 (맨 아래로)
        if (isInitialLoad || oldScrollHeight === null) {
            list.scrollTop = list.scrollHeight;
        } 
        // 과거 메시지 로딩 후 (스크롤 위치 유지)
        else {
            // (새로운 전체 높이) - (이전 전체 높이) = (새로 추가된 메시지들의 높이)
            // 이만큼 스크롤을 내려줘야 사용자가 보던 위치가 유지됨
            list.scrollTop = list.scrollHeight - oldScrollHeight;
            
            // 복구 후 초기화
            prevScrollHeightRef.current = null;
        }
    }, [messages, isInitialLoad]); // 메시지가 갱신될 때마다 실행

    return (
        <div 
            className="message-area" 
            ref={listRef} 
            onScroll={debouncedHandleScroll}
        >
            {/* 로딩 스피너 */}
            {isLoadingMore && (
                <div className="loading-spinner">
                    <span>Loading...</span>
                </div>
            )}

            {/* 히스토리 끝 */}
            {!isLoadingMore && !hasMoreMessages && messages.length > 0 && (
                <div className="history-end">
                    <span>대화 내역의 시작입니다.</span>
                </div>
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

                return (
                    <MessageItem
                        key={uniqueKey} 
                        msgId={msgId}
                        mine={String(senderId) === String(userId)} 
                        nickname={nickname} 
                        sentAt={sentAt}
                        content={content}
                        messageType={messageType}
                        fileUrl={fileUrl}
                        fileName={fileName}
                        unreadCount={unreadCount}
                        onEdit={onEditMessage}     
                        onDelete={onDeleteMessage}
                    />
                );
            })}
        </div>
    );
}