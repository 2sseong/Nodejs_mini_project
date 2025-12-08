import { api } from '../lib/api.js';

// --- 방 생성 (CreateRoomModal 로직 분리) ---
/**
 * [POST] 새 채팅방을 생성하고 생성자를 멤버로 추가합니다.
 * @param {string} roomName 
 * @param {string|number} creatorId 
 * @returns {Promise}
 */
export const apiCreateRoom = (roomName, creatorId) => {
    // 기존 InviteUserModal에서 사용된 '/chats/create' 엔드포인트 사용
    return api.post('/chats/create', { roomName, creatorId });
};

// --- 사용자 초대 (InviteUserModal 로직 분리) ---
/**
 * [GET] 사용자 검색 (초대를 위한)
 * 시간 복잡도: O(1) (네트워크) / 백엔드 O(log N) (인덱스 검색)
 * @param {string} query 
 * @param {AbortSignal} signal - 요청 취소를 위한 AbortSignal
 * @returns {Promise}
 */
export const apiSearchUsers = (query, signal) => {
    return api.get('/users/search', {
        params: { query },
        signal
    });
};

/**
 * [POST] 채팅방에 사용자를 초대합니다.
 * @param {string|number} roomId 
 * @param {string|number} inviterId 
 * @param {string|number} inviteeId 
 * @param {string} inviterNickname - 초대한 사람 닉네임 (시스템 메시지용)
 * @returns {Promise}
 */
export const apiInviteUser = (roomId, inviterId, inviteeId, inviterNickname) => {
    // 기존 InviteUserModal에서 사용된 '/chats/invite' 엔드포인트 사용
    return api.post('/chats/invite', {
        roomId,
        inviterId,
        inviteeId,
        inviterNickname,
    });
};

// --- 방 나가기 (ChatPage 로직 분리) ---
/**
 * [DELETE] T_ROOM_MEMBER에서 사용자를 삭제합니다. (방 나가기)
 * @param {string|number} roomId 
 * @param {string|number} userId 
 * @param {string} userNickname - 나가는 사람 닉네임 (시스템 메시지용)
 * @returns {Promise}
 */
export const apiLeaveRoom = (roomId, userId, userNickname) => {
    return api.delete(`/chats/exit/${roomId}/${userId}`, {
        headers: { 'x-user-nickname': encodeURIComponent(userNickname || '') }
    });
};