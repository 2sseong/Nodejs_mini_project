// src/pages/ChatPage.jsx
import React from 'react';
import '../styles/ChatPage.css';

import { useAuthFromStorage } from '../hooks/useAuthFromStorage';
import { useChatSocket } from '../hooks/useChatSocket';

import ChatSidebar from '../components/Chatpage/Sidebar/ChatSidebar.jsx';
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import CreateRoomModal from '../components/Chatpage/Modals/CreateRoomModal.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';

export default function ChatPage() {
    const { authLoaded, userId, userNickname } = useAuthFromStorage();
    const {
        connected,
        rooms,
        messages,
        currentRoomId,
        selectRoom,
        sendMessage,
    } = useChatSocket({ userId, userNickname });

    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [isInviteOpen, setIsInviteOpen] = React.useState(false);

    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));

    if (!authLoaded) return <div>로딩 중... (인증 확인)</div>;
    if (!userId || !userNickname) return <div>로그인 페이지로 이동 중...</div>;

    return (
        <div className="chat-container">
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
                        />

                        <MessageList messages={messages} userId={userId} />

                        <MessageInput
                            onSend={(text) => sendMessage({ text })}
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