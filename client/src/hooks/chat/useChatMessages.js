import { useState, useEffect, useRef, useCallback } from 'react';
import { getNewerMessagesApi, getMessagesContextApi } from '../../api/chatApi';

const CHAT_PAGE_SIZE = 50;

export function useChatMessages(socket, userId, userNickname, currentRoomId) {
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isLoadingNewer, setIsLoadingNewer] = useState(false);
    const [hasFutureMessages, setHasFutureMessages] = useState(false);
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);
    const [firstUnreadMsgId, setFirstUnreadMsgId] = useState(null); // 첫 읽지 않은 메시지 ID

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

    // Ref for immediate loading state check (prevents duplicate calls)
    const isLoadingNewerRef = useRef(false);

    const loadNewerMessages = useCallback(async () => {
        // Use ref for immediate check (state update is async)
        if (!currentRoomId || isLoadingNewerRef.current || !hasFutureMessages) {
            return;
        }
        const newest = messagesRef.current[messagesRef.current.length - 1];
        if (!newest) {
            return;
        }

        const newestMsgId = newest.MSG_ID || newest.msg_id;
        console.log('[loadNewerMessages] Loading newer from msgId:', newestMsgId);

        // Set ref immediately to prevent duplicate calls
        isLoadingNewerRef.current = true;
        setIsLoadingNewer(true);

        try {
            const res = await getNewerMessagesApi(currentRoomId, newestMsgId);
            const newItems = res.data?.data || [];
            console.log('[loadNewerMessages] Received:', newItems.length, 'items');

            if (newItems.length > 0) {
                // Deduplicate messages by MSG_ID
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => String(m.MSG_ID || m.msg_id)));
                    const uniqueNewItems = newItems.filter(m => !existingIds.has(String(m.MSG_ID || m.msg_id)));
                    return uniqueNewItems.length > 0 ? [...prev, ...uniqueNewItems] : prev;
                });
            }

            if (newItems.length < CHAT_PAGE_SIZE) {
                console.log('[loadNewerMessages] No more future messages');
                setHasFutureMessages(false);
            }
        } catch (err) {
            console.error('[loadNewerMessages] Error:', err);
        } finally {
            isLoadingNewerRef.current = false;
            setIsLoadingNewer(false);
        }
    }, [currentRoomId, hasFutureMessages]);

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
                setFirstUnreadMsgId(null); // 페이지네이션에서는 리셋
            } else {
                // [수정] 서버에서 제공하는 firstUnreadMsgId 사용
                const serverFirstUnreadMsgId = data.firstUnreadMsgId || null;

                // 서버 제공 firstUnreadMsgId가 로드된 메시지에 있는지 확인
                if (serverFirstUnreadMsgId) {
                    const isInLoadedMessages = processedMessages.some(
                        m => String(m.MSG_ID || m.msg_id) === String(serverFirstUnreadMsgId)
                    );

                    if (isInLoadedMessages) {
                        // 로드된 메시지에 있으면 바로 사용
                        setMessages(processedMessages);
                        setIsInitialLoad(true);
                        setFirstUnreadMsgId(serverFirstUnreadMsgId);
                        setHasFutureMessages(true); // 더 최신 메시지가 있을 수 있음
                    } else {
                        // 로드된 메시지에 없으면 해당 메시지 컨텍스트 로드
                        console.log('[useChatMessages] First unread msg not in loaded messages, loading context:', serverFirstUnreadMsgId);
                        getMessagesContextApi(currentRoomId, serverFirstUnreadMsgId)
                            .then(res => {
                                const contextMessages = res.data?.data || [];
                                if (contextMessages.length > 0) {
                                    // 컨텍스트 메시지에 readBy 정보 추가
                                    const processedContextMsgs = contextMessages.map(msg => {
                                        const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
                                        const readBy = [];
                                        Object.keys(readMap).forEach(memberId => {
                                            const readerId = String(memberId).trim().toLowerCase();
                                            const lastRead = readMap[readerId];
                                            if (lastRead >= msgTs - 2000) {
                                                readBy.push(readerId);
                                            }
                                        });
                                        return { ...msg, readBy, unreadCount: typeof msg.unreadCount === 'number' ? msg.unreadCount : 0 };
                                    });
                                    setMessages(processedContextMsgs);
                                    setHasMoreMessages(true);
                                    setHasFutureMessages(true);
                                }
                                setIsInitialLoad(true);
                                setFirstUnreadMsgId(serverFirstUnreadMsgId);
                            })
                            .catch(err => {
                                console.error('[useChatMessages] Failed to load context:', err);
                                // 실패 시 기존 메시지 사용
                                setMessages(processedMessages);
                                setIsInitialLoad(true);
                                setFirstUnreadMsgId(null);
                            });
                    }
                } else {
                    // 안읽은 메시지 없음 - 바닥으로 스크롤
                    setMessages(processedMessages);
                    setIsInitialLoad(true);
                    setFirstUnreadMsgId(null);
                }
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
        clearMessages: () => setMessages([]), overrideMessages, loadNewerMessages, isLoadingNewer, hasFutureMessages,
        firstUnreadMsgId
    };
}