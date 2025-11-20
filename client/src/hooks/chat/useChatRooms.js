// client/src/hooks/chat/useChatRooms.js
import { useState, useEffect, useCallback } from 'react';

export function useChatRooms(socket, userId, connected) {
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);

    // 방 목록 요청
    const refreshRooms = useCallback(() => {
        if (!socket || !userId) return;
        const authToken = localStorage.getItem('authToken');
        socket.emit('rooms:fetch', { userId, authToken });
    }, [socket, userId]);

    // 방 선택
    const selectRoom = useCallback((roomId) => {
        const rid = String(roomId || '');
        if (!rid || rid === currentRoomId) return;
        setCurrentRoomId(rid);
        // 메시지 로딩 로직은 currentRoomId 변경을 감지하는 useChatMessages에서 처리됨
    }, [currentRoomId]);

    useEffect(() => {
        if (!socket || !userId) return;

        // 연결 시 자동 갱신
        if (connected) refreshRooms();

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({ ...r, ROOM_ID: String(r.ROOM_ID) }));
            setRooms(normalized);
            // 알림을 위해 모든 방 Join
            normalized.forEach(room => {
                socket.emit('room:join', { roomId: room.ROOM_ID, userId });
            });
        };

        const onRoomsRefresh = () => {
            console.log('[Socket] Refreshing rooms...');
            refreshRooms();
        };

        const onNewRoomCreated = (roomData) => {
            if (!roomData) return;
            refreshRooms();
            // 내가 만든 방이면 자동 입장
            if (String(roomData.makerId) === String(userId)) {
                setCurrentRoomId(String(roomData.roomId || roomData.ROOM_ID));
            }
        };

        socket.on('rooms:list', onRoomsList);
        socket.on('rooms:refresh', onRoomsRefresh);
        socket.on('room:new_created', onNewRoomCreated);

        return () => {
            socket.off('rooms:list', onRoomsList);
            socket.off('rooms:refresh', onRoomsRefresh);
            socket.off('room:new_created', onNewRoomCreated);
        };
    }, [socket, userId, connected, refreshRooms]);

    return { rooms, currentRoomId, selectRoom, refreshRooms};
}