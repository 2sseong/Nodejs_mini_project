import api from './client';

export interface Room {
    ROOM_ID: number;
    ROOM_NAME: string;
    ROOM_TYPE: string;
    LAST_MESSAGE?: string;
    LAST_MSG_DATE?: string;
    UNREAD_COUNT?: number;
    MEMBER_COUNT?: number;
}

export interface RoomMember {
    USER_ID: number;
    USER_NICKNAME: string;
    PROFILE_IMG?: string;
    DEPT_NAME?: string;
    POS_NAME?: string;
}

// ============ 채팅방 목록 ============

// 채팅방 목록 조회 (사용자가 속한 모든 채팅방)
export const getRooms = async (): Promise<Room[]> => {
    const response = await api.get('/chats/rooms');
    return response.data;
};

// 채팅방 상세 조회
export const getRoom = async (roomId: number): Promise<any> => {
    const response = await api.get(`/chats/rooms/${roomId}`);
    return response.data;
};

// ============ 채팅방 생성/관리 ============

// 채팅방 생성 (with 참여자)
export const createRoom = async (roomName: string, memberIds: string[]): Promise<any> => {
    const response = await api.post('/chats/create', { roomName, memberIds });
    return response.data;
};

// 채팅방에 사용자 초대
export const inviteToRoom = async (roomId: number, userIds: string[]): Promise<any> => {
    const response = await api.post('/chats/invite-multiple', {
        roomId,
        inviteeIds: userIds,
    });
    return response.data;
};

// 여러 명 동시 초대 (with 초대자 닉네임)
export const inviteUsers = async (roomId: number, inviteeIds: string[], inviterNickname: string): Promise<any> => {
    const response = await api.post('/chats/invite-multiple', {
        roomId,
        inviteeIds,
        inviterNickname,
    });
    return response.data;
};

// 채팅방 나가기
export const leaveRoom = async (roomId: number, userId: number, userNickname: string = ''): Promise<any> => {
    const response = await api.delete(`/chats/exit/${roomId}/${userId}`, {
        headers: { 'x-user-nickname': encodeURIComponent(userNickname) }
    });
    return response.data;
};

// ============ 멤버 관리 ============

// 채팅방 멤버 목록
export const getRoomMembers = async (roomId: number): Promise<RoomMember[]> => {
    const response = await api.get(`/chats/${roomId}/members`);
    return response.data;
};

// ============ 알림 설정 ============

// 알림 설정 조회
export const getNotificationSetting = async (roomId: number): Promise<boolean> => {
    const response = await api.get(`/chats/${roomId}/notification`);
    return response.data.enabled;
};

// 알림 설정 변경
export const setNotificationSetting = async (roomId: number, enabled: boolean): Promise<any> => {
    const response = await api.put(`/chats/${roomId}/notification`, { enabled });
    return response.data;
};
