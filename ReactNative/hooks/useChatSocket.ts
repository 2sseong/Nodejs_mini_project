import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket, disconnectSocket, getSocket } from '../utils/socket';
import { Message } from '../api/chat';
import * as SecureStore from 'expo-secure-store';

interface UseChatSocketReturn {
    socket: Socket | null;
    connected: boolean;
    messages: Message[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMoreMessages: boolean;
    currentNotice: any | null;
    sendMessage: (content: string, msgType?: string) => void;
    editMessage: (msgId: number, content: string) => void;
    deleteMessage: (msgId: number) => void;
    setNotice: (msgId: number, content: string) => void;
    joinRoom: (roomId: number) => void;
    leaveRoom: () => void;
    loadMoreMessages: () => void;
    markAsRead: () => void;
}

const CHAT_PAGE_SIZE = 50;

export function useChatSocket(roomId: number | null): UseChatSocketReturn {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [currentNotice, setCurrentNotice] = useState<any | null>(null);

    const currentRoomId = useRef<number | null>(null);
    const userDataRef = useRef<any>(null);
    const messagesRef = useRef<Message[]>([]);
    const lastSentTimestampRef = useRef<number>(0);
    const isPaginatingRef = useRef(false);

    // messagesRef 동기화
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // 소켓 초기화
    useEffect(() => {
        const initSocket = async () => {
            // 유저 데이터 로드
            const userDataStr = await SecureStore.getItemAsync('userData');
            if (userDataStr) {
                userDataRef.current = JSON.parse(userDataStr);
            }

            let existingSocket = getSocket();
            if (existingSocket && existingSocket.connected) {
                setSocket(existingSocket);
                setConnected(true);
                return;
            }

            const newSocket = await createSocket();
            if (newSocket) {
                setSocket(newSocket);
            }
        };

        initSocket();

        return () => {
            // 컴포넌트 언마운트 시 방 나가기
            if (currentRoomId.current && socket) {
                socket.emit('chat:leave', { roomId: currentRoomId.current });
            }
        };
    }, []);

    // 소켓 이벤트 리스너
    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            console.log('[useChatSocket] Socket connected');
            setConnected(true);

            // 재연결 시 방 다시 입장
            if (currentRoomId.current) {
                requestHistory(currentRoomId.current);
            }
        };

        const onDisconnect = () => {
            console.log('[useChatSocket] Socket disconnected');
            setConnected(false);
        };

