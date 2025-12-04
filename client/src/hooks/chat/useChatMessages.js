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

    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

    // 초기화 및 히스토리 요청
    useEffect(() => {
        if (!socket || !userId || !currentRoomId) return;
        setMessages([]);
        setHasMoreMessages(true);
        setIsInitialLoad(true);
        setIsLoadingMore(false);
        setIsReadStatusLoaded(false);
        readStatusMapRef.current = {};
        isReadStatusLoadedRef.current = false;

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

        socket.emit('chat:mark_as_read', {
            roomId: currentRoomId,
            lastReadTimestamp: latest.SENT_AT
        });
    }, [socket, currentRoomId]);

    const editMessage = useCallback((msgId, content) => socket?.emit('chat:edit', { roomId: currentRoomId, msgId, content }), [socket, currentRoomId]);
    const deleteMessage = useCallback((msgId) => socket?.emit('chat:delete', { roomId: currentRoomId, msgId }), [socket, currentRoomId]);
    const overrideMessages = useCallback((newMessages) => {
        setMessages(newMessages); setIsInitialLoad(false); setHasMoreMessages(true); setHasFutureMessages(true);
    }, []);

    // 소켓 이벤트 핸들러
    useEffect(() => {
        if (!socket) return;

        const onChatHistory = (data) => {
            const rawMessages = data.messages || [];
            let readMap = {};

            // 1. 멤버별 읽은 시간 파싱
            if (data.memberReadStatus) {
                Object.keys(data.memberReadStatus).forEach(k => readMap[String(k)] = Number(data.memberReadStatus[k]));
                readStatusMapRef.current = readMap;
                setIsReadStatusLoaded(true);
                isReadStatusLoadedRef.current = true;
            }

            // 2. 메시지별로 '누가 이미 읽었는지' 계산하여 readBy 배열 생성
            const processedMessages = rawMessages.map(msg => {
                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
                const readBy = [];

                Object.keys(readMap).forEach(memberId => {
                    const lastRead = readMap[memberId];
                    // 이 멤버가 읽은 시간(lastRead)이 메시지 시간(msgTs)보다 크면 읽은 것임
                    if (lastRead >= msgTs) {
                        readBy.push(memberId);
                    }
                });

                return { ...msg, readBy }; // 계산된 readBy 주입
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
            if (String(msg.SENDER_ID) === String(userId) && msg.TEMP_ID) {
                setMessages(prev => prev.map(m => m.TEMP_ID === msg.TEMP_ID ? msg : m));
                return;
            }
            if (String(msg.ROOM_ID || msg.roomId) === String(currentRoomIdRef.current)) {
                setMessages(prev => [...prev, msg]);
            }
        };

        // [★ 최종] 실시간 업데이트 (readBy로 중복 방지, 시간 조건 삭제)
        const onReadUpdate = (data) => {
            if (!data || !data.userId || !data.lastReadTimestamp) return;
            if (!isReadStatusLoadedRef.current) return;

            const { userId: rId, lastReadTimestamp } = data;

            // 1. 내 이벤트 무시 (혹시 모를 중복 방지)
            if (String(rId) === String(userId)) return;

            const ts = typeof lastReadTimestamp === 'number' ? lastReadTimestamp : new Date(lastReadTimestamp).getTime();

            // 2. [복구됨] 과거/중복 이벤트 무시 -> 재입장 시 -1 문제 해결!
            // (서버 시간이 UTC로 맞춰졌으므로 실시간 업데이트를 막지 않습니다)
            const prevReadTs = readStatusMapRef.current[String(rId)] || 0;
            if (ts <= prevReadTs) {
                return;
            }

            // 3. 최신 시간 업데이트
            readStatusMapRef.current[String(rId)] = ts;

            setMessages(prev => prev.map(msg => {
                if (msg.unreadCount <= 0) return msg;
                // 내가 보낸 메시지를 내가 읽었다고 해서 카운트를 줄이면 안 됨 (원래 0이거나 관리 대상 아님)
                // 하지만 상대방이 내 메시지를 읽었을 때는 줄여야 함
                if (String(msg.SENDER_ID) === String(rId)) return msg;

                // [중복 방지] readBy 배열 체크
                const readBy = msg.readBy || [];
                if (readBy.includes(rId)) return msg;

                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();

                // [실시간] 시간 비교 (오차 범위 60초)
                if (msgTs <= ts + 60000) {
                    return {
                        ...msg,
                        unreadCount: Math.max(0, msg.unreadCount - 1),
                        readBy: [...readBy, rId]
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