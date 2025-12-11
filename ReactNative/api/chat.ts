import api from './client';

export interface Message {
    MSG_ID: number;
    ROOM_ID: number;
    USER_ID: number;
    NICKNAME: string;
    PROFILE_IMG?: string;
    CONTENT: string;
    MSG_TYPE: string;
    FILE_URL?: string;
    FILE_NAME?: string;
    CREATED_AT: string;
    UNREAD_COUNT?: number;
}

export interface SearchResult {
    MSG_ID: number;
    ROOM_ID: number;
    USER_ID: number;
    NICKNAME: string;
    CONTENT: string;
    CREATED_AT: string;
}

export interface FileItem {
    FILE_ID: number;
    FILE_NAME: string;
    FILE_URL: string;
    FILE_SIZE: number;
    MSG_ID: number;
    CREATED_AT: string;
}

// ============ 메시지 조회 ============

// 메시지 목록 조회 (무한 스크롤용)
export const getMessages = async (roomId: number, lastMsgId?: number): Promise<Message[]> => {
    const params = lastMsgId ? { lastMsgId } : {};
    const response = await api.get(`/chats/rooms/${roomId}/messages`, { params });
    return response.data;
};

// 메시지 검색
export const searchMessages = async (roomId: number, keyword: string): Promise<Message[]> => {
    const response = await api.get(`/chats/rooms/${roomId}/messages/search`, {
        params: { keyword }
    });
    return response.data;
};

// 특정 메시지 문맥 조회 (Jump to Message)
export const getMessageContext = async (roomId: number, msgId: number): Promise<Message[]> => {
    const response = await api.get(`/chats/rooms/${roomId}/messages/${msgId}/context`);
    return response.data;
};

// 특정 메시지 이후 새 메시지 조회
export const getNewerMessages = async (roomId: number, msgId: number): Promise<Message[]> => {
    const response = await api.get(`/chats/rooms/${roomId}/messages/${msgId}/newer`);
    return response.data;
};

// ============ 메시지 전송 ============

// 텍스트 메시지 전송 (Socket.io 사용 권장, HTTP는 백업용)
export const sendMessage = async (roomId: number, content: string, msgType: string = 'TEXT'): Promise<any> => {
    const response = await api.post(`/chats/rooms/${roomId}/messages`, { content, msgType });
    return response.data;
};

// ============ 파일 ============

// 파일 업로드
export const uploadFile = async (formData: FormData): Promise<any> => {
    const roomId = formData.get('roomId');
    const response = await api.post(`/chats/rooms/${roomId}/files`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// 채팅방 파일 목록 조회
export const getRoomFiles = async (roomId: number): Promise<FileItem[]> => {
    const response = await api.get(`/chats/rooms/${roomId}/files`);
    return response.data;
};

// ============ 읽음 처리 ============

// 읽음 처리
export const markAsRead = async (roomId: number): Promise<any> => {
    const response = await api.post(`/chats/rooms/${roomId}/read`);
    return response.data;
};

// ============ 1:1 채팅 ============

// 1:1 채팅방 존재 여부 확인
export const checkOneToOneChat = async (targetUserId: number): Promise<{ exists: boolean; roomId?: number }> => {
    const response = await api.get('/chats/checkOneToOne', {
        params: { targetId: targetUserId }
    });
    return response.data;
};

// 새로운 1:1 채팅방 생성
export const createOneToOneChat = async (targetUserId: number, roomName: string): Promise<{ roomId: number; roomName: string }> => {
    const response = await api.post('/chats/createOneToOne', {
        targetId: targetUserId,
        roomName: roomName
    });
    return response.data;
};
