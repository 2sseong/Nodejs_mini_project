import * as roomRepo from './room.repository.js';

export async function createRoom({ roomName, creatorId }) {
    return await roomRepo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await roomRepo.listRoomsByUser({ userId });
}

export async function inviteUserToRoom({ roomId, inviteeId }) {
    const exists = await roomRepo.ensureUserExists(inviteeId);
    if (!exists) throw { status: 404, message: '사용자를 찾을 수 없습니다.' };

    const joined = await roomRepo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: '이미 참여 중인 사용자입니다.' };

    await roomRepo.addMemberTx({ roomId, userId: inviteeId });
    return { roomId, inviteeId };
}

export async function leaveRoom({ roomId, userId }) {
    const rowsAffected = await roomRepo.deleteMember({ roomId, userId });
    if (rowsAffected === 0) {
        throw { status: 404, message: '방 또는 사용자를 찾을 수 없습니다.' };
    }
    return rowsAffected;
}

// 방인원 확인 (Message Service 등에서도 필요 시 사용)
export async function getRoomMemberCount(roomId) {
    const count = await roomRepo.countRoomMembers(roomId);
    return parseInt(count, 10);
}

/**
 * 방 읽음 처리
 * - 소켓에서 방 입장(join) 시 호출됨
 */
export async function markRoomAsRead({ roomId, userId }) {
    return await roomRepo.updateLastReadAt({ roomId, userId });
}

/**
 * 기존 1:1 채팅방 존재 여부 확인
 * @param {number} myUserId 현재 로그인 사용자 ID
 * @param {number} targetUserId 대상 사용자 ID
 * @returns {number | null} 존재하는 경우 roomId
 */
export async function checkExistingOneToOneChat(myUserId, targetUserId) {
    // roomRepo의 findOneToOneRoomId 함수를 호출하여 ID를 조회합니다.
    const existingRoomId = await roomRepo.findOneToOneRoomId(myUserId, targetUserId);

    return existingRoomId;
}

/**
 * 새로운 1:1 채팅방 생성 및 정보 반환
 * @param {number} myUserId 
 * @param {number} targetUserId 
 * @param {string} roomName 클라이언트에서 설정한 이름
 * @returns {{roomId: number, roomName: string}}
 */
export async function createNewOneToOneChat(myUserId, targetUserId, roomName) {
    // 1. 대상 사용자 유효성 검사 (안전성 확보)
    const exists = await roomRepo.ensureUserExists(targetUserId);
    if (!exists) throw { status: 404, message: '대상 사용자를 찾을 수 없습니다.' };

    // 2. Repository를 호출하여 채팅방 생성 및 멤버 추가 트랜잭션 실행
    const newRoomInfo = await roomRepo.createNewOneToOneRoom(myUserId, targetUserId, roomName);
    return newRoomInfo;
}