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
    onDeleteMessage,
    scrollToMsgId,
    searchKeyword,
    loadNewerMessages, 
    hasFutureMessages, 
    isLoadingNewer
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
    const isLoadingNewerRef = useRef(false);

    // 2. 스크롤 핸들러 (로그가 잘 찍히던 그 로직 그대로)
    const handleScroll = () => {
        if (!listRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;

        // 이제 여기서 최신 isLoadingMore, hasMoreMessages 값을 참조합니다.
        if (scrollTop <= 50 && !isLoadingMore && hasMoreMessages) {
            console.log('Near top, loading more...');
            prevScrollHeightRef.current = scrollHeight;
            onLoadMore(); // 최신 소켓이 담긴 onLoadMore가 실행됩니다.
        }
        // 2. [추가] 아래로 스크롤 (미래 데이터 로드)
        // 스크롤이 바닥에서 50px 이내이고, 미래 데이터가 있으며, 로딩 중이 아닐 때
        if (scrollHeight - scrollTop - clientHeight <= 50) {
            if (hasFutureMessages && !isLoadingNewer) {
                
                // [핵심] 로딩 시작 시 플래그 설정 -> useLayoutEffect에서 스크롤 이동 방지
                isLoadingNewerRef.current = true; 
                
                if (loadNewerMessages) loadNewerMessages();
            }
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

        // [핵심 수정] 아래로 로딩하여 메시지가 추가된 경우, 스크롤을 건드리지 않음
        // (브라우저가 알아서 현재 위치 유지 -> 새 메시지는 화면 아래에 추가됨 -> 무한 로딩 방지)
        if (isLoadingNewerRef.current) {
            isLoadingNewerRef.current = false; // 플래그 초기화
            return; 
        }
        
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

    // 4. [추가] 검색된 메시지로 자동 스크롤
    useEffect(() => {
        if (scrollToMsgId) {
            // 메시지 아이템에 id={`msg-${msgId}`}를 부여했다고 가정
            const element = document.getElementById(`msg-${scrollToMsgId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 시각적 강조 효과 (선택사항: 클래스 추가 후 제거)
                element.classList.add('highlight-flash');
                setTimeout(() => element.classList.remove('highlight-flash'), 2000);
            } else {
                console.log('Target message element not found:', scrollToMsgId);
            }
        }
    }, [scrollToMsgId]); // scrollToMsgId가 바뀔 때마다 실행

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
                        searchKeyword={searchKeyword}
                    />
                );
            })}
            {isLoadingNewer && (
                <div className="loading-spinner-bottom" style={{ textAlign: 'center', padding: '10px' }}>
                    <span>Loading newer messages...</span>
                </div>
            )}
        </div>
    );
}