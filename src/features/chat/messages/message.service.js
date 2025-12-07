import * as messageRepo from './message.repository.js';
import * as roomRepo from '../rooms/room.repository.js';

// 메시지 목록에 unreadCount를 붙여주는 공통 헬퍼 함수
async function attachUnreadCounts(roomId, messages) {
    if (!messages || messages.length === 0) return [];

    const count = await roomRepo.countRoomMembers(roomId);
    const membersInRoom = parseInt(count, 10);
    const readCountMap = await getReadCountsForMessages(roomId, messages);

    return await calculateUnreadCounts({
        messages,
        currentUserId: null,
        membersInRoom,
        readCountMap
    });
}

export async function getHistory({ roomId, limit, beforeMsgId }) {
    return await messageRepo.getHistory({ roomId, limit, beforeMsgId });
}

// 텍스트 메시지 저장
export async function saveMessage({ userId, ROOM_ID, CONTENT, activeUserIds = [] }) {
    const savedRow = await messageRepo.saveMessageTx({
        roomId: ROOM_ID,
        senderId: userId,
        content: CONTENT,
        messageType: 'TEXT',
        fileUrl: null,
        fileName: null,
    });

    if (savedRow.SENT_AT) {
        const timestamp = new Date(savedRow.SENT_AT).getTime();
        await messageRepo.upsertReadStatus(userId, ROOM_ID, timestamp);
    }
    return savedRow;
}

// 파일 메시지 저장
export async function saveFileMessage({ roomId, userId, fileName, fileURL, mimeType, activeUserIds = [] }) {
    console.log('message.service: Saving file message:', { roomId, userId, fileName, fileURL, mimeType });
    const savedRow = await messageRepo.saveMessageTx({
        roomId: roomId,
        senderId: userId,
        content: null,
        messageType: 'FILE',
        fileUrl: fileURL,
        fileName: fileName
    });

    if (savedRow.SENT_AT) {
        const timestamp = new Date(savedRow.SENT_AT).getTime();
        await messageRepo.upsertReadStatus(userId, roomId, timestamp);
    }

    return savedRow;
}

// 읽음 수 확인
export async function getReadCountsForMessages(roomId, messages) {
    if (!messages || messages.length === 0) return {};

    const msgIds = messages.map(m => m.MSG_ID || m.TEMP_ID);
    const rows = await messageRepo.countReadStatusByMessageIds(roomId, msgIds);

    const readCountMap = {};
    rows.forEach(row => {
        const id = row.MSG_ID || row.msg_id;
        const count = row.readCount || row.READCOUNT || row["readCount"] || 0;
        if (id) {
            readCountMap[id] = count;
        }
    });

    return readCountMap;
}

// 읽음 상태 업데이트 (항상 브로드캐스트)
export async function updateLastReadTimestamp(userId, roomId, lastReadTimestamp) {
    if (!userId || !roomId || !lastReadTimestamp) return false;

    let timestampNumber;

    if (typeof lastReadTimestamp === 'number') {
        timestampNumber = lastReadTimestamp;
    } else if (typeof lastReadTimestamp === 'string') {
        timestampNumber = new Date(lastReadTimestamp).getTime();
    } else {
        console.error("Invalid timestamp type received:", typeof lastReadTimestamp);
        return false;
    }

    if (isNaN(timestampNumber)) {
        console.error("Invalid timestamp received (NaN):", lastReadTimestamp);
        return false;
    }

    await messageRepo.upsertReadStatus(userId, roomId, timestampNumber);
    // 항상 true 반환하여 브로드캐스트 보장 (클라이언트에서 중복 방지 처리)
    return true;
}

// 메시지 객체 배열에 안 읽은 카운트(unreadCount)를 계산하여 추가
export async function calculateUnreadCounts({ messages, currentUserId, membersInRoom, readCountMap }) {
    if (!messages || messages.length === 0) return [];

    const messagesWithUnread = messages.map(msg => {
        const readCount = readCountMap[msg.MSG_ID] || 0;
        const unread = membersInRoom - readCount;
        const calculatedUnreadCount = Math.max(0, unread);

        return {
            ...msg,
            unreadCount: calculatedUnreadCount
        };
    });

    return messagesWithUnread;
}

// 새 메시지 전송 시 초기 안 읽음 카운트를 계산
export async function calculateInitialUnreadCount(roomId) {
    const count = await roomRepo.countRoomMembers(roomId);
    const membersInRoom = parseInt(count, 10);
    return Math.max(0, membersInRoom - 1);
}

// 방 멤버들의 읽음 상태를 Map 형태로 반환
export async function getMemberReadStatus(roomId) {
    const rows = await messageRepo.getRoomReadStatus(roomId);

    if (rows.length > 0) {
        console.log('[Service] First row raw data:', JSON.stringify(rows[0]));
    }

    const statusMap = {};
    rows.forEach(row => {
        const odaUserId = row.USER_ID || row.user_id || row.UserId;
        const ts = row.LASTREADTIMESTAMP || row.lastReadTimestamp || row.last_read_timestamp;

        console.log(`[Service] Row processing: userId=${odaUserId}, ts=${ts}`);

        if (odaUserId && ts) {
            statusMap[odaUserId] = Number(ts);
        }
    });

    console.log(`[Service] Loaded ReadMap for Room ${roomId}:`, Object.keys(statusMap).length, 'users');
    return statusMap;
}

// 메시지 수정 서비스
export async function modifyMessage({ msgId, userId, content }) {
    return await messageRepo.updateMessageTx({ msgId, senderId: userId, content });
}

// 메시지 삭제 서비스
export async function removeMessage({ msgId, userId }) {
    return await messageRepo.deleteMessageTx({ msgId, senderId: userId });
}

// 대화 내용 검색 서비스
export async function searchMessages({ roomId, keyword }) {
    return await messageRepo.searchMessages(roomId, keyword);
}

// 특정 메시지 기준 문맥 조회 서비스
export async function getMessagesContext({ roomId, msgId }) {
    const messages = await messageRepo.getMessagesAroundId(roomId, msgId);
    return await attachUnreadCounts(roomId, messages);
}

// 메시지 아래로 스크롤 시 조회
export async function getNewerMessages({ roomId, msgId }) {
    const messages = await messageRepo.getMessagesAfterId(roomId, msgId);
    return await attachUnreadCounts(roomId, messages);
}

// 채팅방 서랍(파일 목록) 조회 서비스
export async function getRoomFiles({ roomId }) {
    return await messageRepo.getRoomFiles(roomId);
}