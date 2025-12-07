import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatHandlers } from '../hooks/useChatHandlers';

// ... (기존 import 유지)
import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';
import { searchMessagesApi, getMessagesContextApi } from '../api/chatApi';
import Titlebar from '../components/Titlebar/Titlebar.jsx';

import '../styles/PopupChatPage.css'; 

export default function PopupChatPage() {
    const { roomId } = useParams();
    const { userId, userNickname } = useAuth();

    const chatSocket = useChatSocket({userId, userNickname, roomId});
    
    const {
        socket, connected, rooms, messages, 
        sendMessage, loadMoreMessages, isLoadingMore, hasMoreMessages,
        markAsRead, isInitialLoad, isReadStatusLoaded, 
        editMessage, deleteMessage, selectRoom, loadNewerMessages, 
        hasFutureMessages, isLoadingNewer
    } = chatSocket;

    const { handleLeaveRoom, handleSendFile } = useChatHandlers({
        ...chatSocket,
        userId, userNickname, 
        currentRoomId: roomId 
    });

    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // --- [검색 기능 상태] ---
    const [searchMatches, setSearchMatches] = useState([]); 
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [scrollToMsgId, setScrollToMsgId] = useState(null);
    const lastSearchReqId = useRef(0);

    // =========================================================
    // [START] 읽음 처리 최적화 로직 (RoomPage 동기화 수정 완료)
    // =========================================================
    
    // 1. 윈도우 포커스 상태 추적
    const isWindowFocusedRef = useRef(document.hasFocus());
    // 2. 쓰로틀링(3초 제한) 기준 시간
    const lastFocusTimeRef = useRef(0);
    // 3. [핵심 추가] 화면이 꺼진 동안 메시지가 왔는지 체크하는 Ref
    const hasUnreadSinceLastFocusRef = useRef(false);

    // [통합 함수] 서버로 읽음 처리 요청 전송
    const sendMarkAsRead = (triggerSource) => {
        const now = Date.now();

        // '포커스 이벤트'일 때만 쓰로틀링 로직을 적용
        if (triggerSource === 'FOCUS_EVENT') {
            // [수정됨] "새로 온 안 읽은 메시지가 없다면" -> 3초 쿨타임 적용
            // (반대로 안 읽은 메시지가 쌓여 있다면(true), 3초가 안 지났어도 즉시 보냄)
            if (!hasUnreadSinceLastFocusRef.current) {
                if (now - lastFocusTimeRef.current < 3000) return; 
            }
        }

        if (socket && connected && roomId) {
            socket.emit('chat:mark_as_read', { 
                roomId, 
                lastReadTimestamp: now 
            });
            lastFocusTimeRef.current = now; 
            
            // 읽음 요청을 보냈으므로 "쌓인 안 읽은 메시지" 상태 초기화
            hasUnreadSinceLastFocusRef.current = false;
            // console.log(`[${triggerSource}] 읽음 처리 전송 완료`);
        }
    };

    // A. 윈도우 포커스 감지 (딴짓하다가 돌아왔을 때 처리)
    useEffect(() => {
        const handleFocus = () => {
            isWindowFocusedRef.current = true;
            sendMarkAsRead('FOCUS_EVENT');
        };
        const handleBlur = () => {
            isWindowFocusedRef.current = false;
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        // 초기 진입 시 이미 포커스 상태라면 즉시 요청
        if (document.hasFocus()) {
            sendMarkAsRead('FOCUS_EVENT');
        }

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, [roomId, socket, connected]);

    // B. 실시간 메시지 수신 감지 (화면 보고 있을 때 처리)
    useEffect(() => {
        if (!socket || !connected) return;

        const handleNewMessage = (msg) => {
            // 현재 방의 메시지이고 + 내가 보낸 게 아닐 때
            if (String(msg.ROOM_ID) === String(roomId) && msg.SENDER_ID !== userId) {
                
                if (isWindowFocusedRef.current) {
                    // 화면을 보고 있다면 -> 즉시 읽음 처리 (NEW_MESSAGE는 쓰로틀링 무시)
                    sendMarkAsRead('NEW_MESSAGE');
                } else {
                    // [핵심] 화면을 안 보고 있다면 -> "안 읽은 메시지 있음" 플래그 세움
                    // 나중에 돌아왔을 때(Focus) 3초 제한을 무시하고 바로 읽음 처리하기 위함
                    hasUnreadSinceLastFocusRef.current = true;
                }
            }
        };

        socket.on('chat:message', handleNewMessage);

        return () => {
            socket.off('chat:message', handleNewMessage);
        };
    }, [socket, connected, roomId, userId]);

    // =========================================================
    // [END] 읽음 처리 최적화 로직
    // =========================================================

    // ... (이하 handleServerSearch 등 기존 로직 동일하게 유지) ...
    const handleServerSearch = async (keyword) => {
        // ... (기존 코드)
        if (!keyword.trim()) {
            setSearchMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        const reqId = Date.now();
        lastSearchReqId.current = reqId;

        try {
            const response = await searchMessagesApi(roomId, keyword);
            
            if (lastSearchReqId.current !== reqId) return;

            const matches = response.data?.data || [];
            setSearchMatches(matches);

            if (matches.length > 0) {
                setCurrentMatchIndex(matches.length - 1);
            } else {
                setCurrentMatchIndex(-1);
            }
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    useEffect(() => {
        const moveToMatch = async () => {
            if (currentMatchIndex < 0 || searchMatches.length === 0 || currentMatchIndex >= searchMatches.length) return;

            const target = searchMatches[currentMatchIndex];
            if (!target) return;

            const targetId = target.MSG_ID || target.msg_id;
            const isAlreadyLoaded = messages.some(m => 
                String(m.MSG_ID || m.msg_id) === String(targetId)
            );

            if (isAlreadyLoaded) {
                setScrollToMsgId(targetId);
            } else {
                try {
                    const response = await getMessagesContextApi(roomId, targetId);
                    const newContextMessages = response.data?.data || [];
                    
                    if (chatSocket.overrideMessages) {
                        chatSocket.overrideMessages(newContextMessages); 
                    }

                    setTimeout(() => {
                        setScrollToMsgId(targetId);
                    }, 100);

                } catch (err) {
                    console.error("Failed to fetch context:", err);
                }
            }
        };
        moveToMatch();
    }, [currentMatchIndex, searchMatches, messages, roomId, chatSocket]); 

    const handlePrevMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev - 1 < 0 ? searchMatches.length - 1 : prev - 1));
    };

    const handleNextMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev + 1 >= searchMatches.length ? 0 : prev + 1));
    };

    useEffect(() => {
        if (socket && connected && roomId) {
            selectRoom(roomId);
        }
    }, [socket, connected, roomId, selectRoom]);

    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(roomId));
    const roomName = currentRoom ? currentRoom.ROOM_NAME : '채팅방';
    const memberCount = currentRoom ? currentRoom.MEMBER_COUNT : 0;

    const handleOpenDrawer = () => {
        window.open(`#/files/${roomId}`, 'FileDrawerWindow', 'width=400,height=600,resizable=yes,scrollbars=yes');
    };

    if (!roomId) return <div>잘못된 접근입니다.</div>;

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
            <Titlebar title={`채팅방 - ${roomName}`} />
            <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                <ChatHeader
                    title={roomName}
                    memberCount={memberCount}
                    onOpenInvite={() => setIsInviteOpen(true)}
                    onOpenDrawer={handleOpenDrawer}
                    disabled={!connected}
                    onLeaveRoom={async () => {
                        const success = await handleLeaveRoom();
                        if (success) window.close(); 
                    }}
                    onSearch={handleServerSearch} 
                    onPrevMatch={handlePrevMatch}
                    onNextMatch={handleNextMatch}
                    matchCount={searchMatches.length}
                    currentMatchIdx={currentMatchIndex}
                />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <MessageList 
                        messages={messages} 
                        userId={userId}
                        onLoadMore={loadMoreMessages}
                        isLoadingMore={isLoadingMore}
                        hasMoreMessages={hasMoreMessages}
                        isInitialLoad={isInitialLoad}
                        markAsRead={markAsRead} 
                        isReadStatusLoaded={isReadStatusLoaded}
                        onEditMessage={editMessage}
                        onDeleteMessage={deleteMessage}
                        scrollToMsgId={scrollToMsgId}
                        loadNewerMessages={loadNewerMessages}
                        hasFutureMessages={hasFutureMessages}
                        isLoadingNewer={isLoadingNewer}
                    />
                </div>
                <MessageInput
                    onSend={(text) => sendMessage({ text })}
                    onSendFile={handleSendFile}
                    disabled={!connected}
                />
                <InviteUserModal
                    isOpen={isInviteOpen}
                    onClose={() => setIsInviteOpen(false)}
                    currentRoomId={roomId}
                    userId={userId}
                />
            </div>
        </div>
    );
}