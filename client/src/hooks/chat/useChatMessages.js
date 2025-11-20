// client/src/hooks/chat/useChatMessages.js
import { useState, useEffect, useRef, useCallback } from 'react';

const CHAT_PAGE_SIZE = 50;

export function useChatMessages(socket, userId, userNickname, currentRoomId) {
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    
    // 읽음 상태 관련
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);
    const readStatusMapRef = useRef({});
    const isReadStatusLoadedRef = useRef(false);

    const messagesRef = useRef(messages);
    const currentRoomIdRef = useRef(currentRoomId);
    const isPaginatingRef = useRef(false);

    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

    // 방 변경 시 초기화 및 데이터 요청
    useEffect(() => {
        if (!socket || !userId || !currentRoomId) return;

        // 초기화
        setMessages([]);
        setHasMoreMessages(true);
        setIsInitialLoad(true);
        setIsLoadingMore(false);
        setIsReadStatusLoaded(false);
        readStatusMapRef.current = {};
        isReadStatusLoadedRef.current = false;

        // 히스토리 요청
        socket.emit('chat:get_history', {
            roomId: currentRoomId,
            beforeMsgId: null,
            limit: CHAT_PAGE_SIZE
        });
    }, [socket, userId, currentRoomId]);

    // 메시지 전송
    const sendMessage = useCallback(({ text }) => {
        const trimmed = text.trim();
        if (!trimmed || !currentRoomId || !socket || !userId) return;

        if (!socket.connected) socket.connect();

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

    // 더보기 로드
    const loadMoreMessages = useCallback(() => {
        if (isLoadingMore || !hasMoreMessages || !currentRoomId) return;
        
        const oldest = messagesRef.current.find(m => m.MSG_ID);
        if (!oldest) return;

        setIsLoadingMore(true);
        isPaginatingRef.current = true;
        
        socket.emit('chat:get_history', {
            roomId: currentRoomId,
            beforeMsgId: oldest.MSG_ID,
            limit: CHAT_PAGE_SIZE
        });
    }, [isLoadingMore, hasMoreMessages, currentRoomId, socket]);

    // 읽음 처리 요청
    const markAsRead = useCallback(() => {
        const latest = messagesRef.current[messagesRef.current.length - 1];
        if (!socket || !currentRoomId || !latest?.SENT_AT) return;

        socket.emit('chat:mark_as_read', {
            roomId: currentRoomId,
            lastReadTimestamp: latest.SENT_AT
        });
    }, [socket, currentRoomId]);

    const editMessage = useCallback((msgId, content) => {
        if (socket && currentRoomId) socket.emit('chat:edit', { roomId: currentRoomId, msgId, content });
    }, [socket, currentRoomId]);

    const deleteMessage = useCallback((msgId) => {
        if (socket && currentRoomId) socket.emit('chat:delete', { roomId: currentRoomId, msgId });
    }, [socket, currentRoomId]);

    // 이벤트 핸들러 등록
    useEffect(() => {
        if (!socket) return;

        const onChatHistory = (data) => {
            const newMessages = data.messages || [];
            
            // 읽음 맵 로드
            if (data.memberReadStatus) {
                const map = {};
                Object.keys(data.memberReadStatus).forEach(k => map[String(k)] = Number(data.memberReadStatus[k]));
                readStatusMapRef.current = map;
                setIsReadStatusLoaded(true);
                isReadStatusLoadedRef.current = true;
            }

            if (isPaginatingRef.current) {
                setMessages(prev => {
                    const exists = new Set(prev.map(m => m.MSG_ID || m.TEMP_ID));
                    return [...newMessages.filter(m => !exists.has(m.MSG_ID || m.TEMP_ID)), ...prev];
                });
                isPaginatingRef.current = false;
            } else {
                setMessages(newMessages);
                setIsInitialLoad(true);
            }
            
            setIsLoadingMore(false);
            if (newMessages.length < CHAT_PAGE_SIZE) setHasMoreMessages(false);
        };

        const onChatMessage = (msg) => {
            if (!msg) return;
            setIsInitialLoad(false);
            
            // 암시적 읽음 처리
            const senderId = String(msg.SENDER_ID);
            const ts = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
            if (ts > (readStatusMapRef.current[senderId] || 0)) {
                readStatusMapRef.current[senderId] = ts;
            }

            if (String(msg.SENDER_ID) === String(userId) && msg.TEMP_ID) {
                setMessages(prev => prev.map(m => m.TEMP_ID === msg.TEMP_ID ? msg : m));
                return;
            }

            if (String(msg.ROOM_ID || msg.roomId) === String(currentRoomIdRef.current)) {
                setMessages(prev => [...prev, msg]);
            }
        };

        const onReadUpdate = (data) => {
            if (!isReadStatusLoadedRef.current) return;
            const { userId: rId, lastReadTimestamp } = data;
            const ts = typeof lastReadTimestamp === 'number' ? lastReadTimestamp : new Date(lastReadTimestamp).getTime();
            
            if (ts <= (readStatusMapRef.current[String(rId)] || 0)) return;
            readStatusMapRef.current[String(rId)] = ts;

            setMessages(prev => prev.map(msg => {
                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
                if (msg.unreadCount > 0 && msgTs > (readStatusMapRef.current[String(rId)] || 0) && msgTs <= ts + 1000 && String(rId) !== String(msg.SENDER_ID)) {
                    return { ...msg, unreadCount: Math.max(0, msg.unreadCount - 1) };
                }
                return msg;
            }));
        };

        const onEdit = ({ msgId, content }) => setMessages(p => p.map(m => (String(m.MSG_ID) === String(msgId) ? { ...m, CONTENT: content } : m)));
        const onDelete = ({ msgId }) => setMessages(p => p.filter(m => String(m.MSG_ID) !== String(msgId)));

        socket.on('chat:history', onChatHistory);
        socket.on('chat:message', onChatMessage);
        socket.on('chat:read_update', onReadUpdate);
        socket.on('chat:message_updated', onEdit);
        socket.on('chat:message_deleted', onDelete);

        return () => {
            socket.off('chat:history', onChatHistory);
            socket.off('chat:message', onChatMessage);
            socket.off('chat:read_update', onReadUpdate);
            socket.off('chat:message_updated', onEdit);
            socket.off('chat:message_deleted', onDelete);
        };
    }, [socket, userId]);

    return {
        messages, isLoadingMore, hasMoreMessages, isInitialLoad, isReadStatusLoaded,
        sendMessage, loadMoreMessages, markAsRead, editMessage, deleteMessage,
        clearMessages: () => setMessages([]) 
    };
}