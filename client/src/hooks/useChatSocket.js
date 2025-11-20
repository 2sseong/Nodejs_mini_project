// src/hooks/useChatSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { createSocket } from '../lib/socket';

const CHAT_PAGE_SIZE = 50;

export function useChatSocket({ userId, userNickname }) {
    // [수정 1] socket을 useMemo가 아닌 State로 관리
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // 읽음 맵 Refs
    const readStatusMapRef = useRef({}); 
    const isReadStatusLoadedRef = useRef(false);
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);
    
    const isPaginatingRef = useRef(false);
    const currentRoomIdRef = useRef(null);
    const messagesRef = useRef(messages);

    // [수정 2] 소켓 생성 및 해제 전용 useEffect 추가
    // userId가 변경될 때만 소켓을 새로 생성하고, 컴포넌트가 사라질 때 닫습니다.
    useEffect(() => {
        if (!userId) return;

        console.log('[useChatSocket] Creating new socket connection...');
        const newSocket = createSocket(userId);
        setSocket(newSocket);

        return () => {
            console.log('[useChatSocket] Disconnecting socket...');
            newSocket.disconnect();
        };
    }, [userId]);

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
        
        readStatusMapRef.current = {};
        setIsReadStatusLoaded(false);
        isReadStatusLoadedRef.current = false;
    }, []);

    // 방 변경 핸들러
    const handleRoomChange = useCallback((newRoomId) => {
        const rid = String(newRoomId || '');
        if (!socket || !userId || !rid) return;

        socket.emit('chat:get_history', {
            roomId: rid,
            beforeMsgId: null,
            limit: CHAT_PAGE_SIZE
        });

        currentRoomIdRef.current = rid;
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


    // onReadUpdate (Ref만 사용)
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

        const prevReadTime = readStatusMapRef.current[strReaderId] || 0;

        if (readingTime <= prevReadTime) return;

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

    const editMessage = useCallback((msgId, newContent) => {
        if (!socket || !currentRoomIdRef.current) return;
        socket.emit('chat:edit', { 
            roomId: currentRoomIdRef.current, 
            msgId, 
            content: newContent 
        });
    }, [socket]);

    const deleteMessage = useCallback((msgId) => {
        if (!socket || !currentRoomIdRef.current) return;
        socket.emit('chat:delete', { 
            roomId: currentRoomIdRef.current, 
            msgId 
        });
    }, [socket]);


    // 메인 소켓 이벤트 바인딩
    useEffect(() => {
        // socket이 null이거나 연결되지 않았을 때는 바인딩하지 않음
        if (!socket || !userId) return;

        const onConnect = () => {
            console.log('[Socket] Connected event received');
            setConnected(true);
            const authToken = localStorage.getItem('authToken');
            socket.emit('rooms:fetch', { userId, authToken });
            refreshRooms();
        };

        const onDisconnect = (reason) => {
            setConnected(false);
            console.warn('socket disconnected:', reason);
        };

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({ ...r, ROOM_ID: String(r.ROOM_ID) }));
            setRooms(normalized);

            normalized.forEach(room => {
                socket.emit('room:join', { roomId: room.ROOM_ID, userId });
            });
            console.log(`[Socket] Joined all ${normalized.length} rooms for notifications.`);
        };

        const onChatHistory = (data) => {
            const newMessages = data.messages || []; 
            const count = newMessages.length;

            if (data.memberReadStatus) {
                const normalizedMap = {};
                Object.keys(data.memberReadStatus).forEach(key => {
                    normalizedMap[String(key)] = Number(data.memberReadStatus[key]);
                });
                
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

            const currentSenderTime = readStatusMapRef.current[senderId] || 0;
            if (messageTime > currentSenderTime) {
                readStatusMapRef.current[senderId] = messageTime;
                console.log(`[Socket] Implicit Read Update for Sender ${senderId}: -> ${messageTime}`);
            }

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
            
            if (String(roomData.makerId) === String(userId)) {
                 const newRoomId = String(roomData.roomId || roomData.ROOM_ID);
                 setCurrentRoomId(newRoomId);
                 handleRoomChange(newRoomId);
            }
        };

        const onMessageUpdated = ({ msgId, content }) => {
            setMessages(prev => prev.map(m => {
                const id = m.MSG_ID || m.TEMP_ID;
                if (String(id) === String(msgId)) {
                    return { ...m, CONTENT: content };
                }
                return m;
            }));
        };

        const onMessageDeleted = ({ msgId }) => {
            setMessages(prev => prev.filter(m => {
                const id = m.MSG_ID || m.TEMP_ID;
                return String(id) !== String(msgId);
            }));
        };

        // 이벤트 리스너 등록
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
            // 이벤트 리스너 해제
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

    // 읽음 업데이트 전용 리스너
    useEffect(() => {
        if (!socket) return;
        const handleReadUpdate = (data) => {
            onReadUpdate(data);
        };
        // 중복 방지
        socket.off('chat:read_update');
        socket.on('chat:read_update', handleReadUpdate);
        return () => {
            socket.off('chat:read_update', handleReadUpdate);
        };
    }, [socket, onReadUpdate]);
    
    // [수정 3] Ref 동기화 및 socket.close() 제거
    // socket 생성 useEffect에서 이미 close를 처리하므로 여기서는 제거했습니다.
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    // 메시지 전송 함수
    const sendMessage = useCallback(({ text }) => {
        const trimmed = text.trim();
        if (!trimmed || !currentRoomId || !socket || !userId) return;

        if (!socket.connected) {
            console.log('[sendMessage] Socket disconnected, reconnecting...');
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

    const markAsRead = useCallback(() => {
        const latestMessage = messagesRef.current[messagesRef.current.length - 1];
        
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
        isReadStatusLoaded, 
        editMessage,    
        deleteMessage,
        onlineUsers
    };
}