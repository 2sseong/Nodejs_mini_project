// src/middlewares/authMiddleware.js
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

/**
 * JWT 인증 미들웨어
 * - 요청 헤더의 Authorization 에서 토큰을 꺼내서 검증
 * - 유효하면 req.user 에 { userId, username } 저장
 * - 실패하면 401 Unauthorized 반환
 */
export function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    // 1. Authorization 헤더 존재 여부 확인
    if (!authHeader) {
        return res.status(401).json({
            message: '인증 토큰이 없습니다. (Authorization 헤더 없음)',
        });
    }

    // 2. "Bearer <token>" 형식인지 확인
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            message: '토큰 형식이 올바르지 않습니다. (예: Bearer <token>)',
        });
    }

    try {
        // 3. 토큰 검증 및 payload 디코딩
        const decoded = jwt.verify(token, JWT_SECRET);
        // loginUser 에서 넣은 payload: { userId, username }

        // 4. 컨트롤러에서 사용할 수 있도록 req.user에 저장
        req.user = {
            userId: decoded.userId,
            username: decoded.username,
        };

        // 디버깅할 때 켜두면 좋음
        // console.log('인증된 사용자:', req.user);

        // 5. 다음 미들웨어/컨트롤러로 진행
        next();
    } catch (error) {
        console.error('JWT 인증 오류:', error.message);
        return res.status(401).json({
            message: '유효하지 않거나 만료된 토큰입니다.',
        });
    }
}
