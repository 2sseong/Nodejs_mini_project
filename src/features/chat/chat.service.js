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

// ---  방 나가기 함수 추가 ---

export async function leaveRoom({ roomId, userId }) {
    // Repository 레이어의 멤버 삭제 함수를 호출
    const rowsAffected = await repo.deleteMember({ roomId, userId });

    if (rowsAffected === 0) {
        throw { status: 404, message: '채팅방 멤버로 등록되어 있지 않습니다.' };
    }

    return rowsAffected;
}

// [추가] 파일 메시지 저장
async function saveFileMessage({ roomId, userId, userNickname, fileName, fileURL, mimeType }) {
    // 파일 메시지에 필요한 데이터 구조
    const messageData = {
        ROOM_ID: roomId,
        USER_ID: userId,
        NICKNAME: userNickname,
        TEXT: fileName, // 파일 메시지에서는 TEXT 필드에 파일 이름을 저장
        MESSAGE_TYPE: 'FILE', // 새로운 타입 추가
        FILE_URL: fileURL,
        MIME_TYPE: mimeType,
        // ... 필요한 다른 필드
    };

    // Chat Repository를 호출하여 Oracle에 저장
    const savedMsg = await chatRepository.insertMessage(messageData);

    return savedMsg; // 저장된 메시지 객체 반환
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