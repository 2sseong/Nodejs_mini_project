import { Router } from 'express';
import roomRoutes from './rooms/room.routes.js';

const r = Router();

// Room 관련 라우트 마운트
r.use('/', roomRoutes); 
// Message 관련 라우트가 생긴다면 r.use('/messages', messageRoutes) 추가

export default r;