// src/features/auth/authService.js

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as authRepository from './authRepository.js';
import jwt from 'jsonwebtoken';

const saltRounds = 10; 

/**
 * 회원가입 비즈니스 로직
 */
export async function signupUser({ email, password, nickname }) {
    
    // 1. 이메일 중복 확인 (Repository 호출)
    const existingUser = await authRepository.findUserByEmail(email);

    if (existingUser) {
        throw new Error('Email already in use'); 
    }

    // 2. 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. 사용자 ID 생성
    const newUserId = uuidv4(); 

    // 4. DB에 삽입 (Repository 호출)
    const userData = { userId: newUserId, email, hashedPassword, nickname };
    await authRepository.insertUser(userData);

    return {
        userId: newUserId,
        nickname: nickname,
    };
}

/**
 * 로그인 비즈니스 로직
 */
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function loginUser({ email, password }) {
    
    // 1. 사용자 정보 조회 (Repository 호출)
    const user = await authRepository.findUserByEmail(email);

    if (!user) {
        throw new Error('User not found'); 
    }

    // 2. 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!isMatch) {
        throw new Error('Password mismatch'); 
    }

    // 3. 로그인 성공: JWT 토큰 발행
    const token = jwt.sign(
        { userId: user.USER_ID, username: user.USERNAME },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // 4. LAST_LOGIN 시간 업데이트 (Repository 호출)
    // Controller가 아닌 Service에서 비즈니스 로직에 포함된 DB 업데이트를 수행합니다.
    await authRepository.updateLastLogin(user.USER_ID);

    // 5. 토큰과 사용자 정보 반환
    return {
        token: token,
        user: user, // 사용자 ID, 닉네임, 이메일 등이 포함된 객체를 반환 (Controller로)
    };
}