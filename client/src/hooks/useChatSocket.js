// src/hooks/useChatSocket.js
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createSocket } from '../lib/socket';

export function useChatSocket({ userId, userNickname }) {
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [messages, setMessages] = useState([]);

    // 메세지 초기화
    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // 최신 값 보관
    const currentRoomIdRef = useRef(null);
    const prevRoomIdRef = useRef(null);

    const socket = useMemo(() => createSocket(userId), [userId]);

    // 방 목록 갱신 함수
    const refreshRooms = useCallback(() => {
        if (!socket || !userId) return;

        const authToken = localStorage.getItem('authToken');
        socket.emit('rooms:fetch', { userId, authToken });

    }, [socket, userId]);


    // --- 방 이동 + 히스토리 ---
    const handleRoomChange = useCallback((newRoomId) => {
        const rid = String(newRoomId || '');
        if (!socket || !userId || !rid) return;

        const prev = prevRoomIdRef.current;
        if (prev && prev !== rid) {
            socket.emit('room:leave', { roomId: prev, userId });
        }

        socket.emit('room:join', { roomId: rid, userId });
        socket.emit('chat:get_history', { roomId: rid });

        currentRoomIdRef.current = rid;
        prevRoomIdRef.current = rid;
    }, [socket, userId]);

    // 선택 함수
    const selectRoom = useCallback((roomId) => {
        const rid = String(roomId || '');
        if (!rid || rid === currentRoomId) return;
        setMessages([]);            // UI 즉시 클리어
        setCurrentRoomId(rid);      // 상태 반영
        handleRoomChange(rid);      // 서버 join + history
    }, [currentRoomId, handleRoomChange]);

    // ---------- 소켓 이벤트 바인딩 ----------
    // 중요: 의존성에서 currentRoomId / handleRoomChange 제거
    useEffect(() => {
        if (!socket || !userId) return;


        const onConnect = () => {
            setConnected(true);
            const authToken = localStorage.getItem('authToken');
            socket.emit('rooms:fetch', { userId, authToken });

            refreshRooms();

            // 재연결 시 현재 방 자동 재입장
            const rid = currentRoomIdRef.current;
            if (rid) {
                socket.emit('room:join', { roomId: rid, userId });
                socket.emit('chat:get_history', { roomId: rid });
            }
        };
        const onDisconnect = (reason) => {
            setConnected(false);
            // 디버깅에 도움
            console.warn('socket disconnected:', reason);
        };

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({ ...r, ROOM_ID: String(r.ROOM_ID) }));
            setRooms(normalized);

            // 첫 방 자동 진입
            if (currentRoomIdRef.current == null && normalized.length > 0) {
                const first = normalized[0].ROOM_ID;
                setCurrentRoomId(first);
                handleRoomChange(first);
            }
        };

        const onChatHistory = (historyMessages) => {
            setMessages(historyMessages || []);
        };

        const onChatMessage = (msg) => {
            const incomingRoomId = String(msg.ROOM_ID);
            if (incomingRoomId === String(currentRoomIdRef.current)) {
                setMessages(prev => [...prev, msg]);
            }
        };

        const onNewRoomCreated = (roomData) => {
            if (!roomData) return; // 방 데이터가 없는 경우 무시

            refreshRooms();

            const newRoomId = String(roomData.roomId || roomData.ROOM_ID);

            setCurrentRoomId(newRoomId);

            // 3. 새 방에 입장하고 히스토리를 요청합니다. (이 로직은 유지)
            handleRoomChange(newRoomId);

        };

        


        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rooms:list', onRoomsList);
        socket.on('chat:history', onChatHistory);
        socket.on('chat:message', onChatMessage);
        socket.on('room:new_created', onNewRoomCreated);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('chat:history', onChatHistory);
            socket.off('chat:message', onChatMessage);
            socket.off('room:new_created', onNewRoomCreated);
        };
    }, [socket, userId, handleRoomChange, refreshRooms]);

    // 언마운트 시에만 소켓 닫기
    useEffect(() => {
        return () => { socket?.close(); };
    }, [socket]);

    // ref 동기화
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    // 전송 (낙관적 업데이트 추가)
    const sendMessage = useCallback(({ text }) => {
        const trimmed = text.trim();
        if (!trimmed || !currentRoomId || !socket || !userId) return;

        if (!socket.connected) {
            // 재연결 시도만 하고 종료 (원하면 큐잉 로직 추가 가능)
            socket.connect();
            return;
        }

        const msg = {
            ROOM_ID: String(currentRoomId),
            SENDER_ID: userId,
            NICKNAME: userNickname,
            CONTENT: trimmed,
            SENT_AT: Date.now(),
        };


        socket.emit('chat:message', msg);
    }, [currentRoomId, socket, userId, userNickname]);

    return {
        socket,
        connected,
        rooms,
        messages,
        currentRoomId,
        selectRoom,
        sendMessage,
        refreshRooms,
        clearMessages,
    };
}