import * as roomRepo from './room.repository.js';
import * as messageRepo from '../messages/message.repository.js';

export async function createRoom({ roomName, creatorId }) {
    return await roomRepo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await roomRepo.listRoomsByUser({ userId });
}

export async function inviteUserToRoom({ roomId, inviteeId, inviterNickname }) {
    const exists = await roomRepo.ensureUserExists(inviteeId);
    if (!exists) throw { status: 404, message: '사용자를 찾을 수 없습니다.' };

    const joined = await roomRepo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: '이미 참여 중인 사용자입니다.' };

    await roomRepo.addMemberTx({ roomId, userId: inviteeId });

    // 초대된 사용자 닉네임 조회
    const inviteeNickname = await roomRepo.getUserNickname(inviteeId);

    // 시스템 메시지 저장
    const systemMsg = await messageRepo.saveSystemMessage({
        roomId,
        content: `${inviterNickname || '알 수 없음'}님이 ${inviteeNickname || '새 멤버'}님을 초대했습니다.`
    });

    return { roomId, inviteeId, systemMessage: systemMsg };
}

export async function leaveRoom({ roomId, userId, userNickname }) {
    const rowsAffected = await roomRepo.deleteMember({ roomId, userId });
    if (rowsAffected === 0) {
        throw { status: 404, message: '방 또는 사용자를 찾을 수 없습니다.' };
    }

    // 시스템 메시지 저장
    const systemMsg = await messageRepo.saveSystemMessage({
        roomId,
        content: `${userNickname || '알 수 없음'}님이 나갔습니다.`
    });

    return { rowsAffected, systemMessage: systemMsg };
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