        // 히스토리 로드 (chat:history 이벤트)
        const onChatHistory = (data: { messages: Message[]; memberReadStatus?: Record<string, number> }) => {
            console.log('[useChatSocket] chat:history received:', data.messages?.length);
            const rawMessages = data.messages || [];

            // 페이지네이션 여부에 따라 메시지 처리
            if (isPaginatingRef.current) {
                // 이전 메시지 로드 (맨 앞에 추가)
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => String(m.MSG_ID || (m as any).msg_id)));
                    const filtered = rawMessages.filter(m => !existingIds.has(String(m.MSG_ID || (m as any).msg_id)));
                    return [...filtered, ...prev];
                });
                isPaginatingRef.current = false;
            } else {
                setMessages(rawMessages);
            }

            setIsLoading(false);
            setIsLoadingMore(false);

            if (rawMessages.length < CHAT_PAGE_SIZE) {
                setHasMoreMessages(false);
            }
        };

        // 새 메시지 수신
        const onNewMessage = (msg: any) => {
            if (!msg) return;
            console.log('[useChatSocket] New message:', msg.MSG_ID || msg.msg_id);

            const msgRoomId = String(msg.ROOM_ID || msg.roomId);
            const senderId = String(msg.SENDER_ID || msg.sender_id);
            const userData = userDataRef.current;

            // 현재 방의 메시지인지 확인
            if (msgRoomId === String(currentRoomId.current)) {
                // 내가 보낸 메시지의 TEMP_ID 업데이트
                if (userData && senderId === String(userData.userId) && msg.TEMP_ID) {
                    setMessages(prev => prev.map(m =>
                        (m as any).TEMP_ID === msg.TEMP_ID ? msg : m
                    ));
                    return;
                }
                setMessages(prev => [...prev, msg]);
            }
        };

        // 메시지 읽음 상태 업데이트
        const onReadUpdate = (data: { userId: string; lastReadTimestamp: number; msgId?: number; unreadCount?: number }) => {
            if (!data) return;

            // msgId와 unreadCount가 있는 경우 (간단한 업데이트)
            if (data.msgId !== undefined && data.unreadCount !== undefined) {
                setMessages(prev =>
                    prev.map(msg =>
                        (msg.MSG_ID || (msg as any).msg_id) === data.msgId
                            ? { ...msg, UNREAD_COUNT: data.unreadCount }
                            : msg
                    )
                );
                return;
            }

            // lastReadTimestamp 기반 업데이트 (Client와 동일한 로직)
            if (!data.userId || !data.lastReadTimestamp) return;

            const readerId = String(data.userId).trim().toLowerCase();
            const ts = typeof data.lastReadTimestamp === 'number'
                ? data.lastReadTimestamp
                : new Date(data.lastReadTimestamp).getTime();

            setMessages(prev => prev.map(msg => {
                const currentUnread = typeof msg.UNREAD_COUNT === 'number' ? msg.UNREAD_COUNT : 0;
                if (currentUnread <= 0) return msg;

                const senderId = String(msg.USER_ID || (msg as any).SENDER_ID || '').trim().toLowerCase();
                if (senderId === readerId) return msg;

                const msgTs = typeof msg.CREATED_AT === 'number'
                    ? msg.CREATED_AT
                    : new Date(msg.CREATED_AT).getTime();

                if (msgTs <= ts + 60000) {
                    return {
                        ...msg,
                        UNREAD_COUNT: Math.max(0, currentUnread - 1)
                    };
                }
                return msg;
            }));
        };

        // 메시지 수정 이벤트
        const onMessageUpdated = (data: { msgId: number; content: string; updatedAt: string }) => {
            if (!data || !data.msgId) return;
            console.log('[useChatSocket] Message updated:', data.msgId);
            setMessages(prev => prev.map(msg =>
                (msg.MSG_ID || (msg as any).msg_id) === data.msgId
                    ? { ...msg, CONTENT: data.content, UPDATED_AT: data.updatedAt, IS_EDITED: true }
                    : msg
            ));
        };

        // 메시지 삭제 이벤트
        const onMessageDeleted = (data: { msgId: number }) => {
            if (!data || !data.msgId) return;
            console.log('[useChatSocket] Message deleted:', data.msgId);
            setMessages(prev => prev.filter(msg =>
                (msg.MSG_ID || (msg as any).msg_id) !== data.msgId
            ));
        };

        // 공지 업데이트 이벤트
        const onNoticeUpdated = (data: { roomId: number; notice: any }) => {
            if (String(data.roomId) === String(currentRoomId.current)) {
                console.log('[useChatSocket] Notice updated:', data.notice);
                setCurrentNotice(data.notice);
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('chat:history', onChatHistory);
        socket.on('chat:message', onNewMessage);
        socket.on('chat:read_update', onReadUpdate);
        socket.on('chat:message_updated', onMessageUpdated);
        socket.on('chat:message_deleted', onMessageDeleted);
        socket.on('room:notice_updated', onNoticeUpdated);

        // 연결 상태 확인
        if (socket.connected) {
            setConnected(true);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('chat:history', onChatHistory);
            socket.off('chat:message', onNewMessage);
            socket.off('chat:read_update', onReadUpdate);
            socket.off('chat:message_updated', onMessageUpdated);
            socket.off('chat:message_deleted', onMessageDeleted);
            socket.off('room:notice_updated', onNoticeUpdated);
        };
    }, [socket]);

    // 방 입장 시 히스토리 요청
    const requestHistory = useCallback((rid: number, beforeMsgId: number | null = null) => {
        if (!socket) return;

        console.log('[useChatSocket] Requesting history for room:', rid, 'beforeMsgId:', beforeMsgId);
        socket.emit('chat:get_history', {
            roomId: rid,
            beforeMsgId,
            limit: CHAT_PAGE_SIZE
        });
    }, [socket]);

    // 방 입장 시 자동 조인
    useEffect(() => {
        if (socket && connected && roomId && roomId !== currentRoomId.current) {
            console.log('[useChatSocket] Auto-joining room:', roomId);
            currentRoomId.current = roomId;
            setIsLoading(true);
            setMessages([]);
            setHasMoreMessages(true);
            requestHistory(roomId);
        }
    }, [socket, connected, roomId, requestHistory]);

    // 방 나가기
    const joinRoom = useCallback((rid: number) => {
        if (!socket) return;

        // 이전 방 나가기
        if (currentRoomId.current && currentRoomId.current !== rid) {
            socket.emit('chat:leave', { roomId: currentRoomId.current });
        }

        console.log('[useChatSocket] Joining room:', rid);
        currentRoomId.current = rid;
        setIsLoading(true);
        setMessages([]);
        setHasMoreMessages(true);
        requestHistory(rid);
    }, [socket, requestHistory]);

    // 방 나가기
    const leaveRoom = useCallback(() => {
        if (!socket || !currentRoomId.current) return;

        socket.emit('chat:leave', { roomId: currentRoomId.current });
        currentRoomId.current = null;
        setMessages([]);
    }, [socket]);

    // 이전 메시지 더 불러오기 (무한 스크롤)
    const loadMoreMessages = useCallback(() => {
        if (!socket || isLoadingMore || !hasMoreMessages || !currentRoomId.current) return;

        const msgs = messagesRef.current;
        const oldest = msgs.find(m => m.MSG_ID || (m as any).msg_id);
        if (!oldest) return;

        console.log('[useChatSocket] Loading more messages, oldest:', oldest.MSG_ID);
        setIsLoadingMore(true);
        isPaginatingRef.current = true;

        socket.emit('chat:get_history', {
            roomId: currentRoomId.current,
            beforeMsgId: oldest.MSG_ID || (oldest as any).msg_id,
            limit: CHAT_PAGE_SIZE
        });
    }, [socket, isLoadingMore, hasMoreMessages]);

    // 읽음 처리
    const markAsRead = useCallback(() => {
        const msgs = messagesRef.current;
        let latest: Message | null = null;

        // 가장 최신 메시지 (TEMP_ID가 없는) 찾기
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (!(msgs[i] as any).TEMP_ID) {
                latest = msgs[i];
                break;
            }
        }

        if (!socket || !currentRoomId.current || !latest) return;

        const ts = typeof latest.CREATED_AT === 'number'
            ? latest.CREATED_AT
            : new Date(latest.CREATED_AT).getTime();

        // 같은 타임스탬프 중복 호출 방지
        if (ts === lastSentTimestampRef.current) return;
        lastSentTimestampRef.current = ts;

        console.log('[useChatSocket] Emitting chat:mark_as_read', { roomId: currentRoomId.current, lastReadTimestamp: ts });
        socket.emit('chat:mark_as_read', {
            roomId: currentRoomId.current,
            lastReadTimestamp: ts
        });
    }, [socket]);

    // 메시지 전송
    const sendMessage = useCallback(async (content: string, msgType: string = 'TEXT') => {
        if (!socket || !currentRoomId.current || !content.trim()) return;

        const userData = userDataRef.current;
        if (!userData) {
            console.error('[useChatSocket] No user data');
            return;
        }

        const msg = {
            ROOM_ID: String(currentRoomId.current),
            SENDER_ID: userData.userId,
            NICKNAME: userData.nickname,
            CONTENT: content.trim(),
            SENT_AT: Date.now(),
            TEMP_ID: `temp_${Date.now()}`
        };

        console.log('[useChatSocket] Sending message:', { content: content.substring(0, 20) });

        // Optimistic update
        setMessages(prev => [...prev, msg as any]);

        socket.emit('chat:message', msg);
    }, [socket]);

    // 메시지 수정
    const editMessage = useCallback((msgId: number, content: string) => {
        if (!socket || !currentRoomId.current) return;

        console.log('[useChatSocket] Editing message:', msgId);
        socket.emit('chat:edit_message', {
            roomId: currentRoomId.current,
            msgId,
            content: content.trim()
        });
    }, [socket]);

    // 메시지 삭제
    const deleteMessage = useCallback((msgId: number) => {
        if (!socket || !currentRoomId.current) return;

        console.log('[useChatSocket] Deleting message:', msgId);
        socket.emit('chat:delete_message', {
            roomId: currentRoomId.current,
            msgId
        });
    }, [socket]);

    // 공지 설정
    const setNotice = useCallback((msgId: number, content: string) => {
        if (!socket || !currentRoomId.current) return;

        console.log('[useChatSocket] Setting notice:', msgId);
        socket.emit('room:set_notice', {
            roomId: currentRoomId.current,
            msgId,
            content
        });
    }, [socket]);

    return {
        socket,
        connected,
        messages,
        isLoading,
        isLoadingMore,
        hasMoreMessages,
        currentNotice,
        sendMessage,
        editMessage,
        deleteMessage,
        setNotice,
        joinRoom,
        leaveRoom,
        loadMoreMessages,
        markAsRead,
    };
}
