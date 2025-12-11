// src/pages/RoomPage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import '../styles/RoomPage.css';

import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatNotifications } from '../hooks/useChatNotifications';

import RoomList from '../components/Room/RoomList/RoomList.jsx';
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

    useEffect(() => {
        if (rooms && rooms.length > 0) {
            console.log("========================================");
            console.log("🏠 ROOM PAGE: Total Rooms Count:", rooms.length);

            rooms.forEach((room, index) => {
                const memberCount = room.MEMBER_PROFILES?.length;

                // ⭐️ [보강된 디버깅] 모든 방의 ROOM_ID, ROOM_TYPE, MEMBER_COUNT를 출력합니다.
                console.log(`[Room ${index}] ID:${room.ROOM_ID}, TYPE:${room.ROOM_TYPE}, MEMBERS:${memberCount}`);

                if (memberCount === 2) {
                    console.log("✅ 1:1 Room Found! NAME:", room.ROOM_NAME);
                    console.log("   PROFILES:", room.MEMBER_PROFILES); // 1:1 방의 프로필만 상세 출력
                }
            });
            console.log("========================================");
        }
    }, [rooms]); // ⭐️ rooms 배열이 변경될 때만 실행

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

    // [추가] currentUser 객체 생성 (RoomItem에서 필요한 형식)
    const currentUser = {
        userId: userId,
        userNickname: userNickname,
        // 필요하다면 다른 사용자 정보(프로필 사진 등)도 추가 가능
    };

    return (
        <div className="chat-container" style={{ flexDirection: 'column' }}>
            <div style={{ width: '100%', height: '100%' }}>
                <RoomList
                    userNickname={userNickname}
                    connected={connected}
                    rooms={rooms}
                    currentRoomId={null}
                    onSelectRoom={handleRoomClick}
                    onOpenCreateModal={() => setIsCreateOpen(true)}
                    currentUser={currentUser}
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