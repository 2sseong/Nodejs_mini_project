import * as repo from './chat.repository.js'; // [중요] 'repo'로 import

export async function createRoom({ roomName, creatorId }) {
    // (한글 깨짐 원본 유지)
    return await repo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await repo.listRoomsByUser({ userId });
}

export async function getHistory({ roomId }) {
    return await repo.getHistory({ roomId });
}

// [수정] 텍스트 메시지 저장
export async function saveMessage({ userId, ROOM_ID, CONTENT }) {
    // repo.saveMessageTx를 호출하며 'TEXT' 타입을 명시
    const savedRow = await repo.saveMessageTx({
        roomId: ROOM_ID, 
        senderId: userId, 
        content: CONTENT,
        messageType: 'TEXT', // 텍스트임을 명시
        fileUrl: null,
        fileName: null,
    });

    // repo.saveMessageTx가 반환하는 객체를 그대로 반환
    return savedRow;
}

// [핵심 수정] 파일 메시지 저장 함수
export async function saveFileMessage({ roomId, userId, fileName, fileURL, mimeType }) {
    console.log('chat.service: Saving file message:', { roomId, userId, fileName, fileURL, mimeType });

    const savedRow = await repo.saveMessageTx({
        roomId: roomId,
        senderId: userId,
        content: null, // 파일 메시지는 CONTENT가 NULL
        messageType: 'FILE', // [중요]
        fileUrl: fileURL,
        fileName: fileName
    });

    return savedRow;
}

export async function inviteUserToRoom({ roomId, inviterId, inviteeId }) {
    const exists = await repo.ensureUserExists(inviteeId);
    if (!exists) throw { status: 404, message: '404 error' };

    const joined = await repo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: '400 error' };

    await repo.addMemberTx({ roomId, userId: inviteeId });
    return { roomId, inviteeId };
}

export async function leaveRoom({ roomId, userId }) {
    const rowsAffected = await repo.deleteMember({ roomId, userId });
    if (rowsAffected === 0) {
        throw { status: 404, message: '404 error' };
    }
    return rowsAffected;
}

// ------------------------------
// chat.socket.js가 'chatService'로 임포트할 수 있도록 default export
export default {
    createRoom,
    listRoomsForUser,
    getHistory,
    saveMessage,
    saveFileMessage, // [수정] 수정된 함수 포함
    inviteUserToRoom,
    leaveRoom,
};