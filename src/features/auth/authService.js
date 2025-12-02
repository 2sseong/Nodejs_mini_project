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
export async function signupUser({ email, password, nickname, department, position }) {

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
    const userData = { userId: newUserId, email, hashedPassword, nickname, department, position };
    await authRepository.insertUser(userData);

    return {
        userId: newUserId,
        nickname: nickname,
        department: department,
        position: position,
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
    console.log(`[Service] 프로필 사진 변경 시작. 사용자 ID: ${userId}`);

    // 1. 기존 파일 정보 조회
    const user = await authRepository.findUserById(userId);

    if (user && user.PROFILE_PIC) {
        try {
            // user.PROFILE_PIC 예시: "/profile/profile-12345.png"
            const fileName = path.basename(user.PROFILE_PIC); // "profile-12345.png" 추출

            // process.cwd()는 현재 서버가 실행 중인 최상위 폴더 경로입니다.
            const oldPath = path.join(process.cwd(), '..', 'public', 'profile', fileName);

            console.log(`[Service] 삭제 시도할 파일 경로: ${oldPath}`);

            // 파일이 실제로 존재하는지 체크 후 삭제
            await fs.access(oldPath).then(() => {
                return fs.unlink(oldPath);
            }).then(() => {
                console.log(`[Service] 기존 프로필 사진 삭제 성공`);
            }).catch((err) => {
                // 파일이 없거나(ENOENT) 권한 문제 등은 로그만 남기고 넘어감
                console.warn(`[Service] 기존 파일 삭제 실패 (무시됨): ${err.message}`);
            });

        } catch (e) {
            console.error('[Service] 파일 삭제 로직 중 예외 발생:', e);
        }
    } else {
        console.log('[Service] 기존 프로필 사진이 없어 삭제를 건너뜁니다.');
    }

    // 2. DB 업데이트 (웹 접근 경로로 저장)
    const webPath = `/profile/${newFile.filename}`;
    await authRepository.updateProfilePic(userId, webPath);

    console.log(`[Service] DB 업데이트 완료: ${webPath}`);
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

/**
 * 팀별 사용자 목록 조회 (그룹핑)
 */
export async function getUsersGroupedByTeam() {
    const users = await authRepository.getUsersByTeam();

    // 부서별로 그룹핑
    const groupedByTeam = {};
    users.forEach(user => {
        const teamName = user.DEPARTMENT;
        if (!groupedByTeam[teamName]) {
            groupedByTeam[teamName] = [];
        }
        groupedByTeam[teamName].push({
            userId: user.USER_ID,
            nickname: user.NICKNAME,
            email: user.USERNAME,
            profilePic: user.PROFILE_PIC,
            position: user.POSITION,
            department: user.DEPARTMENT
        });
    });

    return groupedByTeam;
}