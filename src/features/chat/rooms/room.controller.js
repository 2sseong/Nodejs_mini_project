// src/features/chat/rooms/room.controller.js
import * as roomService from './room.service.js';
import * as noticeService from '../notices/notice.service.js';
import socketGateway from '../../../sockets/socket.gateway.js';
import { getIoInstance } from '../../../sockets/socketStore.js';

export async function createRoom(req, res, next) {
    try {
        const { roomName, creatorId } = req.body;
        // chatService -> roomService로 변경
        const result = await roomService.createRoom({ roomName, creatorId });

        socketGateway.notifyRoomCreatedToUser(result.creatorId, {
            roomId: result.roomId, roomName: result.roomName, roomType: result.roomType,
        });

        res.status(201).json({ success: true, roomId: result.roomId, roomName: result.roomName });
    } catch (e) { next(e); }
}

/**
 * [DELETE] 방 나가기 함수 (leaveRoom)
 */
export async function leaveRoom(req, res, next) {
    const { roomId, userId } = req.params;
    const encodedNickname = req.query.userNickname || req.headers['x-user-nickname'];
    const userNickname = encodedNickname ? decodeURIComponent(encodedNickname) : null;

    if (!roomId || !userId) {
        return res.status(400).json({
            success: false,
            message: `채팅방 ID와 사용자 ID는 필수입니다.`
        });
    }

    try {
        const result = await roomService.leaveRoom({ roomId, userId, userNickname });

        // 나간 본인에게 목록 갱신 요청
        socketGateway.requestRoomsRefresh(userId);

        // [추가] 남은 멤버들에게도 방 목록 갱신 요청 (아바타 업데이트를 위해)
        const remainingMembers = await roomService.getRoomMembers(roomId);
        for (const member of remainingMembers) {
            socketGateway.requestRoomsRefresh(member.USER_ID);
        }

        // 남은 사람들에게 인원수 업데이트 알림 (Gateway 사용)
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        // [추가] 공지 상태 브로드캐스트 (공지 생성자가 나가면 공지가 삭제됨)
        if (!result.roomDeleted) {
            const io = getIoInstance();
            const currentNotice = await noticeService.getNotice({ roomId });
            io.to(String(roomId)).emit('room:notice_updated', { roomId, notice: currentNotice });
        }

        // 시스템 메시지 브로드캐스트
        if (result.systemMessage) {
            const io = getIoInstance();
            io.to(String(roomId)).emit('chat:message', result.systemMessage);
        }

        return res.status(200).json({
            success: true,
            message: "성공적으로 방을 나갔습니다.",
            rowsAffected: result.rowsAffected
        });

    } catch (error) {
        console.error("Error in leaveRoom controller:", error);
        next(error);
    }
}

/**
 * GET /checkOneToOne : 1:1 채팅방 존재 여부 확인
 */
export async function checkChat(req, res, next) {
    try {
        const myUserId = req.user.userId; // 로그인 사용자 ID
        const targetId = req.query.targetId;

        if (!targetId) {
            return res.status(400).json({ message: "대상 사용자 ID(targetId)가 필요합니다." });
        }

        // Service 호출: 기존 방 ID 조회
        const roomId = await roomService.checkExistingOneToOneChat(myUserId, targetId);

        if (roomId) {
            // (1) 존재함
            return res.status(200).json({ exists: true, roomId: roomId });
        } else {
            // (2) 존재하지 않음
            return res.status(200).json({ exists: false });
        }
    } catch (e) {
        next(e); // 에러 핸들링 미들웨어로 전달
    }
}


/**
 * POST /createOneToOne : 새로운 1:1 채팅방 생성
 */
