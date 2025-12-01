import express from 'express';
import { verifyToken } from '../../middlewares/authMiddleware.js';

console.log('🔥 friendRoutes loaded');

const router = express.Router();

// Controller 계층을 가져옴
import * as friendController from './friendController.js';

// POST /request (친구 추가 요청) - 현재 미구현
// router.post('/request', friendController.requestFriendship);

// 사용자 검색
router.get('/search', verifyToken, friendController.searchUsers);

// JWT 검증
router.get('/', verifyToken, friendController.getFriendList);

// 즐겨찾기
router.post('/pick', verifyToken, friendController.togglePick);

export default router;