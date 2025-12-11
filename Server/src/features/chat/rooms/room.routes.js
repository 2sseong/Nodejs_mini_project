import { Router } from 'express';
import * as ctrl from './room.controller.js';

const r = Router();

r.post('/create', ctrl.createRoom);
r.post('/invite-multiple', ctrl.inviteUsers);
r.delete('/exit/:roomId/:userId', ctrl.leaveRoom);
r.get('/:roomId/members', ctrl.getRoomMembers);

// 채팅방 알림 설정
r.get('/:roomId/notification', ctrl.getNotificationSetting);
r.put('/:roomId/notification', ctrl.updateNotificationSetting);

// 1. 1:1 채팅방 존재 여부 확인
// GET /api/chat/rooms/checkOneToOne?targetId={targetId}
r.get('/checkOneToOne', ctrl.checkChat);

// 2. 새로운 1:1 채팅방 생성
// POST /api/chat/rooms/createOneToOne
r.post('/createOneToOne', ctrl.createChat);

export default r;