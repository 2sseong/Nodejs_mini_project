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