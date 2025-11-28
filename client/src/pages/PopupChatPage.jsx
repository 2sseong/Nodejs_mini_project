import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatHandlers } from '../hooks/useChatHandlers';

// 채팅 화면 구성 요소 import
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';
import { searchMessagesApi, getMessagesContextApi } from '../api/chatApi';

// 스타일 재사용
import '../styles/PopupChatPage.css'; 

export default function PopupChatPage() {
    const { roomId } = useParams(); // URL 파라미터로 방 ID 받기
    const { userId, userNickname } = useAuth();

    // 이 창 전용 소켓 연결 생성
    const chatSocket = useChatSocket({userId, userNickname, roomId});
    
    const {
        socket, connected, rooms, messages, 
        sendMessage, loadMoreMessages, isLoadingMore, hasMoreMessages,
        markAsRead, isInitialLoad, isReadStatusLoaded, 
        editMessage, deleteMessage, selectRoom,loadNewerMessages, 
        hasFutureMessages, isLoadingNewer
    } = chatSocket;

    const { handleLeaveRoom, handleSendFile } = useChatHandlers({
        ...chatSocket,
        userId, userNickname, 
        currentRoomId: roomId // 핸들러에 현재 방 ID 주입
    });

    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // --- [검색 기능 상태] ---
    const [searchMatches, setSearchMatches] = useState([]); 
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [scrollToMsgId, setScrollToMsgId] = useState(null);

    // [추가] 검색 요청 순서 제어를 위한 ref (Race Condition 방지)
    const lastSearchReqId = useRef(0);

    // 1. [검색 실행] 서버로 검색 요청
    const handleServerSearch = async (keyword) => {
        // 검색어가 비었으면 초기화
        if (!keyword.trim()) {
            setSearchMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        // 현재 요청 ID 생성
        const reqId = Date.now();
        lastSearchReqId.current = reqId;

        try {
            // [수정] API 응답 객체 구조 분해 할당
            const response = await searchMessagesApi(roomId, keyword);
            
            // 마지막 요청이 아니면 무시 (이전 검색 결과가 늦게 도착하는 경우 방지)
            if (lastSearchReqId.current !== reqId) return;

            // [핵심 수정] axios response 구조에 맞춰 데이터 추출 (response.data.data)
            // 백엔드 컨트롤러가 { success: true, data: [...] } 형태로 준다고 가정
            const matches = response.data?.data || [];
            
            setSearchMatches(matches);

            // 검색 완료 후 가장 최신(마지막) 결과 선택
            if (matches.length > 0) {
                setCurrentMatchIndex(matches.length - 1);
            } else {
                setCurrentMatchIndex(-1);
            }
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    // 2. [매칭 이동 및 데이터 로드]
    useEffect(() => {
        const moveToMatch = async () => {
            // 인덱스 유효성 검사 강화
            if (currentMatchIndex < 0 || searchMatches.length === 0 || currentMatchIndex >= searchMatches.length) return;

            const target = searchMatches[currentMatchIndex];
            
            // [방어 코드] target이 유효하지 않을 경우 리턴
            if (!target) return;

            const targetId = target.MSG_ID || target.msg_id;

            // A. 현재 로드된 messages 안에 타겟 메시지가 있는지 확인
            const isAlreadyLoaded = messages.some(m => 
                String(m.MSG_ID || m.msg_id) === String(targetId)
            );

            if (isAlreadyLoaded) {
                setScrollToMsgId(targetId);
            } else {
                // B. 로드되지 않은 메시지라면 -> 문맥 데이터 로드
                console.log(`Msg ${targetId} not loaded. Fetching context...`);
                try {
                    // [수정] 여기도 응답 데이터 추출 필요
                    const response = await getMessagesContextApi(roomId, targetId);
                    const newContextMessages = response.data?.data || [];
                    
                    if (chatSocket.overrideMessages) {
                        chatSocket.overrideMessages(newContextMessages); 
                    } else {
                        console.error("overrideMessages function is missing in chatSocket");
                    }

                    setTimeout(() => {
                        setScrollToMsgId(targetId);
                    }, 100);

                } catch (err) {
                    console.error("Failed to fetch context:", err);
                }
            }
        };

        moveToMatch();
    }, [currentMatchIndex, searchMatches, messages, roomId, chatSocket]); // 의존성 배열 보강

    // 3. 네비게이션 핸들러
    const handlePrevMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev - 1 < 0 ? searchMatches.length - 1 : prev - 1));
    };

    const handleNextMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev + 1 >= searchMatches.length ? 0 : prev + 1));
    };
    // -------------------------


    // [중요] 컴포넌트 마운트 시 해당 방으로 '진입' 처리
    useEffect(() => {
        if (socket && connected && roomId) {
            console.log(`[Popup] Joining room ${roomId}`);
            selectRoom(roomId); // 소켓에게 "나 이 방 들어왔어"라고 알림 (데이터 로딩 + Join)
        }
    }, [socket, connected, roomId, selectRoom]);

    // 방 정보 찾기 (헤더 표시용)
    // rooms 목록이 로드될 때까지 기다리거나, API로 단건 조회할 수도 있음
    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(roomId));
    const roomName = currentRoom ? currentRoom.ROOM_NAME : '채팅방';
    const memberCount = currentRoom ? currentRoom.MEMBER_COUNT : 0;

    const handleOpenDrawer = () => {
        // 새 창 열기 (경로는 App.jsx에 설정한 path와 일치해야 함)
        window.open(`#/files/${roomId}`, 'FileDrawerWindow', 'width=400,height=600,resizable=yes,scrollbars=yes');
    };

    if (!roomId) return <div>잘못된 접근입니다.</div>;

    return (
        <div className="chat-main" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', backgroundColor: 'white', overflow: 'hidden' }}>
            {/* 1. 헤더 */}
            <ChatHeader
                title={roomName}
                memberCount={memberCount}
                onOpenInvite={() => setIsInviteOpen(true)}
                onOpenDrawer={handleOpenDrawer}
                disabled={!connected}
                onLeaveRoom={async () => { // 1. async 함수로 변경
                    const success = await handleLeaveRoom();
                    // 3. 성공했을 때만 창을 닫음
                    if (success) {
                        window.close(); 
                    }
                }}
                onSearch={handleServerSearch}
                onPrevMatch={handlePrevMatch}
                onNextMatch={handleNextMatch}
                matchCount={searchMatches.length}
                currentMatchIdx={currentMatchIndex}
            />

            {/* 2. 메시지 리스트 */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MessageList 
                messages={messages} 
                userId={userId}
                onLoadMore={loadMoreMessages}
                isLoadingMore={isLoadingMore}
                hasMoreMessages={hasMoreMessages}
                isInitialLoad={isInitialLoad}
                markAsRead={markAsRead}
                isReadStatusLoaded={isReadStatusLoaded}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                scrollToMsgId={scrollToMsgId}
                loadNewerMessages={loadNewerMessages}
                hasFutureMessages={hasFutureMessages}
                isLoadingNewer={isLoadingNewer}
            />
            </div>

            {/* 3. 입력창 */}
            <MessageInput
                onSend={(text) => sendMessage({ text })}
                onSendFile={handleSendFile}
                disabled={!connected}
            />

            {/* 초대 모달 */}
            <InviteUserModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                currentRoomId={roomId}
                userId={userId}
            />
        </div>
    );
}