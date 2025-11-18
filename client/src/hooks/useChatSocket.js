import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createSocket } from '../lib/socket';

const CHAT_PAGE_SIZE = 50;

export function useChatSocket({ userId, userNickname }) {
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    
    const isPaginatingRef = useRef(false);
    const currentRoomIdRef = useRef(null);
    const prevRoomIdRef = useRef(null);
    const socket = useMemo(() => createSocket(userId), [userId]);
    

    // 방 목록 갱신 함수 (변경 없음)
    const refreshRooms = useCallback(() => {
        if (!socket || !userId) return;
        const authToken = localStorage.getItem('authToken');
        socket.emit('rooms:fetch', { userId, authToken });
    }, [socket, userId]);

    //   1. 'rooms:invited' 이벤트를 받았을 때 실행할 핸들러  
    // (기존 refreshRooms 함수를 재사용합니다)
    const onRoomsRefresh = useCallback(() => {
        console.log('%c[Socket] You were invited to a new room! Refreshing list...', 'color: blue; font-weight: bold;');
        refreshRooms();
    }, [refreshRooms]); // refreshRooms를 의존성으로 추가


    //   1. 'messages' state를 추적할 ref 생성  
    const messagesRef = useRef(messages);

    //2. 'messages' state가 변경될 때마다 ref를 '항상' 최신으로 업데이트
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);


    // 메세지 초기화
    const clearMessages = useCallback(() => {
        setMessages([]);
        setIsLoadingMore(false);
        setHasMoreMessages(true);
        setIsInitialLoad(true);
        isPaginatingRef.current = false;
    }, []);

    // --- 방 이동 + 히스토리 --- (변경 없음)
    const handleRoomChange = useCallback((newRoomId) => {
        const rid = String(newRoomId || '');
        if (!socket || !userId || !rid) return;

        const prev = prevRoomIdRef.current;
        if (prev && prev !== rid) {
            socket.emit('room:leave', { roomId: prev, userId });
        }

        socket.emit('room:join', { roomId: rid, userId });
        socket.emit('chat:get_history', {
            roomId: rid,
            beforeMsgId: null,
            limit: CHAT_PAGE_SIZE
        });

        currentRoomIdRef.current = rid;
        prevRoomIdRef.current = rid;
    }, [socket, userId]);

    // 선택 함수 (변경 없음)
    const selectRoom = useCallback((roomId) => {
        const rid = String(roomId || '');
        if (!rid || rid === currentRoomId) return;
        clearMessages();
        setCurrentRoomId(rid);
        handleRoomChange(rid);
    }, [currentRoomId, handleRoomChange, clearMessages]);

    //   loadMoreMessages 함수 (대폭 수정)  
    const loadMoreMessages = useCallback(() => {
        // 1. 가드 절 (state 사용)
        if (isLoadingMore || !hasMoreMessages || !currentRoomIdRef.current) return;

        //   3. state(messages) 대신 ref(messagesRef.current)에서 읽기  
        const currentMessages = messagesRef.current;

        console.log('[DEBUG] loadMoreMessages: Current messages state (from ref):', currentMessages.slice(0, 5));

        //   4. ref의 값으로 'oldestMessage' 찾기  
        const oldestMessage = currentMessages.find(m => m.MSG_ID);

        if (!oldestMessage) {
            console.error('[DEBUG] loadMoreMessages: No valid message with MSG_ID found. Aborting.');
            return;
        }
       
        //   5. oldestMessage에서 ID 추출 (순서 수정)  
        const oldestMessageId = oldestMessage.MSG_ID;
        console.log(`Loading more messages before: ${oldestMessageId}`);

        // (기존의 이 라인은 삭제: const oldestMessageId = messages[0]?.MSG_ID;)

        // 2. 상태 설정 (변경 없음)
        setIsLoadingMore(true);
        setIsInitialLoad(false);
        isPaginatingRef.current = true;

        // 3. 서버에 이전 내역 요청 (변경 없음)
        socket.emit('chat:get_history', {
            roomId: currentRoomIdRef.current,
            beforeMsgId: oldestMessageId,
            limit: CHAT_PAGE_SIZE
        });

        //   6. 의존성 배열에서 'messages' 제거 (Stale Closure 해결)  
    }, [isLoadingMore, hasMoreMessages, socket, setIsLoadingMore, setIsInitialLoad]);


    // ---------- 소켓 이벤트 바인딩 ----------
    useEffect(() => {
        if (!socket || !userId) return;

        // onConnect (변경 없음)
        const onConnect = () => {
            setConnected(true);
            const authToken = localStorage.getItem('authToken');
            socket.emit('rooms:fetch', { userId, authToken });
            refreshRooms();
            const rid = currentRoomIdRef.current;
            if (rid) {
                socket.emit('room:join', { roomId: rid, userId });
                socket.emit('chat:get_history', {
                    roomId: rid,
                    beforeMsgId: null,
                    limit: CHAT_PAGE_SIZE
                });
            }
        };
        // onDisconnect (변경 없음)
        const onDisconnect = (reason) => {
            setConnected(false);
            console.warn('socket disconnected:', reason);
        };
        // onRoomsList (변경 없음)
        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({ ...r, ROOM_ID: String(r.ROOM_ID) }));
            setRooms(normalized);
            if (currentRoomIdRef.current == null && normalized.length > 0) {
                const first = normalized[0].ROOM_ID;
                setCurrentRoomId(first);
                handleRoomChange(first);
            }
        };

        // onChatHistory (디버깅 로그 포함, 변경 없음)
        const onChatHistory = (historyMessages) => {
            const newMessages = historyMessages || [];
            console.log('[DEBUG] onChatHistory received:', newMessages);
            if (newMessages.length > 0) {
                console.log('[DEBUG] First message object keys:', Object.keys(newMessages[0]));
                console.log('[DEBUG] First message MSG_ID:', newMessages[0].MSG_ID);
            }
            const count = newMessages.length;
            if (isPaginatingRef.current) {
                console.log(`Loaded ${count} older messages.`);
                setMessages(prev => [...newMessages, ...prev]);
                isPaginatingRef.current = false;
            } else {
                console.log(`Loaded ${count} initial messages.`);
                setMessages(newMessages);
                setIsInitialLoad(true);
            }
            setIsLoadingMore(false);
            if (count < CHAT_PAGE_SIZE) {
                console.log('Reached end of history.');
                setHasMoreMessages(false);
            }
        };

        // onChatMessage (변경 없음)
        const onChatMessage = (msg) => {
            if (!msg) return;
            setIsInitialLoad(false);
            if (msg.SENDER_ID === userId && msg.TEMP_ID) {
                setMessages(prev =>
                    prev.map(m => (m.TEMP_ID === msg.TEMP_ID ? msg : m))
                );
                return;
            }
            const incomingRoomId = String(msg.ROOM_ID || msg.roomId);
            const currentRefId = String(currentRoomIdRef.current);
            if (incomingRoomId === currentRefId) {
                setMessages(prev => [...prev, msg]);
            } else {
                // (안 읽음 배지 로직)
            }
        };

        // onNewRoomCreated (변경 없음)
        const onNewRoomCreated = (roomData) => {
            if (!roomData) return;
            refreshRooms();
            const newRoomId = String(roomData.roomId || roomData.ROOM_ID);
            setCurrentRoomId(newRoomId);
            handleRoomChange(newRoomId);
        };

        socket.on('rooms:refresh', onRoomsRefresh);
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
            socket.off('rooms:refresh', onRoomsRefresh);
        };
    }, [socket, userId, handleRoomChange, refreshRooms, onRoomsRefresh]);

    // 언마운트 시 소켓 닫기 (변경 없음)
    useEffect(() => {
        return () => { socket?.close(); };
    }, [socket]);

    // ref 동기화 (변경 없음)
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    // 전송 (변경 없음)
    const sendMessage = useCallback(({ text }) => {
        const trimmed = text.trim();
        if (!trimmed || !currentRoomId || !socket || !userId) return;

        if (!socket.connected) {
            socket.connect();
            return;
        }

        const msg = {
            ROOM_ID: String(currentRoomId),
            SENDER_ID: userId,
            NICKNAME: userNickname,
            CONTENT: trimmed,
            SENT_AT: Date.now(),
            TEMP_ID: `temp_${Date.now()}` 
        };
        setIsInitialLoad(false);
        setMessages(prev => [...prev, msg]);
        socket.emit('chat:message', msg);
    }, [currentRoomId, socket, userId, userNickname]);

    // 반환 객체 (변경 없음)
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
        isLoadingMore,
        hasMoreMessages,
        isInitialLoad,
        loadMoreMessages,
    };
}