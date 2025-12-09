import { Router } from 'express';
import roomRoutes from './rooms/room.routes.js';
import * as messageController from './messages/message.controller.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const r = Router();

// 모든 채팅 관련 라우트에 인증 미들웨어 적용
r.use(verifyToken);

// Message 관련 라우트가 생긴다면 r.use('/messages', messageRoutes) 추가
r.get('/rooms/:roomId/messages/search', messageController.searchRoomMessages);
r.get('/rooms/:roomId/messages/:msgId/context', messageController.getMessageContext);
r.get('/rooms/:roomId/messages/:msgId/newer', messageController.getNewerMessages);
r.get('/rooms/:roomId/files', messageController.getRoomFiles);

// Room 관련 라우트 마운트
r.use('/', roomRoutes);
export default r;