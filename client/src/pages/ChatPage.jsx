// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/ChatPage.css';

import { useAuth } from '../hooks/AuthContext.jsx';
import { useChatSocket } from '../hooks/useChatSocket';

import ChatSidebar from '../components/Chatpage/Sidebar/ChatSidebar.jsx';
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import CreateRoomModal from '../components/Chatpage/Modals/CreateRoomModal.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';

import { apiLeaveRoom } from '../api/roomApi.jsx';
import { Navigate } from 'react-router-dom';

export default function ChatPage() {
    const { authLoaded, userId, userNickname } = useAuth();
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
        isInitialLoad,
        isLoadingMore,
        hasMoreMessages,
        loadMoreMessages,
        markAsRead,
        isReadStatusLoaded,
        editMessage,   
        deleteMessage
    } = useChatSocket({ userId, userNickname });

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    
    // Refs for socket listener
    const currentRoomIdRef = useRef(currentRoomId);
    const roomsRef = useRef(rooms);
    const userIdRef = useRef(userId);

    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    // [1] 알림 클릭으로 인한 '방 이동' 명령 수신
    useEffect(() => {
        if (window.electronAPI?.onCmdSelectRoom) {
            window.electronAPI.onCmdSelectRoom((event, roomId) => {
                console.log('[ChatPage] 알림 클릭 감지 -> 방 이동:', roomId);
                selectRoom(roomId);
            });
        }
    }, [selectRoom]);

    // [2] 알림 요청 함수 (커스텀 윈도우 사용)
    const showSystemNotification = useCallback((title, body, roomId) => {
        // Electron 환경인지 확인
        if (window.electronAPI && window.electronAPI.sendCustomNotification) {
            // 메인 프로세스로 데이터 전송
            window.electronAPI.sendCustomNotification({
                id: Date.now(),
                title,          
                content: body,  
                roomName: title.split(' - ')[0]?.replace('💬 ', '') || '채팅방',
                nickname: title.split(' - ')[1] || '상대방',
                roomId,
                type: 'TEXT' 
            });
        } else {
            // 웹 브라우저 환경 Fallback (기존 시스템 알림)
            if (Notification.permission !== 'granted') {
                Notification.requestPermission();
            } else {
                const notif = new Notification(title, { body, silent: false });
                notif.onclick = () => {
                    selectRoom(roomId);
                    window.focus();
                };
            }
        }
    }, [selectRoom]);

    // [3] 소켓 메시지 수신 및 알림 트리거
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (msg) => {
            const msgRoomId = String(msg.ROOM_ID || msg.roomId || '');
            const msgSenderId = String(msg.SENDER_ID || msg.senderId || '');
            const myId = String(userIdRef.current || '');
            const activeRoomId = String(currentRoomIdRef.current || '');

            console.log(`[DEBUG] 알림 판별: 보낸이(${msgSenderId}) vs 나(${myId})`);

            // ✅ [중요] 필터링 로직 활성화 (원하는 기능)
            
            // 1. 내가 보낸 메시지는 알림 띄우지 않음
            if (msgSenderId === myId) {
                console.log('   ↳ 내가 보낸 메시지라 무시');
                return;
            }
            
            // 2. 현재 보고 있는 방에서 온 메시지는 알림 띄우지 않음 (선택사항)
            // (다른 방에 있을 때만 알림을 받고 싶다면 이 코드를 유지하세요)
            if (msgRoomId === activeRoomId) {
                console.log('   ↳ 현재 보고 있는 방이라 무시');
                return;
            }

            // 방 이름 찾기
            const targetRoom = roomsRef.current.find(r => String(r.ROOM_ID) === msgRoomId);
            const roomName = targetRoom ? targetRoom.ROOM_NAME : '새로운 메시지';
            
            let contentText = msg.MESSAGE_TYPE === 'FILE' 
                ? `📄 파일: ${msg.FILE_NAME || '전송됨'}` 
                : (msg.CONTENT || msg.TEXT || '');

            // 💡 핵심 수정: 텍스트가 150자를 넘으면 잘라서 보냄
            // 이렇게 하면 IPC 통신 부하를 줄이고 알림창 렉을 방지할 수 있습니다.
            if (contentText.length > 150) {
                contentText = contentText.substring(0, 150) + '...';
            }

            // 알림 요청
            showSystemNotification(
                `💬 ${roomName} - ${msg.NICKNAME || '상대방'}`,
                contentText,
                msgRoomId
            );
        };

        socket.on('chat:message', handleIncomingMessage);

        return () => {
            socket.off('chat:message', handleIncomingMessage);
        };
    }, [socket, showSystemNotification]);


    // [3] 알림 강제 테스트 함수
    const testNotification = () => {
        console.log("테스트 버튼 클릭됨");
        showSystemNotification("🔔 테스트 알림", "이 알림이 보이면 설정 성공!", currentRoomId);
    };

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

    console.log(`Sending file: ${fileName}, mimeType: ${mimeType}, fileData:${fileData}`);

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
    // if (!userId || !userNickname) return <div>로그인 페이지로 이동 중...</div>;
    if (!userId || !userNickname) return <Navigate to="/login" replace />;

    return (
        <div className="chat-container">

            {/* 🛠️ 알림 디버깅용 버튼 (문제 해결 후 삭제하세요) */}
            <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, opacity: 0.8 }}>
                <button onClick={testNotification} style={{ padding: '5px', background: 'red', color: 'white' }}>
                    알림 테스트 (Click Me)
                </button>
                <div style={{ background: 'white', fontSize: '10px' }}>
                    권한 상태: {Notification.permission}
                </div>
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