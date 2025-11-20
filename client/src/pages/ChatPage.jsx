// src/pages/ChatPage.jsx
import React, { useState} from 'react';
import '../styles/ChatPage.css';

import { useAuth } from '../hooks/useAuth';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatNotifications } from '../hooks/useChatNotifications'; // [추가]
import { useChatHandlers } from '../hooks/useChatHandlers';         // [추가]

import ChatSidebar from '../components/Chatpage/Sidebar/ChatSidebar.jsx';
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import CreateRoomModal from '../components/Chatpage/Modals/CreateRoomModal.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';

export default function ChatPage() {
    const { authLoaded, userId, userNickname } = useAuth();
    
    // 1. 소켓 및 채팅 데이터 상태 관리
    const {
        connected, rooms, messages, currentRoomId, socket,
        selectRoom, sendMessage, refreshRooms, clearMessages,
        isInitialLoad, isLoadingMore, hasMoreMessages, loadMoreMessages,
        markAsRead, isReadStatusLoaded, editMessage, deleteMessage
    } = useChatSocket({ userId, userNickname });

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // 2. 알림 로직 Hook 사용
    const { testNotification } = useChatNotifications({
        socket, userId, rooms, currentRoomId, selectRoom
    });

    // 3. 액션 핸들러 Hook 사용
    const { handleLeaveRoom, handleSendFile } = useChatHandlers({
        socket, userId, userNickname, rooms, currentRoomId, 
        selectRoom, refreshRooms, clearMessages
    });

    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));

    if (!authLoaded) return <div>로딩 중... (인증 확인)</div>;
    // if (!userId || !userNickname) return <div>로그인 페이지로 이동 중...</div>;
    if (!userId || !userNickname) return <Navigate to="/login" replace />;

    return (
        <div className="chat-container">
            {/* 디버깅 버튼 */}
            <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, opacity: 0.8 }}>
                <button onClick={testNotification} style={{ padding: '5px', background: 'red', color: 'white' }}>
                    알림 테스트
                </button>
            </div>

            <ChatSidebar
                userNickname={userNickname}
                connected={connected}
                rooms={rooms}
                currentRoomId={currentRoomId}
                onSelectRoom={selectRoom}
                onOpenCreateModal={() => setIsCreateOpen(true)}
            />

            <div className="chat-main">
                {currentRoomId ? (
                    <>
                        <ChatHeader
                            title={currentRoom?.ROOM_NAME}
                            onOpenInvite={() => setIsInviteOpen(true)}
                            disabled={!currentRoomId}
                            onLeaveRoom={handleLeaveRoom}
                        />

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

                        <MessageInput
                            onSend={(text) => sendMessage({ text })}
                            onSendFile={handleSendFile}
                            disabled={!connected}
                        />
                    </>
                ) : (
                    <div className="no-room-selected">
                        {rooms.length === 0 ? '참여중인 방이 없습니다.' : '채팅방을 선택해주세요.'}
                        {rooms.length === 0 && (
                            <button className="create-room-btn-large" onClick={() => setIsCreateOpen(true)}>
                                새 채팅방 만들기
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateRoomModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                userId={userId}
            />
            <InviteUserModal
                isOpen={isInviteOpen && !!currentRoomId}
                onClose={() => setIsInviteOpen(false)}
                currentRoomId={currentRoomId}
                userId={userId}
            />
        </div>
    );
}