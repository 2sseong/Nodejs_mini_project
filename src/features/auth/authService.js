// src/features/auth/authService.js

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as authRepository from './authRepository.js';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import path from 'path';

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

//------------------- MyInfoPage 관련 추가 기능 ---------------------------------
// 내 정보 조회
export async function getUserInfo(userId) {
    // 여기서 방금 만드신 repository의 findUserById를 호출합니다.
    const user = await authRepository.findUserById(userId);
    
    // 만약 여기서 "authRepository.findUserById is not a function" 에러가 난다면
    // authRepository.js 저장이 안 되었거나 서버 재시작이 안 된 것입니다.
    if (!user) throw new Error('User not found');
    return user;
}

// 비밀번호 확인
export async function verifyPassword(userId, password) {
    const hash = await authRepository.findPasswordHashById(userId);
    if (!hash) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) throw new Error('Password mismatch');
    
    return true;
}

// 프로필 사진 변경 (기존 파일 삭제 포함)
export async function updateProfileImage(userId, newFile) {
    // 1. 기존 파일 정보 조회하여 삭제
    const user = await authRepository.findUserById(userId);
    if (user && user.PROFILE_PIC) {
        try {
            // 경로는 상황에 맞게 조정 (server.js의 __dirname 기준이나 절대경로 활용 권장)
            // 여기서는 public/profile 폴더가 프로젝트 루트 기준 ../public/profile에 있다고 가정
            const oldPath = path.resolve('public/profile', path.basename(user.PROFILE_PIC));
            await fs.unlink(oldPath).catch(err => console.log('Old profile pic delete fail:', err.message));
        } catch (e) {
            console.error('File deletion error:', e);
        }
    }

    // 2. DB 업데이트 (웹 접근 경로로 저장)
    // server.js에서 '/profile' 로 매핑했으므로 웹 경로는 '/profile/파일명'
    const webPath = `/profile/${newFile.filename}`;
    await authRepository.updateProfilePic(userId, webPath);

    return webPath;
}

// 정보 수정
export async function updateUserInfo(userId, { nickname, newPassword }) {
    // 1. 닉네임 업데이트
    if (nickname) {
        await authRepository.updateUserInfo(userId, nickname);
    }

    // 2. 비밀번호 변경 요청이 있다면 처리
    if (newPassword) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await authRepository.updateUserPassword(userId, hashedPassword);
    }

    return { nickname, message: '정보가 수정되었습니다.' };
}