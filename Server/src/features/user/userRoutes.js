import express from 'express';
import * as userController from './userController.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = express.Router();

// 사용자 검색 API (GET /api/users/search)
router.get('/search', verifyToken, userController.searchUsers);

// 즐겨찾기 토글 API (POST /api/users/pick)
router.post('/pick', verifyToken, userController.togglePick);

// 본인 프로필 조회 API (GET /api/users/my-profile)
router.get('/my-profile', verifyToken, userController.getMyProfile);

// 전체 알림 설정 조회 API (GET /api/users/notification)
router.get('/notification', verifyToken, userController.getNotificationSetting);

// 전체 알림 설정 변경 API (PUT /api/users/notification)
router.put('/notification', verifyToken, userController.setNotificationSetting);

export default router;