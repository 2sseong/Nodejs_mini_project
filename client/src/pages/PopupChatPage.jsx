import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { useChatHandlers } from '../hooks/useChatHandlers';

// 팝업 채팅 페이지 전용 훅들
import {
    useReadStatus,
    useNotice,
    useMessageSearch,
    useMessageEdit,
    useRoomNotification,
    useMemberPanel
} from '../hooks/popupChat';

import ChatHeader from '../components/Chatpage/Header/ChatHeader.jsx';
import MessageList from '../components/Chatpage/Messages/MessageList.jsx';
import MessageInput from '../components/Chatpage/Input/MessageInput.jsx';
import InviteUserModal from '../components/Chatpage/Modals/InviteUserModal.jsx';
import NoticeBar from '../components/Chatpage/NoticeBar/NoticeBar.jsx';
import Titlebar from '../components/Titlebar/Titlebar.jsx';

import '../styles/PopupChatPage.css';

export default function PopupChatPage() {
    const { roomId } = useParams();
    const { userId, userNickname } = useAuth();
    const chatSocket = useChatSocket({ userId, userNickname, roomId });

    const {
        socket, connected, rooms, messages,
        sendMessage, loadMoreMessages, isLoadingMore, hasMoreMessages,
        markAsRead, isInitialLoad, isReadStatusLoaded,
        editMessage, deleteMessage, selectRoom, loadNewerMessages,
        hasFutureMessages, isLoadingNewer, firstUnreadMsgId, overrideMessages
    } = chatSocket;

    const { handleLeaveRoom, handleSendFile } = useChatHandlers({
        ...chatSocket,
        userId, userNickname,
        currentRoomId: roomId
    });

    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // ===== 커스텀 훅 사용 =====

    // 읽음 처리
    useReadStatus({ socket, connected, roomId, userId });

    // 공지사항
    const { roomNotice, isNoticeVisible, setIsNoticeVisible, handleSetNotice } = useNotice({
        socket, connected, roomId
    });

    // 메시지 검색
    const {
        searchMatches, currentMatchIndex, scrollToMsgId, searchKeyword,
        handleServerSearch, handlePrevMatch, handleNextMatch
    } = useMessageSearch({ roomId, messages, overrideMessages });

    // 메시지 수정
    const { editingMessage, handleStartEdit, handleCancelEdit, handleSaveEdit } = useMessageEdit(editMessage);

    // 채팅방 알림
    const { isRoomNotificationEnabled, handleToggleRoomNotification } = useRoomNotification({
        socket, roomId, userId
    });

    // 멤버 패널
    const { isMemberPanelOpen, members, loadingMembers, handleToggleMemberPanel, closeMemberPanel } = useMemberPanel(roomId);

    // ===== 방 선택 =====
    useEffect(() => {
        if (socket && connected && roomId) {
            selectRoom(roomId);
        }
    }, [socket, connected, roomId, selectRoom]);

    const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(roomId));
    const roomName = currentRoom ? currentRoom.ROOM_NAME : '채팅방';
    const memberCount = currentRoom ? currentRoom.MEMBER_COUNT : 0;

    // ===== 서브 창 열기 유틸리티 =====
    const openSubWindow = (url, windowName, width = 400, height = 600) => {
        const currentX = window.screenX || window.screenLeft || 0;
        const currentY = window.screenY || window.screenTop || 0;
        const currentWidth = window.outerWidth || window.innerWidth;
        const screenWidth = window.screen.availWidth;

        let left = currentX + currentWidth;
        let top = currentY;

        if (left + width > screenWidth) {
            left = currentX - width;
            if (left < 0) left = 0;
        }

        const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
        const win = window.open(url, windowName, features);
        if (win) win.focus();
        return win;
    };

    const handleOpenDrawer = () => {
        openSubWindow(`#/files/${roomId}`, `FileDrawerWindow_${roomId}`);
    };

    // ===== 렌더링 =====
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', overflow: 'hidden' }}>
            <Titlebar title="" />
            <div className="chat-main" style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>

                {/* 멤버 모달 */}
                {isMemberPanelOpen && (
                    <>
                        <div className="member-modal-overlay" onClick={closeMemberPanel} />
                        <div className="member-modal">
                            <div className="member-modal-header">
                                <span>참여자 ({memberCount})</span>
                                <button onClick={closeMemberPanel} className="close-btn">
                                    <i className="bi bi-x"></i>
                                </button>
                            </div>
                            <div className="member-modal-list">
                                {loadingMembers ? (
                                    <div className="member-loading">불러오는 중...</div>
                                ) : (
                                    members.map((member) => (
                                        <div key={member.USER_ID} className="member-modal-item">
                                            {member.PROFILE_PIC ? (
                                                <img
                                                    src={`http://localhost:1337${member.PROFILE_PIC}`}
                                                    alt={member.NICKNAME}
                                                    className="member-avatar"
                                                />
                                            ) : (
                                                <div className="member-avatar-placeholder">
                                                    {member.NICKNAME?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <span className="member-nickname">
                                                {member.USER_ID === userId && <span className="me-badge">나</span>}
                                                {member.NICKNAME}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="member-modal-footer">
                                <button
                                    className="invite-btn"
                                    onClick={() => { closeMemberPanel(); setIsInviteOpen(true); }}
                                >
                                    <i className="bi bi-person-plus"></i> 대화 상대 초대하기
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* 오른쪽 채팅 영역 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <ChatHeader
                        title={roomName}
                        memberCount={memberCount}
                        onOpenInvite={() => setIsInviteOpen(true)}
                        onOpenDrawer={handleOpenDrawer}
                        onOpenNotices={() => {
                            openSubWindow(`#/notices/${roomId}`, `NoticeListWindow_${roomId}`);
                        }}
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
                        onToggleMemberPanel={handleToggleMemberPanel}
                        isMemberPanelOpen={isMemberPanelOpen}
                        isRoomNotificationEnabled={isRoomNotificationEnabled}
                        onToggleRoomNotification={handleToggleRoomNotification}
                    />
                    {/* 공지 바 */}
                    {isNoticeVisible && (
                        <NoticeBar
                            notice={roomNotice}
                            onClear={() => {
                                if (socket) {
                                    socket.emit('room:clear_notice', { roomId });
                                }
                            }}
                            onClose={() => setIsNoticeVisible(false)}
                            isOwner={true}
                        />
                    )}
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
                            onStartEdit={handleStartEdit}
                            scrollToMsgId={scrollToMsgId}
                            loadNewerMessages={loadNewerMessages}
                            hasFutureMessages={hasFutureMessages}
                            isLoadingNewer={isLoadingNewer}
                            firstUnreadMsgId={firstUnreadMsgId}
                            searchKeyword={searchKeyword}
                            onSetNotice={handleSetNotice}
                            hasNotice={!!roomNotice}
                            isNoticeVisible={isNoticeVisible}
                            onToggleNotice={() => setIsNoticeVisible(!isNoticeVisible)}
                        />
                    </div>
                    <MessageInput
                        onSend={(text) => sendMessage({ text })}
                        onSendFile={handleSendFile}
                        disabled={!connected}
                        editingMessage={editingMessage}
                        onCancelEdit={handleCancelEdit}
                        onSaveEdit={handleSaveEdit}
                    />
                    <InviteUserModal
                        isOpen={isInviteOpen}
                        onClose={() => setIsInviteOpen(false)}
                        currentRoomId={roomId}
                        userId={userId}
                        userNickname={userNickname}
                    />
                </div>
            </div>
        </div>
    );
}