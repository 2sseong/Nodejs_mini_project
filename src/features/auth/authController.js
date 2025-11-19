// src/features/auth/authController.js

import { signupUser, loginUser } from './authService.js';

/**
 * POST /api/auth/signup 요청 처리
 */
export async function signup(req, res) {
    const { email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
        return res.status(400).json({ message: '모든 필드를 입력해야 합니다.' });
    }
    
    try {
        const newUser = await signupUser({ email, password, nickname });

        res.status(201).json({ 
            success: true,
            message: '회원가입이 성공적으로 완료되었습니다. \n5초 후 로그인 화면으로 이동합니다.',
            userId: newUser.userId,
            nickname: newUser.nickname,
        });

    } catch (error) {
        console.error('Signup Controller Error:', error.message);

        if (error.message === 'Email already in use') {
            return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
        }
        
        res.status(500).json({ message: '회원가입 중 서버 오류가 발생했습니다.' });
    }
}

/**
 * POST /api/auth/login 요청 처리
 */
export async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: '이메일과 비밀번호를 입력해야 합니다.' });
    }

    try {
        // 1. Service 함수 호출 (인증, 토큰 발행, DB 업데이트 로직 실행)
        const { token, user } = await loginUser({ email, password });

        // 2. 성공 응답
        res.json({
            success: true,
            token: token,
            user: { userId: user.USER_ID, nickname: user.NICKNAME }
        });

    } catch (error) {
        console.error('Login Controller Error:', error.message);

        // 3. 오류 처리
        if (error.message === 'User not found' || error.message === 'Password mismatch') {
            // 사용자 ID 없음, 비밀번호 불일치 모두 401 Unauthorized 반환하여 정보 숨김
            return res.status(401).json({ message: '사용자 ID가 존재하지 않거나 비밀번호가 일치하지 않습니다.' });
        }

        res.status(500).json({ message: '로그인 중 서버 오류가 발생했습니다.' });
    }
}