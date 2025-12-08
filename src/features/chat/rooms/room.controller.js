// src/features/chat/rooms/room.controller.js
import * as roomService from './room.service.js';
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

export async function inviteUser(req, res, next) {
    try {
        const { roomId, inviteeId, inviterId, inviterNickname } = req.body;
        const requesterId = inviterId || req.user?.userId;

        const result = await roomService.inviteUserToRoom({
            roomId,
            inviteeId,
            inviterNickname
        });

        // 1. 초대받은 사람에게 방 목록 갱신 요청
        socketGateway.requestRoomsRefresh(inviteeId);

        // 2. 방에 있는 기존 멤버들에게 실시간 인원수 업데이트 (Gateway 사용)
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        // 3. [추가] 시스템 메시지 브로드캐스트
        if (result.systemMessage) {
            const io = getIoInstance();
            io.to(String(roomId)).emit('chat:message', result.systemMessage);
        }

        res.status(200).json({ success: true, message: '사용자를 성공적으로 초대했습니다.' });
    } catch (e) {
        next(e);
    }
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

        // [추가됨] 남은 사람들에게 인원수 업데이트 알림 (Gateway 사용)
        const memberCount = await roomService.getRoomMemberCount(roomId);
        socketGateway.notifyRoomMemberCount(roomId, memberCount);

        // [추가] 시스템 메시지 브로드캐스트
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