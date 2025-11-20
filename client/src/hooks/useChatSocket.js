// client/src/hooks/useChatSocket.js
import { useSocketConnection } from './chat/useSocketConnection';
import { useChatRooms } from './chat/useChatRooms';
import { useChatMessages } from './chat/useChatMessages';

export function useChatSocket({ userId, userNickname }) {
    // 1. 소켓 연결 관리
    const { socket, connected, onlineUsers } = useSocketConnection(userId);

    // 2. 방 관리 (소켓 인스턴스 주입)
    const { 
        rooms, 
        currentRoomId, 
        selectRoom, 
        refreshRooms, 
    } = useChatRooms(socket, userId, connected);

    // 3. 메시지 관리 (소켓 및 현재 방 정보 주입)
    const {
        messages,
        isLoadingMore,
        hasMoreMessages,
        isInitialLoad,
        isReadStatusLoaded,
        sendMessage,
        loadMoreMessages,
        markAsRead,
        editMessage,
        deleteMessage,
        clearMessages
    } = useChatMessages(socket, userId, userNickname, currentRoomId);

    return {
        socket,
        connected,
        onlineUsers,
        rooms,
        currentRoomId,
        messages,
        selectRoom,
        refreshRooms,
        sendMessage,
        loadMoreMessages,
        markAsRead,
        editMessage,
        deleteMessage,
        clearMessages,
        isLoadingMore,
        hasMoreMessages,
        isInitialLoad,
        isReadStatusLoaded
    };
}