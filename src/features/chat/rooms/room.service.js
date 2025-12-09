import * as roomRepo from './room.repository.js';
import * as messageRepo from '../messages/message.repository.js';

export async function createRoom({ roomName, creatorId }) {
    return await roomRepo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await roomRepo.listRoomsByUser({ userId });
}

export async function leaveRoom({ roomId, userId, userNickname }) {
    const result = await roomRepo.deleteMember({ roomId, userId });

    if (!result.success) {
        throw { status: 404, message: result.message || '방 또는 사용자를 찾을 수 없습니다.' };
    }

    // 방이 삭제된 경우 시스템 메시지 저장 안함 (FK 오류 방지)
    let systemMsg = null;
    if (!result.roomDeleted) {
        systemMsg = await messageRepo.saveSystemMessage({
            roomId,
            content: `${userNickname || '알 수 없음'}님이 나갔습니다.`
        });
    }

    return {
        rowsAffected: 1,
        systemMessage: systemMsg,
        roomDeleted: result.roomDeleted
    };
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

// 여러 명 동시 초대
export async function inviteUsersToRoom({ roomId, inviteeIds, inviterNickname }) {
    const successList = [];
    const failList = [];
    const nicknames = [];

    for (const inviteeId of inviteeIds) {
        try {
            const exists = await roomRepo.ensureUserExists(inviteeId);
            if (!exists) {
                failList.push({ inviteeId, reason: '사용자를 찾을 수 없습니다.' });
                continue;
            }

            const joined = await roomRepo.isMember({ roomId, userId: inviteeId });
            if (joined) {
                failList.push({ inviteeId, reason: '이미 참여 중인 사용자입니다.' });
                continue;
            }

            await roomRepo.addMemberTx({ roomId, userId: inviteeId });
            const inviteeNickname = await roomRepo.getUserNickname(inviteeId);
            nicknames.push(inviteeNickname || '새 멤버');
            successList.push(inviteeId);
        } catch (err) {
            failList.push({ inviteeId, reason: err.message || '알 수 없는 오류' });
        }
    }

    // 시스템 메시지 (성공한 사람이 있을 때만)
    let systemMsg = null;
    if (nicknames.length > 0) {
        const nicknameStr = nicknames.join(', ');
        systemMsg = await messageRepo.saveSystemMessage({
            roomId,
            content: `${inviterNickname || '알 수 없음'}님이 ${nicknameStr}님을 초대했습니다.`
        });
    }

    return { successList, failList, systemMessage: systemMsg };
}

// 채팅방 멤버 목록 조회
export async function getRoomMembers(roomId) {
    return await roomRepo.getRoomMembers(roomId);
}