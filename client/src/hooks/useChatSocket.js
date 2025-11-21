// client/src/hooks/useChatSocket.js
import { useSocketConnection } from './chat/useSocketConnection';
import { useChatRooms } from './chat/useChatRooms';
import { useChatMessages } from './chat/useChatMessages';

// [수정] 함수 인자에 roomId 추가 (기본값 null)
export function useChatSocket({ userId, userNickname, roomId: initialRoomId = null }) {
    
    // 1. 소켓 연결 관리
    const { socket, connected, onlineUsers } = useSocketConnection(userId);

    // 2. 방 관리
    const { 
        rooms, 
        currentRoomId: stateCurrentRoomId, // 이름 변경 (충돌 방지)
        selectRoom, 
        refreshRooms, 
    } = useChatRooms(socket, userId, connected);

    // [핵심] URL로 받은 roomId가 있으면 그걸 쓰고, 아니면 내부 상태(stateCurrentRoomId)를 씀
    // 팝업창은 initialRoomId가 항상 존재하므로, 절대 null이 되지 않음!
    const activeRoomId = initialRoomId || stateCurrentRoomId;

    // 3. 메시지 관리 (activeRoomId 전달)
    const {
        messages,
        isLoadingMore,
        hasMoreMessages,
        isInitialLoad,
        isReadStatusLoaded,
        sendMessage,
        loadMoreMessages, // 이제 여기서 activeRoomId를 쓰게 됨
        markAsRead,
        editMessage,
        deleteMessage,
        clearMessages
    } = useChatMessages(socket, userId, userNickname, activeRoomId);

    return {
        socket,
        connected,
        onlineUsers,
        rooms,
        currentRoomId: activeRoomId, // 반환값도 activeRoomId로 통일
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