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

    // 중복 읽음 요청 방지를 위한 Ref
    const processedReadReqRef = useRef(new Set());

    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

    // 방 변경 시 처리 내역 초기화
    useEffect(() => {
        processedReadReqRef.current.clear();
    }, [currentRoomId]);

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
        processedReadReqRef.current.clear();

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

            if (data.memberReadStatus) {
                Object.keys(data.memberReadStatus).forEach(k => {
                    readMap[String(k).trim().toLowerCase()] = Number(data.memberReadStatus[k]);
                });
                readStatusMapRef.current = readMap;
                setIsReadStatusLoaded(true);
                isReadStatusLoadedRef.current = true;
            }

            // 2. 메시지별로 '누가 이미 읽었는지' 계산하여 readBy 배열 생성
            const processedMessages = rawMessages.map(msg => {
                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();
                const readBy = [];

                // [중요] ID 비교를 위해 모두 소문자로 준비
                // const senderId = String(msg.SENDER_ID || msg.sender_id || '').trim().toLowerCase(); 

                Object.keys(readMap).forEach(memberId => {
                    const readerId = String(memberId).trim().toLowerCase();

                    // [★ 핵심 수정 1] 자문자답 방지 코드 제거!
                    // 내가 보낸 메시지라도, 내가 읽었다면 readBy에 포함시켜야 합니다.
                    // 그래야 나중에 "내가 읽었다"는 이벤트가 와도 "이미 readBy에 있네?" 하고 무시할 수 있습니다.
                    // if (senderId === readerId) return;  <-- 이 줄 삭제함

                    const lastRead = readMap[readerId];

                    // 시간 비교 (UTC 기준, 2초 오차 허용)
                    if (lastRead >= msgTs - 2000) {
                        readBy.push(readerId); // 소문자 ID 저장
                    }
                });

                return { ...msg, readBy };
            });

            // [초기 진입 시 방어 로직] 안 읽은 메시지 서버에 알림
            if (!isPaginatingRef.current) {
                const myId = String(userId).trim().toLowerCase();
                const unreadMsgIds = [];

                processedMessages.forEach(msg => {
                    const msgId = msg.MSG_ID || msg.msg_id;
                    const senderId = String(msg.SENDER_ID || msg.sender_id || '').trim().toLowerCase();

                    // 1. 내가 보낸 메시지는 읽음 처리 요청 대상 아님 (당연함)
                    if (senderId === myId) return;

                    // 2. 이미 readBy 목록에 내가 있다면 패스
                    const readBy = (msg.readBy || []).map(id => String(id).trim().toLowerCase());
                    if (readBy.includes(myId)) return;

                    // 3. 중복 요청 방지
                    if (processedReadReqRef.current.has(msgId)) return;

                    unreadMsgIds.push(msgId);
                    processedReadReqRef.current.add(msgId);
                });

                if (unreadMsgIds.length > 0) {
                    socket.emit('chat:mark_batch_read', {
                        roomId: currentRoomIdRef.current,
                        messageIds: unreadMsgIds,
                        userId: userId
                    });
                }
            }

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
            if (!isReadStatusLoadedRef.current) return;

            const { userId: rId, lastReadTimestamp } = data;
            const ts = typeof lastReadTimestamp === 'number' ? lastReadTimestamp : new Date(lastReadTimestamp).getTime();

            const readerId = String(rId).trim().toLowerCase(); // 소문자 변환

            // 최신 읽은 시간 갱신
            readStatusMapRef.current[readerId] = Math.max(readStatusMapRef.current[readerId] || 0, ts);

            setMessages(prev => prev.map(msg => {
                if (msg.unreadCount <= 0) return msg;

                const rawSenderId = msg.SENDER_ID || msg.sender_id;
                if (!rawSenderId) return msg;

                const senderId = String(rawSenderId).trim().toLowerCase();

                // 자문자답 방지 (보낸 사람이 읽은 사람이면 카운트 줄이지 않음)
                // *주의: readBy에는 추가해도 되지만, unreadCount는 줄이면 안 됨
                if (senderId === readerId) return msg;

                // [★ 핵심 수정 2] readBy 체크 시 확실하게 소문자로 비교
                const readBy = (msg.readBy || []).map(id => String(id).trim().toLowerCase());
                if (readBy.includes(readerId)) return msg;

                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();

                // 시간 비교 (UTC)
                if (msgTs <= ts + 60000) {
                    return {
                        ...msg,
                        unreadCount: Math.max(0, msg.unreadCount - 1),
                        // [★ 핵심 수정 3] 배열에 추가할 때도 'readerId'(소문자 변환된 값) 사용
                        // 기존 rId(원본)를 넣으면 나중에 includes 체크 실패할 수 있음
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