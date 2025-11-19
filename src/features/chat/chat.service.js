import * as repo from './chat.repository.js'; // 'repo'로 이름 지정됨

export async function createRoom({ roomName, creatorId }) {
    return await repo.createRoomWithCreatorTx({ roomName, creatorId });
}

export async function listRoomsForUser({ userId }) {
    return await repo.listRoomsByUser({ userId });
}

export async function getHistory({ roomId, limit, beforeMsgId }) {
    return await repo.getHistory({ roomId, limit, beforeMsgId });
}

// 텍스트 메시지 저장
export async function saveMessage({ userId, ROOM_ID, CONTENT, activeUserIds = [] }) {
    const savedRow = await repo.saveMessageTx({
        roomId: ROOM_ID, 
        senderId: userId, 
        content: CONTENT,
        messageType: 'TEXT',
        fileUrl: null,
        fileName: null,
    });

    // 보고 있는 사람들(activeUserIds) 모두 읽음 처리
    if (savedRow.SENT_AT) {
        const timestamp = new Date(savedRow.SENT_AT).getTime();
        
        // activeUserIds가 비어있으면(기존 코드 호환) 보낸 사람(userId)만이라도 넣음
        const usersToUpdate = activeUserIds.length > 0 ? activeUserIds : [userId];

        // Promise.all로 병렬 처리 (성능 최적화) -> DB에 '이 사람들 다 읽었음' 기록
        await Promise.all(usersToUpdate.map(async (uid) => {
            await repo.upsertReadStatus(uid, ROOM_ID, timestamp);
        }));
    }
    return savedRow;
}

// 파일 메시지 저장
export async function saveFileMessage({ roomId, userId, fileName, fileURL, mimeType, activeUserIds = [] }) {
    console.log('chat.service: Saving file message:', { roomId, userId, fileName, fileURL, mimeType });
    const savedRow = await repo.saveMessageTx({
        roomId: roomId,
        senderId: userId,
        content: null, 
        messageType: 'FILE', 
        fileUrl: fileURL,
        fileName: fileName
    });
    // 메시지를 보낸 사람(나)은 무조건 이 시점까지 읽은 것으로 DB 업데이트
    if (savedRow.SENT_AT) {
        const timestamp = new Date(savedRow.SENT_AT).getTime();
        const usersToUpdate = activeUserIds.length > 0 ? activeUserIds : [userId];

        await Promise.all(usersToUpdate.map(async (uid) => {
            await repo.upsertReadStatus(uid, roomId, timestamp);
        }));
    }

    return savedRow;
}

export async function inviteUserToRoom({ roomId, inviteeId }) {
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

// 방인원 확인
export async function getRoomMemberCount(roomId) {
    // chatRepository -> repo 로 변경
    const count = await repo.countRoomMembers(roomId);
    return parseInt(count, 10);
}

// 읽음 수 확인
export async function getReadCountsForMessages(roomId, messages) {
    if (!messages || messages.length === 0) return {};

    const msgIds = messages.map(m => m.MSG_ID || m.TEMP_ID);
    
    const rows = await repo.countReadStatusByMessageIds(roomId, msgIds);

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

    // [!!!] 수정된 타입 변환 로직 [!!!]
    if (typeof lastReadTimestamp === 'number') {
        // 이미 숫자 형태일 경우 (client의 Date.now() 등)
        timestampNumber = lastReadTimestamp;
    } else if (typeof lastReadTimestamp === 'string') {
        // DB에서 올라온 ISO 문자열일 경우, new Date()를 통해 숫자로 변환
        timestampNumber = new Date(lastReadTimestamp).getTime();
    } else {
        // 유효하지 않은 타입일 경우 처리 중단
        console.error("Invalid timestamp type received:", typeof lastReadTimestamp);
        return;
    }

    if (isNaN(timestampNumber)) {
        // 변환 후에도 유효한 숫자가 아닐 경우 (new Date('bad string').getTime() 결과)
        console.error("Invalid timestamp received (NaN):", lastReadTimestamp);
        return; 
    }

    const rowsAffected = await repo.upsertReadStatus(userId, roomId, timestampNumber);
    
    // 0보다 크면 진짜 업데이트가 일어난 것
    return rowsAffected > 0;
}

/**
 * 메시지 객체 배열에 안 읽은 카운트(unreadCount)를 계산하여 추가합니다.
 * chat:get_history 용으로 사용됩니다.
 */
export async function calculateUnreadCounts({ messages, currentUserId, membersInRoom, readCountMap }) {
    if (!messages || messages.length === 0) return [];
    
    // messagesWithUnread 배열 생성 (새로운 함수로 분리)
    const messagesWithUnread = messages.map(msg => {
        const readCount = readCountMap[msg.MSG_ID] || 0;
        let calculatedUnreadCount = 0;


        const unread = membersInRoom - readCount;
        calculatedUnreadCount = Math.max(0, unread); 
        

        return {
            ...msg,
            unreadCount: calculatedUnreadCount 
        };
    });

    return messagesWithUnread;
}

/**
 * 새 메시지 전송 시 초기 안 읽음 카운트를 계산합니다.
 * chat:message 용으로 사용됩니다.
 */
export async function calculateInitialUnreadCount(roomId) {
    // 1. 멤버 수 조회 (Repository 호출)
    const membersInRoom = await getRoomMemberCount(roomId); 
    
    // 2. 초기 안 읽음 수 계산 (총 인원 - 1명)
    return Math.max(0, membersInRoom - 1);
}

// [추가] 방 멤버들의 읽음 상태를 Map 형태로 반환
export async function getMemberReadStatus(roomId) {
    const rows = await repo.getRoomReadStatus(roomId);
    
    const statusMap = {};
    rows.forEach(row => {
        // 1. User ID 찾기 (대소문자 방어)
        const userId = row.USER_ID || row.user_id || row.UserId;
        
        // 2. Timestamp 찾기 (가능한 모든 컬럼명 시도)
        // 오라클은 보통 대문자이나, 생성 방식에 따라 다를 수 있음
        const ts = row.lastReadTimestamp || 
                   row.LASTREADTIMESTAMP || 
                   row.LAST_READ_TIMESTAMP || 
                   row.last_read_timestamp;
                   
        if (userId && ts) {
            statusMap[userId] = Number(ts);
        }
    });
    
    // 디버깅용 로그 (서버 콘솔 확인용)
    console.log(`[Service] Loaded ReadMap for Room ${roomId}:`, Object.keys(statusMap).length, 'users');
    
    return statusMap;
}

export default {
    createRoom,
    listRoomsForUser,
    getHistory,
    saveMessage,
    saveFileMessage,
    inviteUserToRoom,
    leaveRoom,
    getRoomMemberCount,
    getReadCountsForMessages,
    updateLastReadTimestamp,
    calculateUnreadCounts,
    calculateInitialUnreadCount,
    getMemberReadStatus
};