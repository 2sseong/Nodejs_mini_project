import * as repo from './chat.repository.js';

export async function createRoom({ roomName, creatorId }) {
    // Ʈ�����: �� ���� + ������ ��� �߰�
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
    if (!exists) throw { status: 404, message: '�ʴ��� ������� ID�� ��ȿ���� �ʽ��ϴ�.' };

    const joined = await repo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: '�̹� ä�ù濡 ���� ���� ������Դϴ�.' };

    await repo.addMemberTx({ roomId, userId: inviteeId });
    return { roomId, inviteeId };
}

// ---  �� ������ �Լ� �߰� ---

export async function leaveRoom({ roomId, userId }) {
    // Repository ���̾��� ��� ���� �Լ��� ȣ��
    const rowsAffected = await repo.deleteMember({ roomId, userId });

    if (rowsAffected === 0) {
        throw { status: 404, message: 'ä�ù� ����� ��ϵǾ� ���� �ʽ��ϴ�.' };
    }

    return rowsAffected;
}

async function saveFileMessage({ roomId, userId, fileName, fileURL }) {
        // DB 스키마에 따라 T_MESSAGE에 INSERT
        // (MESSAGE_TYPE='FILE', FILE_URL, FILE_NAME)
        const savedRow = await chatRepository.createFileMessage({
            roomId,
            senderId: userId,
            messageType: 'FILE',
            fileUrl: fileURL,
            fileName: fileName
        });
        return savedRow;
    }
// ------------------------------
export default {
    createRoom,
    listRoomsForUser,
    getHistory,
    saveMessage,
    inviteUserToRoom,
    leaveRoom,
    saveFileMessage,
};