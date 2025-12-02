// src/features/auth/authRoutes.js
import express from 'express';
import * as authController from './authController.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';
import { fileURLToPath } from 'url'
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.join(__dirname, '..','..','..', 'public', 'profile');

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('[Multer] 파일 저장 경로 확인:', UPLOAD_DIR); // 디버깅 로그
        
        // 폴더가 없으면 생성
        if (!fs.existsSync(UPLOAD_DIR)){
            console.log('[Multer] 폴더가 없어 생성합니다.');
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newName = `profile-${uniqueSuffix}${ext}`;
        console.log('[Multer] 생성된 파일명:', newName);
        cb(null, newName);
    }
});

const upload = multer({ storage: storage });
const authRouter = express.Router();

// Multer 에러를 잡기 위한 래퍼 미들웨어
const uploadMiddleware = (req, res, next) => {
    const uploader = upload.single('profilePic');
    uploader(req, res, (err) => {
        if (err) {
            // Multer 자체 에러 (용량 초과, 형식 오류 등)
            console.error('[Multer Error 발생]:', err);
            return res.status(400).json({ message: '파일 업로드 중 에러 발생', error: err.message });
        }
        // 에러가 없으면 다음 컨트롤러(authController.uploadProfile)로 이동
        next();
    });
};

// /api/auth/login 경로를 authController의 login 함수와 연결
authRouter.post('/login', authController.login);

// /api/auth/signup 경로를 authController의 signup 함수와 연결
authRouter.post('/signup', authController.signup);

authRouter.get('/me', verifyToken, authController.getMyInfo);
authRouter.post('/verify-password', verifyToken, authController.verifyPassword);
authRouter.put('/update', verifyToken, authController.updateInfo);
authRouter.post('/profile-image', verifyToken, upload.single('profilePic'), authController.uploadProfile);

// 래퍼 미들웨어 적용
authRouter.post('/profile-image', verifyToken, uploadMiddleware, authController.uploadProfile);

export default authRouter;