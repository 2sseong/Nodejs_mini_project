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

            // 1. 내가 보낸 메시지는 알림 X
            if (msgSenderId === myId) return;
            
            // ✅ [수정된 로직]
            // 조건: "해당 방을 보고 있음" AND "창이 활성화(Focus) 되어 있음"
            // 이 두 가지가 모두 충족될 때만 알림을 무시합니다.
            const isViewingRoom = (msgRoomId === activeRoomId);
            const isWindowFocused = document.hasFocus(); // 현재 창 포커스 여부

            if (isViewingRoom && isWindowFocused) {
                console.log('👀 현재 방을 보고 있고 창이 활성화되어 있어 알림 생략');
                return;
            }

            // ---------------------------------------------------
            // [참고] 멀티 윈도우(새 창) 모드를 사용할 경우 추가 고려 사항
            // 만약 '새 창'이 열려있고 그 창이 포커스된 상태라면, 
            // 메인 창에서는 알림을 띄우지 않아야 할 수도 있습니다.
            // 이 부분은 IPC 통신으로 "해당 방의 윈도우가 포커스 상태인가?"를 체크해야 합니다.
            // (일단은 현재 창 기준으로만 작성했습니다)
            // ---------------------------------------------------

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