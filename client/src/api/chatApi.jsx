import { api } from '../lib/api.js';

// --- 대화 내용 검색 ---

/**
 * [GET] 특정 방의 대화 내용을 검색합니다.
 * 키워드가 포함된 모든 메시지의 ID와 간략한 정보를 반환합니다.
 * * 엔드포인트: /chats/rooms/:roomId/messages/search?keyword=...
 * * @param {string|number} roomId - 검색할 방 ID
 * @param {string} keyword - 검색할 단어
 * @returns {Promise<Array>} 매칭된 메시지 리스트 (ID, 시간 등)
 */
export const searchMessagesApi = (roomId, keyword) => {
    return api.get(`/chats/rooms/${roomId}/messages/search`, {
        params: { keyword }
    });
};

// --- 문맥 조회 (Jump to Message) ---

/**
 * [GET] 특정 메시지 ID를 기준으로 앞뒤 문맥 데이터를 조회합니다.
 * (예: 해당 메시지 위로 25개, 아래로 25개 -> 총 50개 로드)
 * * 엔드포인트: /chats/rooms/:roomId/messages/:msgId/context
 * * @param {string|number} roomId - 방 ID
 * @param {string|number} msgId - 기준이 될 메시지 ID (이동할 타겟)
 * @returns {Promise<Array>} 해당 구간의 메시지 전체 데이터 리스트
 */
export const getMessagesContextApi = (roomId, msgId) => {
    return api.get(`/chats/rooms/${roomId}/messages/${msgId}/context`);
};

export const getNewerMessagesApi = (roomId, msgId) => {
    return api.get(`/chats/rooms/${roomId}/messages/${msgId}/newer`);
};

// 채팅방 파일 목록 조회
export const getRoomFilesApi = (roomId) => {
    return api.get(`/chats/rooms/${roomId}/files`);
};


/**
 * 1:1 채팅방 존재 여부 확인 및 ID 조회
 * GET /api/chat/rooms/checkOneToOne?targetId={targetId}
 * @param {string|number} targetUserId - 대상 사용자 ID
 * @returns {Promise<{exists: boolean, roomId?: number, message?: string}>}
 */
export async function checkOneToOneChat(targetUserId) {
    try {
        const response = await api.get(`chats/checkOneToOne`, {
            params: { targetId: targetUserId }
        });
        return response.data;
    } catch (error) {
        // 오류 응답 메시지를 던져 상위 컴포넌트에서 처리하도록 합니다.
        throw new Error(error.response?.data?.message || "채팅방 확인 중 알 수 없는 오류");
    }
}

/**
 * 새로운 1:1 채팅방 생성
 * POST /api/chat/rooms/createOneToOne
 * @param {string|number} targetUserId - 대상 사용자 ID
 * @param {string} roomName - 생성할 채팅방 이름
 * @returns {Promise<{roomId: number, roomName: string, message?: string}>}
 */
export async function createOneToOneChat(targetUserId, roomName) {
    try {
        const response = await api.post(`chats/createOneToOne`, {
            targetId: targetUserId,
            roomName: roomName
        });
        return response.data;
    } catch (error) {
        // 오류 응답 메시지를 던져 상위 컴포넌트에서 처리하도록 합니다.
        throw new Error(error.response?.data?.message || "채팅방 생성 중 알 수 없는 오류");
    }
}