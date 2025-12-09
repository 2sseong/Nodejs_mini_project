import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * - 기능: 목록 조회, 실시간 정렬(최신 메시지 수신 시), 안 읽은 메시지 카운트 관리
 */
export function useChatRooms(socket, userId, connected) {
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);

    // 이벤트 리스너 내부에서 최신 state를 참조하기 위한 Ref
    const currentRoomIdRef = useRef(currentRoomId);

    // currentRoomId 변경 시 Ref 동기화 및 안 읽은 메시지 초기화
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;

        if (currentRoomId) {
            setRooms((prevRooms) =>
                prevRooms.map((room) => {
                    // 현재 들어온 방의 ID와 같다면 안 읽은 개수를 0으로 강제 설정
                    if (String(room.ROOM_ID) === String(currentRoomId)) {
                        return { ...room, UNREAD_COUNT: 0 };
                    }
                    return room;
                })
            );
            if (socket && userId) {
                socket.emit('room:read', { roomId: currentRoomId, userId });
            }
        }
    }, [currentRoomId, socket, userId]);

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
    }, [currentRoomId]);

    useEffect(() => {
        if (!socket || !userId) return;

        if (connected) refreshRooms();

        const onRoomsList = (roomList) => {
            // 초기 로딩 시 데이터 정규화
            const normalized = (roomList || []).map(r => ({
                ...r,
                ROOM_ID: String(r.ROOM_ID),
                // 초기값 설정 (백엔드에서 주지 않을 경우 대비)
                UNREAD_COUNT: r.UNREAD_COUNT || 0,
                LAST_MESSAGE: r.LAST_MESSAGE || '',
                MEMBER_COUNT: r.MEMBER_COUNT || r.memberCount || 1
            }));

            setRooms(normalized);

            // 알림 수신을 위해 소켓 room join
            normalized.forEach(room => {
                socket.emit('room:join', { roomId: room.ROOM_ID, userId });
            });
        };

        const onRoomsRefresh = () => {
            // console.log('[Socket] Refreshing rooms...');
            refreshRooms();
        };

        const onNewRoomCreated = (roomData) => {
            if (!roomData) return;
            refreshRooms(); // 목록 전체 갱신
            // 내가 만든 방이면 자동 입장
            if (String(roomData.makerId) === String(userId)) {
                setCurrentRoomId(String(roomData.roomId || roomData.ROOM_ID));
            }
        };

        const onReadComplete = ({ roomId }) => {
            setRooms((prev) =>
                prev.map((r) =>
                    String(r.ROOM_ID) === String(roomId)
                        ? { ...r, UNREAD_COUNT: 0 }
                        : r
                )
            );
        };

        // [핵심] 실시간 읽음 처리 수신 (내가 읽었을 때 목록 카운트 제거용)
        const onReadUpdate = ({ userId: readerId, roomId }) => {

            // 읽은 사람이 나(userId)일 경우에만 해당 방의 뱃지를 제거
            if (String(readerId) === String(userId)) {
                setRooms((prev) =>
                    prev.map((r) =>
                        String(r.ROOM_ID) === String(roomId)
                            ? { ...r, UNREAD_COUNT: 0 }
                            : r
                    )
                );
            }
        };

        const onRoomUpdateCount = ({ roomId, memberCount }) => {
            setRooms((prevRooms) =>
                prevRooms.map((room) => {
                    if (String(room.ROOM_ID) === String(roomId)) {
                        return {
                            ...room,
                            MEMBER_COUNT: memberCount
                        };
                    }
                    return room;
                })
            );
        };


        // [핵심] 실시간 메시지 수신 시 목록 정렬 및 정보 갱신
        const onChatMessage = (msg) => {
            if (!msg || !msg.ROOM_ID) return;

            setRooms((prevRooms) => {
                const targetId = String(msg.ROOM_ID);
                const index = prevRooms.findIndex(r => String(r.ROOM_ID) === targetId);

                // 목록에 없는 방(새로 초대된 방 등)이면 리프레시 요청
                if (index === -1) {
                    refreshRooms();
                    return prevRooms;
                }

                const newRooms = [...prevRooms];
                const targetRoom = { ...newRooms[index] };

                // 1. 최근 메시지 내용 갱신
                targetRoom.LAST_MESSAGE = msg.MESSAGE_TYPE === 'FILE'
                    ? '(파일 전송)'
                    : (msg.CONTENT || '');

                // 2. 안 읽은 메시지 카운트 갱신
                const isMyMessage = String(msg.SENDER_ID) === String(userId);
                // 현재 내가 선택한 방이 아닐 때만 카운트 증가
                const isCurrentRoom = targetId === String(currentRoomIdRef.current);

                if (!isMyMessage && !isCurrentRoom) {
                    targetRoom.UNREAD_COUNT = (targetRoom.UNREAD_COUNT || 0) + 1;
                }

                // 3. 배열 재정렬: 타겟 방을 맨 앞으로 이동
                newRooms.splice(index, 1);
                newRooms.unshift(targetRoom);

                return newRooms;
            });
        };

        // 리스너 추가
        socket.on('rooms:list', onRoomsList);
        socket.on('rooms:refresh', onRoomsRefresh);
        socket.on('room:new_created', onNewRoomCreated);
        socket.on('chat:message', onChatMessage);
        socket.on('room:read_complete', onReadComplete);
        socket.on('chat:read_update', onReadUpdate);
        socket.on('room:update_count', onRoomUpdateCount);

        return () => {
            socket.off('rooms:list', onRoomsList);
            socket.off('rooms:refresh', onRoomsRefresh);
            socket.off('room:new_created', onNewRoomCreated);
            socket.off('chat:message', onChatMessage);
            socket.off('room:read_complete', onReadComplete);
            socket.off('chat:read_update', onReadUpdate);
            socket.off('room:update_count', onRoomUpdateCount);
        };
    }, [socket, userId, connected, refreshRooms]);

    // [추가] 안 읽은 메시지 총합이 변경될 때 Electron 배지 업데이트
    useEffect(() => {
        const totalUnread = rooms.reduce((sum, room) => sum + (room.UNREAD_COUNT || 0), 0);

        // Electron 환경에서만 배지 업데이트
        if (window.electronAPI?.updateBadge) {
            window.electronAPI.updateBadge(totalUnread);
        }
    }, [rooms]);

    return { rooms, currentRoomId, selectRoom, refreshRooms };
}