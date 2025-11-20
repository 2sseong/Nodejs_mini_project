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
    const [onlineUsers, setOnlineUsers] = useState([]);

    // [수정] 읽음 맵은 렌더링과 무관하므로 Ref로만 관리 (동기화 문제 원천 차단)
    const readStatusMapRef = useRef({}); 
    const isReadStatusLoadedRef = useRef(false);
    // (isReadStatusLoaded state는 MessageList 전달용으로 유지)
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);

    const isPaginatingRef = useRef(false);
    const currentRoomIdRef = useRef(null);
    const prevRoomIdRef = useRef(null);
    
    const socket = useMemo(() => createSocket(userId), [userId]);

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // 방 목록 갱신
    const refreshRooms = useCallback(() => {
        if (!socket || !userId) return;
        const authToken = localStorage.getItem('authToken');
        socket.emit('rooms:fetch', { userId, authToken });
    }, [socket, userId]);

    const onRoomsRefresh = useCallback(() => {
        console.log('%c[Socket] You were invited to a new room! Refreshing list...', 'color: blue; font-weight: bold;');
        refreshRooms();
    }, [refreshRooms]); 

    // 상태 초기화
    const clearMessages = useCallback(() => {
        setMessages([]);
        setIsLoadingMore(false);
        setHasMoreMessages(true);
        setIsInitialLoad(true);
        isPaginatingRef.current = false;
        
        // 읽음 상태 및 로딩 플래그 초기화
        readStatusMapRef.current = {};
        setIsReadStatusLoaded(false);
        isReadStatusLoadedRef.current = false;
    }, []);

    // 방 변경 핸들러
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

    const selectRoom = useCallback((roomId) => {
        const rid = String(roomId || '');
        if (!rid || rid === currentRoomId) return;
        clearMessages();
        setCurrentRoomId(rid);
        handleRoomChange(rid);
    }, [currentRoomId, handleRoomChange, clearMessages]);

    // 더보기 로드
    const loadMoreMessages = useCallback(() => {
        if (isLoadingMore || !hasMoreMessages || !currentRoomIdRef.current) return;
        const currentMessages = messagesRef.current;
        const oldestMessage = currentMessages.find(m => m.MSG_ID);

        if (!oldestMessage) {
            console.error('[DEBUG] loadMoreMessages: No valid message with MSG_ID found. Aborting.');
            return;
        }
        
        const oldestMessageId = oldestMessage.MSG_ID;
        console.log(`Loading more messages before: ${oldestMessageId}`);

        setIsLoadingMore(true);
        setIsInitialLoad(false);
        isPaginatingRef.current = true;

        socket.emit('chat:get_history', {
            roomId: currentRoomIdRef.current,
            beforeMsgId: oldestMessageId,
            limit: CHAT_PAGE_SIZE
        });
    }, [isLoadingMore, hasMoreMessages, socket, setIsLoadingMore, setIsInitialLoad]);


    // [수정] onReadUpdate (Ref만 사용)
    const onReadUpdate = useCallback((data) => {
        if (!isReadStatusLoadedRef.current) return;

        const { userId: readerId, lastReadTimestamp } = data;
        const strReaderId = String(readerId);
        
        let readingTime;
        if (typeof lastReadTimestamp === 'number') {
            readingTime = lastReadTimestamp;
        } else {
            readingTime = new Date(lastReadTimestamp).getTime();
        }

        if (isNaN(readingTime)) return;

        // Ref에서 직접 조회 (가장 최신 값 보장됨)
        const prevReadTime = readStatusMapRef.current[strReaderId] || 0;

        // 과거 이벤트 무시
        if (readingTime <= prevReadTime) return;

        // Ref 업데이트 (State 업데이트 제거함 - 동기화 문제 방지)
        readStatusMapRef.current[strReaderId] = readingTime;

        console.log(`[🔥Socket] User ${strReaderId} Update: ${prevReadTime} -> ${readingTime}`);

        setMessages(prevMessages => {
            return prevMessages.map(msg => {
                let messageTime;
                if (typeof msg.SENT_AT === 'number') {
                    messageTime = msg.SENT_AT;
                } else {
                    messageTime = new Date(msg.SENT_AT).getTime();
                }

                if (
                    msg.unreadCount > 0 &&
                    messageTime > prevReadTime && 
                    messageTime <= readingTime + 1000 && 
                    String(strReaderId) !== String(msg.SENDER_ID)
                ) {
                     return { ...msg, unreadCount: Math.max(0, msg.unreadCount - 1) };
                }
                return msg;
            });
        });
    }, []);

    // [추가] 메시지 수정 요청 함수
    const editMessage = useCallback((msgId, newContent) => {
        if (!socket || !currentRoomIdRef.current) return;
        socket.emit('chat:edit', { 
            roomId: currentRoomIdRef.current, 
            msgId, 
            content: newContent 
        });
    }, [socket]);

    // [추가] 메시지 삭제 요청 함수
    const deleteMessage = useCallback((msgId) => {
        if (!socket || !currentRoomIdRef.current) return;
        socket.emit('chat:delete', { 
            roomId: currentRoomIdRef.current, 
            msgId 
        });
    }, [socket]);


    // 메인 소켓 이벤트 바인딩
    useEffect(() => {
        if (!socket || !userId) return;

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

        const onDisconnect = (reason) => {
            setConnected(false);
            console.warn('socket disconnected:', reason);
        };

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({ ...r, ROOM_ID: String(r.ROOM_ID) }));
            setRooms(normalized);
            if (currentRoomIdRef.current == null && normalized.length > 0) {
                const first = normalized[0].ROOM_ID;
                setCurrentRoomId(first);
                handleRoomChange(first);
            }
        };

        const onChatHistory = (data) => {
            const newMessages = data.messages || []; 
            const count = newMessages.length;

            if (data.memberReadStatus) {
                const normalizedMap = {};
                Object.keys(data.memberReadStatus).forEach(key => {
                    normalizedMap[String(key)] = Number(data.memberReadStatus[key]);
                });
                
                // Ref만 업데이트 (State 제거)
                readStatusMapRef.current = normalizedMap;
                
                setIsReadStatusLoaded(true);
                isReadStatusLoadedRef.current = true;
                console.log('[onChatHistory] Map loaded:', normalizedMap);
            }

            if (isPaginatingRef.current) {
                console.log(`Loaded ${count} older messages.`);
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.MSG_ID || m.TEMP_ID));
                    const uniqueIncoming = newMessages.filter(m => {
                        const id = m.MSG_ID || m.TEMP_ID;
                        return !existingIds.has(id);
                    });
                    return [...uniqueIncoming, ...prev];
                });
                isPaginatingRef.current = false;
            } else {
                console.log(`Loaded ${count} initial messages.`);
                setMessages(newMessages); 
                setIsInitialLoad(true);
            }

            setIsLoadingMore(false);
            if (count < CHAT_PAGE_SIZE) {
                setHasMoreMessages(false);
            }
        };

        const onChatMessage = (msg) => {
            if (!msg) return;
            setIsInitialLoad(false);
            const senderId = String(msg.SENDER_ID);
            let messageTime;
            if (typeof msg.SENT_AT === 'number') {
                messageTime = msg.SENT_AT;
            } else {
                messageTime = new Date(msg.SENT_AT).getTime();
            }

            // 현재 저장된 시간보다 더 최신일 때만 업데이트
            const currentSenderTime = readStatusMapRef.current[senderId] || 0;
            if (messageTime > currentSenderTime) {
                readStatusMapRef.current[senderId] = messageTime;
                console.log(`[Socket] Implicit Read Update for Sender ${senderId}: -> ${messageTime}`);
            }

            // 2. 메시지 목록 추가
            if (String(msg.SENDER_ID) === String(userId) && msg.TEMP_ID) {
                setMessages(prev =>
                    prev.map(m => (m.TEMP_ID === msg.TEMP_ID ? msg : m))
                );
                return;
            }
        
        const incomingRoomId = String(msg.ROOM_ID || msg.roomId);
        const currentRefId = String(currentRoomIdRef.current);
        if (incomingRoomId === currentRefId) {
            setMessages(prev => [...prev, msg]);
        }
    };

        const onNewRoomCreated = (roomData) => {
            if (!roomData) return;
            refreshRooms();
            const newRoomId = String(roomData.roomId || roomData.ROOM_ID);
            setCurrentRoomId(newRoomId);
            handleRoomChange(newRoomId);
        };

        // [추가] 메시지 수정됨 이벤트 핸들러
        const onMessageUpdated = ({ msgId, content }) => {
            setMessages(prev => prev.map(m => {
                const id = m.MSG_ID || m.TEMP_ID;
                if (String(id) === String(msgId)) {
                    return { ...m, CONTENT: content };
                }
                return m;
            }));
        };

        // [추가] 메시지 삭제됨 이벤트 핸들러
        const onMessageDeleted = ({ msgId }) => {
            setMessages(prev => prev.filter(m => {
                const id = m.MSG_ID || m.TEMP_ID;
                return String(id) !== String(msgId);
            }));
        };

        socket.on('rooms:refresh', onRoomsRefresh);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rooms:list', onRoomsList);
        socket.on('chat:history', onChatHistory);
        socket.on('chat:message', onChatMessage);
        socket.on('room:new_created', onNewRoomCreated);
        socket.on('chat:message_updated', onMessageUpdated);
        socket.on('chat:message_deleted', onMessageDeleted);
        socket.on('ONLINE_USERS', (list) => {setOnlineUsers(list.map(String));});

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('chat:history', onChatHistory);
            socket.off('chat:message', onChatMessage);
            socket.off('room:new_created', onNewRoomCreated);
            socket.off('rooms:refresh', onRoomsRefresh);
            socket.off('chat:message_updated', onMessageUpdated);
            socket.off('chat:message_deleted', onMessageDeleted);
            socket.off('ONLINE_USERS');
        };
    }, [socket, userId, handleRoomChange, refreshRooms, onRoomsRefresh]); 

    // [독립] 읽음 업데이트 전용 리스너
    useEffect(() => {
        if (!socket) return;
        const handleReadUpdate = (data) => {
            onReadUpdate(data);
        };
        socket.off('chat:read_update');
        socket.on('chat:read_update', handleReadUpdate);
        return () => {
            socket.off('chat:read_update', handleReadUpdate);
        };
    }, [socket, onReadUpdate]);
    
    // 언마운트 시 소켓 닫기
    useEffect(() => {
        return () => { socket?.close(); };
    }, [socket]);

    // Ref 동기화
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    // 메시지 전송 함수
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

    // 읽음 처리 함수 (안전장치 포함)
    const markAsRead = useCallback(() => {
        const latestMessage = messagesRef.current[messagesRef.current.length - 1];
        
        // 로딩 전이거나 데이터 없으면 중단
        if (!socket || !currentRoomIdRef.current || !latestMessage || !latestMessage.SENT_AT) {
            return;
        }
        
        socket.emit('chat:mark_as_read', {
            roomId: currentRoomIdRef.current,
            lastReadTimestamp: latestMessage.SENT_AT
        });
        
    }, [socket]);

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
        markAsRead,
        isReadStatusLoaded, // Prop으로 전달하기 위해 반환
        editMessage,   // 반환 추가
        deleteMessage,
        onlineUsers
    };
}