import { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import './MessageList.css';

// 스크롤 감지 딜레이 (디바운싱)
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
    isReadStatusLoaded, // [핵심] 로딩 완료 상태 Prop
    onEditMessage,   // [추가] 부모(ChatPage)에서 전달받음
    onDeleteMessage
}) {

    // [핵심] 메시지 목록 변경 또는 데이터 로딩 완료 시 읽음 처리
    useEffect(() => {
        if (messages.length > 0 && markAsRead && isReadStatusLoaded) {
            const timer = setTimeout(() => {
                markAsRead();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [messages, markAsRead, isReadStatusLoaded]); // 의존성 필수

    const listRef = useRef(null);
    const prevScrollHeightRef = useRef(null);

    // 스크롤 이벤트 핸들러
    const handleScroll = () => {
        if (!listRef.current) return;
        const { scrollTop } = listRef.current;

        if (scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            console.log('Reached top, loading more...');
            prevScrollHeightRef.current = listRef.current.scrollHeight;
            onLoadMore();
        }
    };

    const debouncedHandleScroll = useRef(debounce(handleScroll, 200)).current;
  
    // 스크롤 위치 제어
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const oldScrollHeight = prevScrollHeightRef.current;
        
        if (isInitialLoad || oldScrollHeight === null) {
            list.scrollTop = list.scrollHeight;
        } 
        else {
            list.scrollTop = list.scrollHeight - oldScrollHeight;
            prevScrollHeightRef.current = null;
        }
    }, [messages, isInitialLoad]);

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
                // 대소문자 호환성 및 키 생성
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
                        onEdit={onEditMessage}     // 핸들러 전달
                        onDelete={onDeleteMessage}
                    />
                );
            })}
        </div>
    );
}