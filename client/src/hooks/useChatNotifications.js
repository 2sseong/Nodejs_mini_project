import { useEffect, useRef, useCallback } from 'react';

export function useChatNotifications({ 
    socket, 
    userId, 
    rooms, 
    currentRoomId, 
    selectRoom 
}) {
    // 리스너 내부에서 최신 state를 참조하기 위한 Refs
    // (Socket 이벤트 핸들러가 클로저 문제 없이 최신 값을 읽으려면 Ref가 필요합니다)
    const currentRoomIdRef = useRef(currentRoomId);
    const roomsRef = useRef(rooms);
    const userIdRef = useRef(userId);

    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    // [1] Electron -> React 방 이동 명령 수신 (기존 코드 원복)
    useEffect(() => {
        // Electron 환경인지 확인
        if (window.electronAPI && window.electronAPI.onCmdSelectRoom) {
            window.electronAPI.onCmdSelectRoom((event, roomId) => {
                console.log('[ChatPage] 알림 클릭 감지 -> 방 이동:', roomId);
                selectRoom(roomId);
            });
        }
    }, [selectRoom]);

    // [2] 알림 띄우기 함수 (기존 코드 원복)
    const showSystemNotification = useCallback((title, body, roomId) => {
        // Electron 환경인지 확인
        if (window.electronAPI && window.electronAPI.sendCustomNotification) {
            // [Electron] 메인 프로세스로 데이터 전송
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
            // [Web Browser] 브라우저 알림 Fallback
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

            console.log(`[DEBUG] 알림 판별: 보낸이(${msgSenderId}) vs 나(${myId})`);

            // 1. 내가 보낸 메시지는 알림 띄우지 않음
            if (msgSenderId === myId) return;
            
            // 2. 현재 보고 있는 방에서 온 메시지는 알림 띄우지 않음
            if (msgRoomId === activeRoomId) return;

            // 방 이름 찾기
            const targetRoom = roomsRef.current.find(r => String(r.ROOM_ID) === msgRoomId);
            const roomName = targetRoom ? targetRoom.ROOM_NAME : '새로운 메시지';
            
            let contentText = msg.MESSAGE_TYPE === 'FILE' 
                ? `📄 파일: ${msg.FILE_NAME || '전송됨'}` 
                : (msg.CONTENT || msg.TEXT || '');

            // 텍스트 길이 제한 (IPC 부하 방지)
            if (contentText.length > 150) {
                contentText = contentText.substring(0, 150) + '...';
            }

            // 알림 요청 함수 호출
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