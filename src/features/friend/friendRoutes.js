import express from 'express';
import { verifyToken } from '../../middlewares/authMiddleware.js';

console.log('🔥 friendRoutes loaded');

const router = express.Router();

// Controller 계층을 가져옴
// Controller 파일의 이름이 friendController.js 이며 ESM으로 export 했으므로 import * as 로 가져옴
import * as friendController from './friendController.js';

// GET /friends 경로에 getFriendList 함수를 연결
// (server.js에서 /api/friends로 마운트할 예정이므로, 최종 경로는 /api/friends/friends가 됨)
// router.get('/friends', friendController.getFriendList);

// POST /request (친구 추가 요청)
// 최종 경로는 server.js에서 마운트된 /api/friends/request가 됨
router.post('/request', friendController.requestFriendship);

// 사용자검색
router.get('/search', verifyToken, friendController.searchUsers);

// JWT 검증
router.get('/', verifyToken, friendController.getFriendList);

// src/server.js에서 import할 수 있게
export default router;