export async function createChat(req, res, next) {
    try {
        const myUserId = req.user.userId; // 로그인 사용자 ID
        const { targetId, roomName } = req.body;

        if (!targetId || !roomName) {
            return res.status(400).json({ message: "필수 정보(targetId, roomName)가 누락되었습니다." });
        }

        // Service 호출: 새 1:1 채팅방 생성
        const newRoomInfo = await roomService.createNewOneToOneChat(myUserId, targetId, roomName);

        // 1. [소켓 알림] 새로 생성된 방 목록 갱신 요청 (나와 상대방 모두)
        // Note: 새로운 1:1 채팅이므로, 두 사용자 모두에게 방 목록 갱신을 요청합니다.
        socketGateway.requestRoomsRefresh(myUserId);
        socketGateway.requestRoomsRefresh(Number(targetId));

        // 새로 생성된 roomId 반환
        return res.status(201).json({
            success: true,
            roomId: newRoomInfo.roomId,
            roomName: newRoomInfo.roomName
        });

    } catch (e) {
        next(e); // 에러 핸들링 미들웨어로 전달
    }
}

/**
 * [POST] 여러 명 동시 초대
 */
export async function inviteUsers(req, res, next) {
    try {
        const { roomId, inviteeIds, inviterNickname } = req.body;

        if (!roomId || !Array.isArray(inviteeIds) || inviteeIds.length === 0) {
            return res.status(400).json({ success: false, message: '유효한 roomId와 inviteeIds 배열이 필요합니다.' });
        }

        // 초대 전에 기존 멤버 목록 조회
        const existingMembers = await roomService.getRoomMembers(roomId);

        const result = await roomService.inviteUsersToRoom({
            roomId,
            inviteeIds,
            inviterNickname
        });

        // 초대받은 사람들에게 방 목록 갱신 요청
        for (const inviteeId of result.successList) {
            socketGateway.requestRoomsRefresh(inviteeId);
        }

        // [추가] 기존 멤버들에게도 방 목록 갱신 요청 (아바타 업데이트를 위해)
        for (const member of existingMembers) {
            socketGateway.requestRoomsRefresh(member.USER_ID);
        }

        // 방에 있는 기존 멤버들에게 실시간 인원수 업데이트
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        // 시스템 메시지 브로드캐스트
        if (result.systemMessage) {
            const io = getIoInstance();
            io.to(String(roomId)).emit('chat:message', result.systemMessage);
        }

        res.status(200).json({
            success: true,
            message: `${result.successList.length}명 초대 완료`,
            successCount: result.successList.length,
            failCount: result.failList.length,
            failList: result.failList
        });
    } catch (e) {
        next(e);
    }
}

/**
 * [GET] 채팅방 멤버 목록 조회
 */
export async function getRoomMembers(req, res, next) {
    const { roomId } = req.params;

    if (!roomId) {
        return res.status(400).json({ success: false, message: '채팅방 ID는 필수입니다.' });
    }

    try {
        const members = await roomService.getRoomMembers(roomId);
        res.status(200).json({ success: true, members });
    } catch (error) {
        console.error('Error in getRoomMembers controller:', error);
        next(error);
    }
}

/**
 * [GET] 채팅방 알림 설정 조회
 */
export async function getNotificationSetting(req, res, next) {
    const { roomId } = req.params;
    const userId = req.user?.userId;

    if (!roomId || !userId) {
        return res.status(400).json({ success: false, message: '채팅방 ID와 사용자 정보가 필요합니다.' });
    }

    try {
        const enabled = await roomService.getNotificationEnabled({ roomId, userId });
        res.status(200).json({ success: true, enabled });
    } catch (error) {
        console.error('Error in getNotificationSetting controller:', error);
        next(error);
    }
}

/**
 * [PUT] 채팅방 알림 설정 변경
 */
export async function updateNotificationSetting(req, res, next) {
    const { roomId } = req.params;
    const userId = req.user?.userId;
    const { enabled } = req.body;

    if (!roomId || !userId) {
        return res.status(400).json({ success: false, message: '채팅방 ID와 사용자 정보가 필요합니다.' });
    }

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'enabled 값은 boolean이어야 합니다.' });
    }

    try {
        const result = await roomService.setNotificationEnabled({ roomId, userId, enabled });
        res.status(200).json({ success: true, updated: result, enabled });
    } catch (error) {
        console.error('Error in updateNotificationSetting controller:', error);
        next(error);
    }
}
