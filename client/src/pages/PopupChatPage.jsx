import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatHandlers } from '../hooks/useChatHandlers';

// 채팅 화면 구성 요소 import
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';

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
        editMessage, deleteMessage, selectRoom
    } = chatSocket;

    const { handleLeaveRoom, handleSendFile } = useChatHandlers({
        ...chatSocket,
        userId, userNickname, 
        currentRoomId: roomId // 핸들러에 현재 방 ID 주입
    });

    const [isInviteOpen, setIsInviteOpen] = useState(false);

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

    if (!roomId) return <div>잘못된 접근입니다.</div>;

    return (
        <div className="chat-main" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', backgroundColor: 'white', overflow: 'hidden' }}>
            {/* 1. 헤더 */}
            <ChatHeader
                title={roomName}
                onOpenInvite={() => setIsInviteOpen(true)}
                disabled={!connected}
                onLeaveRoom={async () => { // 1. async 함수로 변경
                    const success = await handleLeaveRoom();
                    // 3. 성공했을 때만 창을 닫음
                    if (success) {
                        window.close(); 
                    }
                }}
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