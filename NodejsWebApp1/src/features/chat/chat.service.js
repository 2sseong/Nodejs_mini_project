import * as repo from './chat.repository.js';

export async function createRoom({ roomName, creatorId }) {
    // 트랜잭션: 방 생성 + 생성자 멤버 추가
    return await repo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await repo.listRoomsByUser({ userId });
}

export async function getHistory({ roomId }) {
    return await repo.getHistory({ roomId });
}

export async function saveMessage({ userId, ROOM_ID, CONTENT }) {
    const { msgId, sentAt } = await repo.saveMessageTx({
        roomId: ROOM_ID, senderId: userId, content: CONTENT,
    });
    return {
        MSG_ID: msgId,
        ROOM_ID: Number(ROOM_ID),
        SENDER_ID: userId,
        CONTENT,
        SENT_AT: sentAt,
    };
}

export async function inviteUserToRoom({ roomId, inviterId, inviteeId }) {
    const exists = await repo.ensureUserExists(inviteeId);
    if (!exists) throw { status: 404, message: '초대할 사용자의 ID가 유효하지 않습니다.' };

    const joined = await repo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: '이미 채팅방에 참여 중인 사용자입니다.' };

    await repo.addMemberTx({ roomId, userId: inviteeId });
    return { roomId, inviteeId };
}

export default {
    createRoom,
    listRoomsForUser,
    getHistory,
    saveMessage,
    inviteUserToRoom,
};