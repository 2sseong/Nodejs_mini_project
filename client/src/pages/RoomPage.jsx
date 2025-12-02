// src/pages/RoomPage.jsx
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import '../styles/RoomPage.css';

import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatNotifications } from '../hooks/useChatNotifications';

import ChatSidebar from '../components/Room/Sidebar/ChatSidebar.jsx';
import CreateRoomModal from '../components/Room/Modals/CreateRoomModal.jsx';

export default function RoomPage() {
    const { authLoaded, userId, userNickname } = useAuth();
    
    // 1. 소켓 연결 및 방 목록 관리
    // (Main 창에서는 채팅방 선택/갱신 기능 직접 사용 X -> 제거)
    const {
        connected,
        rooms,
        socket
    } = useChatSocket({ userId, userNickname });

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // 2. 알림 로직 (메인 창에서 백그라운드 알림 수신)
    // selectRoom: 알림 클릭 시 동작. 메인 창에서는 클릭 시 팝업을 열도록 설정
    useChatNotifications({
        socket, 
        userId, 
        rooms, 
        currentRoomId: null, 
        selectRoom: (roomId) => {
            if (window.electronAPI) {
                window.electronAPI.openChatWindow(roomId);
            }
        }
    });

    // 3. 방 클릭 핸들러 (팝업 열기)
    const handleRoomClick = (roomId) => {
        if (window.electronAPI) {
            window.electronAPI.openChatWindow(roomId);
        } else {
            alert('이 기능은 데스크탑 앱에서만 지원됩니다.');
        }
    };

    if (!authLoaded) return <div>로딩 중...</div>;
    if (!userId || !userNickname) return <Navigate to="/login" replace />;

    return (
        <div className="chat-container" style={{ flexDirection: 'column' }}> 
            <div style={{ width: '100%', height: '100%' }}>
                <ChatSidebar
                    userNickname={userNickname}
                    connected={connected}
                    rooms={rooms}
                    currentRoomId={null}
                    onSelectRoom={handleRoomClick}
                    onOpenCreateModal={() => setIsCreateOpen(true)}
                />
            </div>

            {/* 방 생성 모달 */}
            <CreateRoomModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                userId={userId}
            />
        </div>
    );
}