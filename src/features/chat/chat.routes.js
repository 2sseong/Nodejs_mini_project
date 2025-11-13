import { Router } from 'express';
import * as ctrl from './chat.controller.js';

// (선택) Zod/Joi validate 미들웨어 붙이면 더 안전
const r = Router();
r.post('/create', ctrl.createRoom);
r.post('/invite', ctrl.invite);
r.delete('/exit/:roomId/:userId', ctrl.leaveRoom);

export default r;