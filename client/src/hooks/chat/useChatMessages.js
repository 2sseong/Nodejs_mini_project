// client/src/hooks/chat/useChatMessages.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { getNewerMessagesApi } from '../../api/chatApi'; // [import 추가]

const CHAT_PAGE_SIZE = 50;

export function useChatMessages(socket, userId, userNickname, currentRoomId) {
    const [messages, setMessages] = useState([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // [추가] 아래로 로딩 관련 상태
    const [isLoadingNewer, setIsLoadingNewer] = useState(false);
    const [hasFutureMessages, setHasFutureMessages] = useState(false);

    // 읽음 상태 관련
    const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false);
    const readStatusMapRef = useRef({});
    const isReadStatusLoadedRef = useRef(false);

    const messagesRef = useRef(messages);
    const hasFutureMessagesRef = useRef(hasFutureMessages);
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

    // [추가] 아래로 스크롤(최신 메시지 로드) 함수
    const loadNewerMessages = useCallback(async () => {
        if (!currentRoomId || isLoadingNewer || !hasFutureMessages) return;

        const newest = messagesRef.current[messagesRef.current.length - 1];
        if (!newest) return;

        const newestId = newest.MSG_ID || newest.msg_id;
        console.log('[loadNewer] Fetching after:', newestId);

        setIsLoadingNewer(true);
        try {
            const res = await getNewerMessagesApi(currentRoomId, newestId);
            const newItems = res.data?.data || [];

            if (newItems.length > 0) {
                setMessages(prev => [...prev, ...newItems]);
            }

            // 가져온 개수가 요청 개수보다 적으면 "더 이상 미래 데이터 없음" -> 실시간 모드 전환
            if (newItems.length < CHAT_PAGE_SIZE) {
                setHasFutureMessages(false);
                console.log('[loadNewer] Reached live edge. Resuming real-time updates.');
            }
        } catch (err) {
            console.error('Failed to load newer messages:', err);
        } finally {
            setIsLoadingNewer(false);
        }
    }, [currentRoomId, isLoadingNewer, hasFutureMessages]);


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
        // [디버깅] 상태 확인 로그
        console.log('[loadMore] 호출됨! 상태:', {
            hasSocket: !!socket, // 소켓 존재 여부 (false면 여기서 막아야 함)
            isLoadingMore,
            hasMoreMessages,
            currentRoomId,
        });

        // 1. 방어 로직 강화: socket이 없으면 즉시 종료 (!socket 추가)
        if (!socket || isLoadingMore || !hasMoreMessages || !currentRoomId) {
            console.log('[loadMore] 조건 불충족으로 중단됨. (소켓 연결 대기 중일 수 있음)');
            return;
        }

        // 2. 가장 오래된 메시지 찾기
        const oldest = messagesRef.current.find(m => m.MSG_ID || m.msg_id);

        if (!oldest) {
            console.warn('[loadMore] 기준 메시지 ID를 찾을 수 없음');
            return;
        }

        // 3. 요청 전송
        console.log('[loadMore] 요청 전송:', oldest.MSG_ID || oldest.msg_id);

        setIsLoadingMore(true);
        isPaginatingRef.current = true;

        // 여기서 socket.emit을 하므로 위에서 !socket 체크가 필수
        socket.emit('chat:get_history', {
            roomId: currentRoomId,
            beforeMsgId: oldest.MSG_ID || oldest.msg_id,
            limit: CHAT_PAGE_SIZE
        });
    }, [isLoadingMore, hasMoreMessages, currentRoomId, socket]);

    // 읽음 처리 요청
    const markAsRead = useCallback(() => {
        // [수정] 임시 메시지(TEMP_ID 있음)는 건너뛰고, 서버에 저장된 마지막 메시지를 찾음
        const messages = messagesRef.current;
        let latest = null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (!messages[i].TEMP_ID) {
                latest = messages[i];
                break;
            }
        }

        if (!socket || !currentRoomId || !latest?.SENT_AT) return;

        console.log('[Client] markAsRead 요청 전송:', {
            roomId: currentRoomId,
            ts: latest.SENT_AT
        });

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

    // [추가] 메시지 리스트 강제 교체 (검색 이동용)
    const overrideMessages = useCallback((newMessages) => {
        setMessages(newMessages);
        setIsInitialLoad(false);
        setHasMoreMessages(true);
        setHasFutureMessages(true);
    }, []);

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
                    const exists = new Set(prev.map(m => String(m.MSG_ID || m.msg_id || m.TEMP_ID)));

                    const filteredNew = newMessages.filter(m => {
                        const id = String(m.MSG_ID || m.msg_id || m.TEMP_ID);
                        return !exists.has(id);
                    });

                    // 과거 메시지를 앞에 붙임
                    return [...filteredNew, ...prev];
                });
                setIsInitialLoad(false);
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

            if (hasFutureMessagesRef.current) {
                console.log('Viewing past history. Real-time message buffered/ignored:', msg.MSG_ID);
                return;
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
            console.log('[Client] chat:read_update 수신:', data);
            if (!isReadStatusLoadedRef.current) return;

            const { userId: rId, lastReadTimestamp } = data;
            const ts = typeof lastReadTimestamp === 'number' ? lastReadTimestamp : new Date(lastReadTimestamp).getTime();

            // 1. [중요] 업데이트하기 '전'의 마지막 시간을 먼저 가져옵니다.
            const prevReadTs = readStatusMapRef.current[String(rId)] || 0;

            console.log('[Client] chat:read_update processing:', {
                rId,
                ts,
                prevReadTs,
                diff: ts - prevReadTs
            });

            // 2. 이미 최신 상태라면 무시
            if (ts <= prevReadTs) {
                console.log('[Client] chat:read_update ignored (ts <= prevReadTs)');
                return;
            }

            // 3. Ref를 최신 값으로 업데이트
            readStatusMapRef.current[String(rId)] = ts;

            setMessages(prev => prev.map(msg => {
                const msgTs = typeof msg.SENT_AT === 'number' ? msg.SENT_AT : new Date(msg.SENT_AT).getTime();

                // 4. [조건 수정]
                // - msg.unreadCount > 0 : 안 읽은 상태여야 함
                // - msgTs > prevReadTs  : 이전에 읽은 시점보다는 뒤에 온 메시지 (안 읽었던 것)
                // - msgTs <= ts + 1000  : 지금 읽은 시점보다는 앞에 온 메시지 (이제 읽은 것) (+1000은 오차 범위 허용)
                // - rId !== msg.SENDER_ID : 읽은 사람이 보낸 사람은 아니어야 함

                const isTarget = msg.unreadCount > 0 &&
                    msgTs > prevReadTs &&
                    msgTs <= ts + 1000 &&
                    String(rId) !== String(msg.SENDER_ID);

                if (isTarget) {
                    console.log(`[Client] Decrementing unread for msg ${msg.MSG_ID || msg.TEMP_ID}`, {
                        currentUnread: msg.unreadCount,
                        msgTs,
                        prevReadTs,
                        ts
                    });
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
        clearMessages: () => setMessages([]), overrideMessages, loadNewerMessages, isLoadingNewer,
        hasFutureMessages,
    };
}