import { Router } from 'express';
import * as ctrl from './room.controller.js';

const r = Router();

r.post('/create', ctrl.createRoom);
r.post('/invite-multiple', ctrl.inviteUsers);
r.delete('/exit/:roomId/:userId', ctrl.leaveRoom);
r.get('/:roomId/members', ctrl.getRoomMembers);

export default r;