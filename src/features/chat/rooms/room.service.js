import * as roomRepo from './room.repository.js';
import * as messageRepo from '../messages/message.repository.js';

export async function createRoom({ roomName, creatorId }) {
    return await roomRepo.createRoomWithCreatorTx({ roomName, creatorId });
}

// 1:1 채팅방 이름을 위해 로직 수정(기본패턴일 때 상대방 이름 가져오기)
// export async function listRoomsForUser({ userId }) {
//     return await roomRepo.listRoomsByUser({ userId });
// }

export async function listRoomsForUser({ userId }) {
    // 1. Repository에서 기본 방 목록을 가져옴 (기존 기능 그대로 호출)
    const rooms = await roomRepo.listRoomsByUser({ userId });

    // 2. 1:1 채팅방 이름 동적 결정 로직 삽입
    for (const room of rooms) {
        // 1:1 채팅방이고, 방 이름이 설정되지 않았거나 기본 패턴일 때만 대체
        if (room.ROOM_TYPE === '1_TO_1') {

            const storedName = room.ROOM_NAME;
            // 프론트엔드 로직에서 요구하는 이름 대체 조건
            const isDefaultPattern = storedName === null || storedName?.match(/^(.+)님과의 대화$/);

            if (isDefaultPattern) {

                // 새로 만든 안전한 함수로 상대방 닉네임 조회
                const otherNickname = await roomRepo.getOtherUserNickname({
                    roomId: room.ROOM_ID,
                    currentUserId: userId
                });

                if (otherNickname) {
                    // ROOM_NAME 필드를 상대방 닉네임으로 덮어씀
                    room.ROOM_NAME = `${otherNickname}님과의 대화`;
                }
            }
        }
    }
    // 3. 보강된 데이터 반환
    return rooms;
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

/**
 * 기존 1:1 채팅방 존재 여부 확인
 * @param {number} myUserId 현재 로그인 사용자 ID
 * @param {number} targetUserId 대상 사용자 ID
 * @returns {number | null} 존재하는 경우 roomId
 */
export async function checkExistingOneToOneChat(myUserId, targetUserId) {
    // roomRepo의 findOneToOneRoomId 함수를 호출하여 ID를 조회합니다.
    const existingRoomId = await roomRepo.findOneToOneRoomId(myUserId, targetUserId);

    return existingRoomId;
}

/**
 * 새로운 1:1 채팅방 생성 및 정보 반환
 * @param {number} myUserId 
 * @param {number} targetUserId 
 * @param {string} roomName 클라이언트에서 설정한 이름
 * @returns {{roomId: number, roomName: string}}
 */
export async function createNewOneToOneChat(myUserId, targetUserId, roomName) {
    // 1. 대상 사용자 유효성 검사 (안전성 확보)
    const exists = await roomRepo.ensureUserExists(targetUserId);
    if (!exists) throw { status: 404, message: '대상 사용자를 찾을 수 없습니다.' };

    // 2. Repository를 호출하여 채팅방 생성 및 멤버 추가 트랜잭션 실행
    // roomName이 null이면 DB에 null이 저장되어 프론트에서 동적으로 이름을 표시하는 기반
    const newRoomInfo = await roomRepo.createNewOneToOneRoom(myUserId, targetUserId, roomName);
    return newRoomInfo;
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