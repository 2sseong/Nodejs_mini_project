import { useState, useEffect, useRef, useCallback } from 'react';
import { getNewerMessagesApi } from '../../api/chatApi';

const CHAT_PAGE_SIZE = 50;

export function useChatMessages(socket, userId, userNickname, currentRoomId) {
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isLoadingNewer, setIsLoadingNewer] = useState(false);
    const [hasFutureMessages, setHasFutureMessages] = useState(false);
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);

    const readStatusMapRef = useRef({});
    const isReadStatusLoadedRef = useRef(false);
    const messagesRef = useRef(messages);
    const hasFutureMessagesRef = useRef(hasFutureMessages);
    const currentRoomIdRef = useRef(currentRoomId);
    const isPaginatingRef = useRef(false);
    const lastSentTimestampRef = useRef(0); // 중복 호출 방지

    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

    useEffect(() => {
        if (!socket || !userId || !currentRoomId) return;
        setMessages([]);
        setHasMoreMessages(true);
        setIsInitialLoad(true);
        setIsLoadingMore(false);
        setIsReadStatusLoaded(false);
        readStatusMapRef.current = {};
        isReadStatusLoadedRef.current = false;
        lastSentTimestampRef.current = 0;

        socket.emit('chat:get_history', {
            roomId: currentRoomId,
            beforeMsgId: null,
            limit: CHAT_PAGE_SIZE
        });
    }, [socket, userId, currentRoomId]);

    const loadNewerMessages = useCallback(async () => {
        if (!currentRoomId || isLoadingNewer || !hasFutureMessages) return;
        const newest = messagesRef.current[messagesRef.current.length - 1];
        if (!newest) return;

        setIsLoadingNewer(true);
        try {
            const res = await getNewerMessagesApi(currentRoomId, newest.MSG_ID || newest.msg_id);
            const newItems = res.data?.data || [];
            if (newItems.length > 0) setMessages(prev => [...prev, ...newItems]);
            if (newItems.length < CHAT_PAGE_SIZE) setHasFutureMessages(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingNewer(false);
        }
    }, [currentRoomId, isLoadingNewer, hasFutureMessages]);

    const sendMessage = useCallback(({ text }) => {
        const trimmed = text.trim();
        if (!trimmed || !currentRoomId || !socket) return;
        const msg = {
            ROOM_ID: String(currentRoomId), SENDER_ID: userId, NICKNAME: userNickname,
            CONTENT: trimmed, SENT_AT: Date.now(), TEMP_ID: `temp_${Date.now()}`
        };
        setIsInitialLoad(false);
        setMessages(prev => [...prev, msg]);
        socket.emit('chat:message', msg);
    }, [currentRoomId, socket, userId, userNickname]);

    const loadMoreMessages = useCallback(() => {
        if (!socket || isLoadingMore || !hasMoreMessages || !currentRoomId) return;
        const oldest = messagesRef.current.find(m => m.MSG_ID || m.msg_id);
        if (!oldest) return;

        setIsLoadingMore(true);
        isPaginatingRef.current = true;
        socket.emit('chat:get_history', {
            roomId: currentRoomId,
            beforeMsgId: oldest.MSG_ID || oldest.msg_id,
            limit: CHAT_PAGE_SIZE
        });
    }, [isLoadingMore, hasMoreMessages, currentRoomId, socket]);

    const markAsRead = useCallback(() => {
        const msgs = messagesRef.current;
        let latest = null;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (!msgs[i].TEMP_ID) { latest = msgs[i]; break; }
        }
        if (!socket || !currentRoomId || !latest?.SENT_AT) return;

        const ts = latest.SENT_AT;
        // 같은 타임스탬프 중복 호출 방지
        if (ts === lastSentTimestampRef.current) return;
        lastSentTimestampRef.current = ts;

        console.log('[Client] Emitting chat:mark_as_read', { roomId: currentRoomId, lastReadTimestamp: ts });
        socket.emit('chat:mark_as_read', {
            roomId: currentRoomId,
            lastReadTimestamp: ts
        });
    }, [socket, currentRoomId]);

    const editMessage = useCallback((msgId, content) => socket?.emit('chat:edit', { roomId: currentRoomId, msgId, content }), [socket, currentRoomId]);
    const deleteMessage = useCallback((msgId) => socket?.emit('chat:delete', { roomId: currentRoomId, msgId }), [socket, currentRoomId]);
    const overrideMessages = useCallback((newMessages) => {
        setMessages(newMessages); setIsInitialLoad(false); setHasMoreMessages(true); setHasFutureMessages(true);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onChatHistory = (data) => {
            const rawMessages = data.messages || [];
            let readMap = {};

            if (data.memberReadStatus) {
                Object.keys(data.memberReadStatus).forEach(k => {
                    readMap[String(k).trim().toLowerCase()] = Number(data.memberReadStatus[k]);
                });
                readStatusMapRef.current = readMap;
                setIsReadStatusLoaded(true);
                isReadStatusLoadedRef.current = true;
            }

            const processedMessages = rawMessages.map(msg => {
                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
                const readBy = [];

                Object.keys(readMap).forEach(memberId => {
                    const readerId = String(memberId).trim().toLowerCase();
                    const lastRead = readMap[readerId];
                    if (lastRead >= msgTs - 2000) {
                        readBy.push(readerId);
                    }
                });

                return {
                    ...msg,
                    readBy,
                    unreadCount: typeof msg.unreadCount === 'number' ? msg.unreadCount : 0
                };
            });

            if (isPaginatingRef.current) {
                setMessages(prev => {
                    const exists = new Set(prev.map(m => String(m.MSG_ID || m.msg_id || m.TEMP_ID)));
                    const filtered = processedMessages.filter(m => !exists.has(String(m.MSG_ID || m.msg_id || m.TEMP_ID)));
                    return [...filtered, ...prev];
                });
                isPaginatingRef.current = false;
            } else {
                setMessages(processedMessages);
                setIsInitialLoad(true);
            }
            setIsLoadingMore(false);
            if (rawMessages.length < CHAT_PAGE_SIZE) setHasMoreMessages(false);
        };

        const onChatMessage = (msg) => {
            if (!msg) return;
            setIsInitialLoad(false);
            if (hasFutureMessagesRef.current) return;
            if (String(msg.SENDER_ID || msg.sender_id) === String(userId) && msg.TEMP_ID) {
                setMessages(prev => prev.map(m => m.TEMP_ID === msg.TEMP_ID ? msg : m));
                return;
            }
            if (String(msg.ROOM_ID || msg.roomId) === String(currentRoomIdRef.current)) {
                setMessages(prev => [...prev, msg]);
            }
        };

        const onReadUpdate = (data) => {
            if (!data || !data.userId || !data.lastReadTimestamp) return;

            const { userId: rId, lastReadTimestamp } = data;
            const ts = typeof lastReadTimestamp === 'number' ? lastReadTimestamp : new Date(lastReadTimestamp).getTime();
            const readerId = String(rId).trim().toLowerCase();

            readStatusMapRef.current[readerId] = Math.max(readStatusMapRef.current[readerId] || 0, ts);

            setMessages(prev => prev.map(msg => {
                const currentUnread = typeof msg.unreadCount === 'number' ? msg.unreadCount : 0;
                if (currentUnread <= 0) return msg;

                const rawSenderId = msg.SENDER_ID || msg.sender_id;
                if (!rawSenderId) return msg;

                const senderId = String(rawSenderId).trim().toLowerCase();
                if (senderId === readerId) return msg;

                const readBy = (msg.readBy || []).map(id => String(id).trim().toLowerCase());
                if (readBy.includes(readerId)) return msg;

                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();

                if (msgTs <= ts + 60000) {
                    return {
                        ...msg,
                        unreadCount: Math.max(0, currentUnread - 1),
                        readBy: [...(msg.readBy || []), readerId]
                    };
                }
                return msg;
            }));
        };

        const onEdit = ({ msgId, content }) => setMessages(p => p.map(m => String(m.MSG_ID) === String(msgId) ? { ...m, CONTENT: content } : m));
        const onDelete = ({ msgId }) => setMessages(p => p.filter(m => String(m.MSG_ID) !== String(msgId)));
        const onProfileUpdate = ({ userId: uId, profilePic }) => {
            setMessages(prev => prev.map(m => String(m.SENDER_ID) === String(uId) ? { ...m, PROFILE_PIC: profilePic } : m));
        };

        socket.on('chat:history', onChatHistory);
        socket.on('chat:message', onChatMessage);
        socket.on('chat:read_update', onReadUpdate);
        socket.on('chat:message_updated', onEdit);
        socket.on('chat:message_deleted', onDelete);
        socket.on('profile_updated', onProfileUpdate);

        return () => {
            socket.off('chat:history', onChatHistory);
            socket.off('chat:message', onChatMessage);
            socket.off('chat:read_update', onReadUpdate);
            socket.off('chat:message_updated', onEdit);
            socket.off('chat:message_deleted', onDelete);
            socket.off('profile_updated', onProfileUpdate);
        };
    }, [socket, userId]);

    return {
        messages, isLoadingMore, hasMoreMessages, isInitialLoad, isReadStatusLoaded,
        sendMessage, loadMoreMessages, markAsRead, editMessage, deleteMessage,
        clearMessages: () => setMessages([]), overrideMessages, loadNewerMessages, isLoadingNewer, hasFutureMessages
    };
}