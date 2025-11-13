import * as repo from './chat.repository.js';

export async function createRoom({ roomName, creatorId }) {
    // íŠ¸ëœì­ì…˜: ë°© ìƒì„± + ìƒì„±ì ë©¤ë²„ ì¶”ê°€
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
    if (!exists) throw { status: 404, message: 'ì´ˆëŒ€í•  ì‚¬ìš©ìì˜ IDê°€ ìœ íš¨í•˜ì§€ ì•ŠìŠµë‹ˆë‹¤.' };

    const joined = await repo.isMember({ roomId, userId: inviteeId });
    if (joined) throw { status: 400, message: 'ì´ë¯¸ ì±„íŒ…ë°©ì— ì°¸ì—¬ ì¤‘ì¸ ì‚¬ìš©ìì…ë‹ˆë‹¤.' };

    await repo.addMemberTx({ roomId, userId: inviteeId });
    return { roomId, inviteeId };
}

// ---  ë°© ë‚˜ê°€ê¸° í•¨ìˆ˜ ì¶”ê°€ ---

export async function leaveRoom({ roomId, userId }) {
    // Repository ë ˆì´ì–´ì˜ ë©¤ë²„ ì‚­ì œ í•¨ìˆ˜ë¥¼ í˜¸ì¶œ
    const rowsAffected = await repo.deleteMember({ roomId, userId });

    if (rowsAffected === 0) {
        throw { status: 404, message: 'ì±„íŒ…ë°© ë©¤ë²„ë¡œ ë“±ë¡ë˜ì–´ ìˆì§€ ì•ŠìŠµë‹ˆë‹¤.' };
    }

    return rowsAffected;
}

// [Ãß°¡] ÆÄÀÏ ¸Ş½ÃÁö ÀúÀå
async function saveFileMessage({ roomId, userId, userNickname, fileName, fileURL, mimeType }) {
    // ÆÄÀÏ ¸Ş½ÃÁö¿¡ ÇÊ¿äÇÑ µ¥ÀÌÅÍ ±¸Á¶
    const messageData = {
        ROOM_ID: roomId,
        USER_ID: userId,
        NICKNAME: userNickname,
        TEXT: fileName, // ÆÄÀÏ ¸Ş½ÃÁö¿¡¼­´Â TEXT ÇÊµå¿¡ ÆÄÀÏ ÀÌ¸§À» ÀúÀå
        MESSAGE_TYPE: 'FILE', // »õ·Î¿î Å¸ÀÔ Ãß°¡
        FILE_URL: fileURL,
        MIME_TYPE: mimeType,
        // ... ÇÊ¿äÇÑ ´Ù¸¥ ÇÊµå
    };

    // Chat Repository¸¦ È£ÃâÇÏ¿© Oracle¿¡ ÀúÀå
    const savedMsg = await chatRepository.insertMessage(messageData);

    return savedMsg; // ÀúÀåµÈ ¸Ş½ÃÁö °´Ã¼ ¹İÈ¯
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