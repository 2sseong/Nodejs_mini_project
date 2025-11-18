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
    isInitialLoad // useChatSocket에서 전달받은 '초기 로드' 상태
}) {
    const listRef = useRef(null);
    
    // [!!!] 스크롤 위치 보존을 위한 상태 [!!!]
    // 이전 스크롤 높이를 저장
    const prevScrollHeightRef = useRef(null);

    // 1. 스크롤 이벤트 핸들러
    const handleScroll = () => {
        if (!listRef.current) return;

        const { scrollTop } = listRef.current;

        // 스크롤이 맨 위에 닿았고, 로딩 중이 아니며, 더 많은 메시지가 있을 때
        if (scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
            console.log('Reached top, loading more...');
            // 스크롤이 맨 위일 때, 현재 scrollHeight를 저장
            prevScrollHeightRef.current = listRef.current.scrollHeight;
            onLoadMore();
        }
    };

    // 스크롤 이벤트에 디바운스 적용 (성능 최적화)
    const debouncedHandleScroll = useRef(debounce(handleScroll, 200)).current;
  
    // 2. 스크롤 위치 제어 (가장 중요)
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const oldScrollHeight = prevScrollHeightRef.current;
        
        // [상태 A] 최초 로드 (isInitialLoad === true)
        // 또는, 내가 새 메시지를 보냈거나, 상대방이 새 메시지를 보냈을 때 (isInitialLoad === false && prevScrollHeight === null)
        if (isInitialLoad || oldScrollHeight === null) {
            // 즉시 스크롤을 맨 아래로 이동
            list.scrollTop = list.scrollHeight;
            console.log('Scrolling to bottom (Initial Load or New Message)');
        } 
        // [상태 B] 이전 내역을 불러왔을 때 (prevScrollHeight에 값이 있음)
        else {
            // (새 높이) - (이전 높이) 만큼 스크롤을 내려서
            // 이전에 보던 위치를 그대로 유지
            list.scrollTop = list.scrollHeight - oldScrollHeight;

            // [!!!] 수정 1: 스크롤 복원에 사용했으므로 "else 블록 안에서" 리셋
            prevScrollHeightRef.current = null;
            console.log('Restoring scroll position after loading older messages');
        }


    // messages 배열이 변경될 때마다 이 로직을 실행
    }, [messages]);

    return (
        <div 
            className="message-area" 
            ref={listRef} 
            onScroll={debouncedHandleScroll}
        >
            {/* 로딩 스피너 (맨 위) */}
            {isLoadingMore && (
                <div className="loading-spinner">
                    <span>Loading...</span>
                </div>
            )}

            {/* 더 이상 메시지가 없을 때 (맨 위) */}
            {!isLoadingMore && !hasMoreMessages && messages.length > 0 && (
                <div className="history-end">
                    <span>대화 내역의 시작입니다.</span>
                </div>
            )}
            
            {messages.map((m) => ( // key에서 'i' 제거 (TEMP_ID / MSG_ID로 충분)
                <MessageItem
                    key={m.MSG_ID || m.TEMP_ID} // [!!!] Key 수정 [!!!]
                    mine={m.SENDER_ID === userId}
                    nickname={m.NICKNAME} // (서버에서 닉네임을 모두 채워줌)
                    sentAt={m.SENT_AT}
                    content={m.CONTENT}
                    messageType={m.MESSAGE_TYPE}
                    fileUrl={m.FILE_URL}
                    fileName={m.FILE_NAME}
                />
            ))}
            {/* 'bottomRef'는 이제 사용되지 않습니다 (useLayoutEffect가 제어) */}
        </div>
    );
}