// src/features/chat/rooms/room.controller.js
import * as roomService from './room.service.js';
import socketGateway from '../../../sockets/socket.gateway.js';

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

export async function inviteUser(req, res, next) {
    try {
        // req.body에서 필요한 정보 추출
        // (프론트에서 inviterId를 안 보내면 req.user.userId 사용)
        const { roomId, inviteeId, inviterId } = req.body;
        const requesterId = inviterId || req.user?.userId;

        await roomService.inviteUserToRoom({
            roomId,
            inviteeId,
            requesterId
        });

        // 1. 초대받은 사람에게 방 목록 갱신 요청
        socketGateway.requestRoomsRefresh(inviteeId);

        // 2. [수정됨] 방에 있는 기존 멤버들에게 실시간 인원수 업데이트 (Gateway 사용)
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        res.status(200).json({ success: true, message: '사용자를 성공적으로 초대했습니다.' });
    } catch (e) {
        next(e);
    }
}

/**
 * [DELETE] 방 나가기 함수 (leaveRoom)
 * @param {any} req
 * @param {any} res
 * @param {function} next - 다음 미들웨어로 에러를 전달하기 위함
 */
export async function leaveRoom(req, res, next) {
    const { roomId, userId } = req.params;

    if (!roomId || !userId) {
        return res.status(400).json({
            success: false,
            message: `채팅방 ID와 사용자 ID는 필수입니다.`
        });
    }

    try {
        const rowsAffected = await roomService.leaveRoom({ roomId, userId });

        // 나간 본인에게 목록 갱신 요청
        socketGateway.requestRoomsRefresh(userId);

        // [추가됨] 남은 사람들에게 인원수 업데이트 알림 (Gateway 사용)
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        return res.status(200).json({
            success: true,
            message: "성공적으로 방을 나갔습니다.",
            rowsAffected
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
