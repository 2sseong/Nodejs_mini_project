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

import { apiLeaveRoom } from '../api/roomApi.jsx';

export default function ChatPage() {
    const { authLoaded, userId, userNickname } = useAuthFromStorage();
    const {
        connected,
        rooms,
        messages,
        currentRoomId,
        socket,
        selectRoom,
        sendMessage,
        refreshRooms,
        clearMessages,
    } = useChatSocket({ userId, userNickname });

    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [isInviteOpen, setIsInviteOpen] = React.useState(false);

    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));

    const handleLeaveRoom = async () => {
        if (!currentRoomId || !userId || !currentRoom) return;

        // 1. 사용자 확인
        const confirmLeave = window.confirm(`[${currentRoom.ROOM_NAME}] 방을 정말 나가시겠습니까?`);
        if (!confirmLeave) {
            return;
        }

        try {
            // [API 호출] 모듈화된 함수 사용
            console.log(currentRoom, userId);
            await apiLeaveRoom(currentRoom.ROOM_ID, userId);

            // 성공 시: 현재 방 선택 해제
            selectRoom(null);

            // 방 새로고침
            refreshRooms();

            // 메시지 초기화
            clearMessages();

            // 사용자에게 성공 메시지 제공 (옵션)
            alert(`[${currentRoom.ROOM_NAME}] 방에서 성공적으로 나갔습니다.`);


        } catch (error) {
            // 2. [추가] 에러 핸들링: 콘솔 로깅 및 사용자에게 알림
            console.error('방 나가기 실패:', error.response?.data || error.message);
            alert(error.response?.data?.message || '서버 오류로 인해 방 나가기에 실패했습니다.');
        }
    };
    

   // [수정] 파일 메시지 전송 핸들러
const handleSendFile = ({ fileName, mimeType, fileData }) => {
    if (!socket) return alert('소켓이 연결되지 않았습니다.');

    // [검증] 현재 방 ID와 닉네임이 유효한지 확인
    if (!currentRoomId || !userNickname) {
        console.error('Room ID or User Nickname is missing');
        alert('파일을 전송할 수 없습니다. (정보 부족)');
        return;
    }

    console.log('Sending file:', fileName);

    socket.emit('SEND_FILE', {
        roomId: currentRoomId,
        fileName,
        mimeType,
        fileData, // Base64 데이터
        userNickname: userNickname
    }, (response) => {
        // 3. 서버로부터의 콜백 처리
        if (!response.ok) {
            console.error('File upload failed:', response.error);
            alert(`파일 업로드 실패: ${response.error}`);
        } else {
            console.log('File upload successful');
        }
    });

    console.log('파일전송 소켓종료');
};


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
                            onLeaveRoom={handleLeaveRoom}
                        />

                        <MessageList messages={messages} userId={userId} />

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