import chatService from './chat.service.js';
import socketGateway from '../../sockets/socket.gateway.js';

export async function createRoom(req, res, next) {
    try {
        const { roomName, creatorId } = req.body;
        const result = await chatService.createRoom({ roomName, creatorId });

        socketGateway.notifyRoomCreatedToUser(result.creatorId, {
            roomId: result.roomId, roomName: result.roomName, roomType: result.roomType,
        });

        res.status(201).json({ success: true, roomId: result.roomId, roomName: result.roomName });
    } catch (e) { next(e); }
}

export async function invite(req, res, next) {
    try {
        const { roomId, inviterId, inviteeId } = req.body;
        await chatService.inviteUserToRoom({ roomId, inviterId, inviteeId });
        res.json({ success: true, message: '사용자를 성공적으로 초대했습니다.' });

        socketGateway.requestRoomsRefresh(inviteeId);
    } catch (e) { next(e); }
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
        // [400] 직접 응답
        return res.status(400).json({
            success: false,
            message: `채팅방 ID와 사용자 ID는 필수입니다.${roomId}${userId}`
        });
    }

    try {
        const rowsAffected = await chatService.leaveRoom({ roomId, userId });

        // 성공 응답 전 소켓 이벤트 트리거
        socketGateway.requestRoomsRefresh(userId);

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