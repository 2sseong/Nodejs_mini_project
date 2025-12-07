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