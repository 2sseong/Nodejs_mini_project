// src/features/auth/authController.js

import * as authService from './authService.js';

/**
 * POST /api/auth/signup 요청 처리
 */
export async function signup(req, res) {
    const { email, password, nickname, deptId, posId, phone, address, addressDetail } = req.body;

    // 필수 입력값 검증 (전화번호/주소는 선택)
    if (!email || !password || !nickname || !deptId || !posId) {
        return res.status(400).json({ message: '모든 필드를 입력해야 합니다.' });
    }

    try {
        // 서비스로 전달
        const newUser = await authService.signupUser({ email, password, nickname, deptId, posId, phone, address, addressDetail });

        // 성공 응답
        res.status(201).json({
            success: true,
            message: '회원가입이 성공적으로 완료되었습니다. \n5초 후 로그인 화면으로 이동합니다.',
            userId: newUser.userId,
            nickname: newUser.nickname,
            deptId: newUser.deptId,
            posId: newUser.posId,
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
        const { token, user } = await authService.loginUser({ email, password });

        // 2. 성공 응답
        res.json({
            success: true,
            token: token,
            user: { userId: user.USER_ID, nickname: user.NICKNAME, username: user.USERNAME }
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


// ------------------- MyInfoPage 관련 추가 기능 ---------------------------------
// 내 정보 조회
export async function getMyInfo(req, res) {
    try {
        const userId = req.user.userId; // verifyToken 미들웨어에서 설정됨
        const user = await authService.getUserInfo(userId);
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('내 정보 조회 상세 에러:', error);

        if (error.message === 'User not found') {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다. 다시 로그인해 주세요.' });
        }
    }
}

// 비밀번호 확인
export async function verifyPassword(req, res) {
    try {
        const { password } = req.body;
        const userId = req.user.userId;
        await authService.verifyPassword(userId, password);
        res.json({ success: true, message: '확인되었습니다.' });
    } catch (error) {
        res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }
}

// 정보 수정
export async function updateInfo(req, res) {
    try {
        const { nickname, deptId, posId, phone, address, addressDetail, newPassword } = req.body;
        const userId = req.user.userId;

        const result = await authService.updateUserInfo(userId, {
            nickname,
            deptId,
            posId,
            phone,
            address,
            addressDetail,
            newPassword
        });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('정보 수정 에러:', error);
        res.status(500).json({ message: '정보 수정 실패' });
    }
}

// 프로필 사진 업로드
export async function uploadProfile(req, res) {
    try {
        if (!req.file) {
            console.error('[ERROR] 파일이 없습니다 (req.file is undefined)');
            return res.status(400).json({ message: '파일이 전송되지 않았습니다.' });
        }

        const userId = req.user.userId;
        const webPath = await authService.updateProfileImage(userId, req.file);
        const io = req.app.get('io');
        if (io) {
            // 모든 접속자에게 'profile_updated' 이벤트를 쏩니다.
            io.emit('profile_updated', {
                userId: userId,
                profilePic: webPath
            });
            console.log(`[Socket] 프로필 업데이트 이벤트 발송: ${userId}`);
        }

        console.log('[SUCCESS] 업로드 완료 경로:', webPath);
        res.json({ success: true, filePath: webPath });
    } catch (error) {
        console.error('[ERROR] 업로드 처리 중 에러:', error);
        res.status(500).json({ message: '업로드 실패' });
    }
}

/**
 * GET /api/auth/users/by-team 팀별 사용자 목록 조회 (그룹핑)
 */
export async function getUsersByTeam(req, res) {
    try {
        const groupedUsers = await authService.getUsersGroupedByTeam();
        res.json({ success: true, data: groupedUsers });
    } catch (error) {
        console.error('팀별 사용자 조회 에러:', error);
        res.status(500).json({ message: '사용자 목록 조회 실패' });
    }
}

/**
 * 부서 목록 조회 API 핸들러
 * GET /api/auth/departments
 */
export async function getDepartments(req, res) {
    try {
        // Service에서 매핑된 데이터를 받아옴
        const departments = await authService.getAllDepartments();

        res.json({ success: true, data: departments });
    } catch (error) {
        console.error('부서 목록 조회 에러:', error);
        res.status(500).json({ message: '부서 목록 조회 실패' });
    }
}

/**
 * 직급 목록 조회 API 핸들러
 * GET /api/auth/positions
 */
export async function getPositions(req, res) {
    try {
        // Service에서 매핑된 데이터를 받아옴
        const positions = await authService.getAllPositions();

        res.json({ success: true, data: positions });
    } catch (error) {
        console.error('직급 목록 조회 에러:', error);
        res.status(500).json({ message: '직급 목록 조회 실패' });
    }
}