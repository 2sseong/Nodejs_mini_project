// routes/auth.js

import express from 'express';
// Controller 함수 import (Controller가 로직을 관리합니다)
import * as authController from './authController.js'; 

const authRouter = express.Router();

// /api/auth/login 경로를 authController의 login 함수와 연결
authRouter.post('/login', authController.login);

// /api/auth/signup 경로를 authController의 signup 함수와 연결
authRouter.post('/signup', authController.signup);

export default authRouter;