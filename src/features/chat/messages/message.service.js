import * as messageRepo from './message.repository.js';
import * as roomRepo from '../rooms/room.repository.js'; // 방 인원수 조회를 위해 필요

// 메시지 목록에 unreadCount를 붙여주는 공통 헬퍼 함수
async function attachUnreadCounts(roomId, messages) {
    if (!messages || messages.length === 0) return [];

    // 1. 방 전체 멤버 수 조회
    const count = await roomRepo.countRoomMembers(roomId);
    const membersInRoom = parseInt(count, 10);

    // 2. 메시지별 읽은 사람 수 조회
    const readCountMap = await getReadCountsForMessages(roomId, messages);

    // 3. 계산 로직 적용 (기존 함수 재사용)
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

    // 변경: 상대방은 클라이언트에서 'focus' 시점에 명시적으로 요청하도록 변경함.
    if (savedRow.SENT_AT) {
        const timestamp = new Date(savedRow.SENT_AT).getTime();

        // activeUserIds 대신 [userId]만 처리
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

    // [변경] 보낸 사람(userId)만 읽음 처리
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

// 읽음 상태 업데이트
export async function updateLastReadTimestamp(userId, roomId, lastReadTimestamp) {
    if (!userId || !roomId || !lastReadTimestamp) return;

    let timestampNumber;

    if (typeof lastReadTimestamp === 'number') {
        timestampNumber = lastReadTimestamp;
    } else if (typeof lastReadTimestamp === 'string') {
        timestampNumber = new Date(lastReadTimestamp).getTime();
    } else {
        console.error("Invalid timestamp type received:", typeof lastReadTimestamp);
        return;
    }

    if (isNaN(timestampNumber)) {
        console.error("Invalid timestamp received (NaN):", lastReadTimestamp);
        return;
    }

    // DB에 읽음 상태 저장
    const rowsAffected = await messageRepo.upsertReadStatus(userId, roomId, timestampNumber);

    // DB에서 실제로 행이 업데이트된 경우(rowsAffected > 0)에만 true를 반환하여 소켓 전파.
    // (이미 최신 상태라면 rowsAffected는 0이 나옴 -> 소켓 전송 안 함 -> 트래픽 절약)
    return true;
}

/**
 * 메시지 객체 배열에 안 읽은 카운트(unreadCount)를 계산하여 추가
 */
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

/**
 * 새 메시지 전송 시 초기 안 읽음 카운트를 계산
 * (Room Repository 의존)
 */
export async function calculateInitialUnreadCount(roomId) {
    // 1. 멤버 수 조회 (Room Repo 호출)
    const count = await roomRepo.countRoomMembers(roomId);
    const membersInRoom = parseInt(count, 10);

    // 2. 초기 안 읽음 수 계산 (총 인원 - 1명)
    return Math.max(0, membersInRoom - 1);
}

// 방 멤버들의 읽음 상태를 Map 형태로 반환
export async function getMemberReadStatus(roomId) {
    const rows = await messageRepo.getRoomReadStatus(roomId);

    const statusMap = {};
    rows.forEach(row => {
        const userId = row.USER_ID || row.user_id || row.UserId;
        const ts = row.lastReadTimestamp ||
            row.LASTREADTIMESTAMP ||
            row.LAST_READ_TIMESTAMP ||
            row.last_read_timestamp;

        if (userId && ts) {
            statusMap[userId] = Number(ts);
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
    // 필요한 경우 여기서 비즈니스 로직 처리 (예: 검색어 유효성 검사 등)
    return await messageRepo.searchMessages(roomId, keyword);
}

// 특정 메시지 기준 문맥 조회 서비스
export async function getMessagesContext({ roomId, msgId }) {
    const messages = await messageRepo.getMessagesAroundId(roomId, msgId);
    // 계산 후 반환
    return await attachUnreadCounts(roomId, messages);
}

// 메시지 아래로 스크롤 시 조회
export async function getNewerMessages({ roomId, msgId }) {
    const messages = await messageRepo.getMessagesAfterId(roomId, msgId);
    // 계산 후 반환
    return await attachUnreadCounts(roomId, messages);
}
// 채팅방 서랍(파일 목록) 조회 서비스
export async function getRoomFiles({ roomId }) {
    return await messageRepo.getRoomFiles(roomId);
}