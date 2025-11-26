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