import { useEffect, useRef, useCallback } from 'react';

export function useChatNotifications({ 
    socket, 
    userId, 
    rooms, 
    currentRoomId, 
    selectRoom 
}) {
    // 리스너 내부에서 최신 state를 참조하기 위한 Refs
    const currentRoomIdRef = useRef(currentRoomId);
    const roomsRef = useRef(rooms);
    const userIdRef = useRef(userId);

    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    // [1] Electron -> React 방 이동 명령 수신
    useEffect(() => {
        if (window.electronAPI?.onCmdSelectRoom) {
            const cleanup = window.electronAPI.onCmdSelectRoom((event, roomId) => {
                console.log('[ChatPage] 알림 클릭 감지 -> 방 이동:', roomId);
                selectRoom(roomId);
            });
            // (참고: electronAPI 구현에 따라 cleanup 함수가 없을 수도 있음)
            return () => { if(typeof cleanup === 'function') cleanup(); }
        }
    }, [selectRoom]);

    // [2] 알림 띄우기 함수
    const showSystemNotification = useCallback((title, body, roomId) => {
        if (window.electronAPI && window.electronAPI.sendCustomNotification) {
            // Electron 환경
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
            // 웹 브라우저 환경
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

    // [3] 소켓 메시지 감지 및 알림 트리거
    useEffect(() => {
        if (!socket) return;

        const handleIncomingMessage = (msg) => {
            const msgRoomId = String(msg.ROOM_ID || msg.roomId || '');
            const msgSenderId = String(msg.SENDER_ID || msg.senderId || '');
            const myId = String(userIdRef.current || '');
            const activeRoomId = String(currentRoomIdRef.current || '');

            // 1. 내가 보낸 메시지 무시
            if (msgSenderId === myId) return;
            
            // 2. 현재 보고 있는 방 메시지 무시
            if (msgRoomId === activeRoomId) return;

            const targetRoom = roomsRef.current.find(r => String(r.ROOM_ID) === msgRoomId);
            const roomName = targetRoom ? targetRoom.ROOM_NAME : '새로운 메시지';
            
            let contentText = msg.MESSAGE_TYPE === 'FILE' 
                ? `📄 파일: ${msg.FILE_NAME || '전송됨'}` 
                : (msg.CONTENT || msg.TEXT || '');

            if (contentText.length > 150) {
                contentText = contentText.substring(0, 150) + '...';
            }

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

    // 테스트용 함수 반환
    const testNotification = () => {
        console.log("테스트 버튼 클릭됨");
        showSystemNotification("🔔 테스트 알림", "이 알림이 보이면 설정 성공!", currentRoomId);
    };

    return { testNotification };
}