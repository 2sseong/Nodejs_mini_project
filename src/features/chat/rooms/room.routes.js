import { Router } from 'express';
import * as ctrl from './room.controller.js';

const r = Router();

r.post('/create', ctrl.createRoom);
r.post('/invite', ctrl.invite);
r.delete('/exit/:roomId/:userId', ctrl.leaveRoom);

export default r;