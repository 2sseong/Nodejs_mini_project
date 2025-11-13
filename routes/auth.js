// routes/auth.js (시간 복잡도 최적화 버전)

import express from 'express';
// ?? getConnection 대신 executeQuery와 executeTransaction만 가져옵니다.
import { executeQuery, executeTransaction } from '../db/oracle.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// /api/auth/login
router.post('/login', async (req, res) => {
    // **시간 복잡도 O(1)의 객체 비구조화 할당**
    const { email, password } = req.body;

    try {
        // 1. 사용자 정보 및 저장된 비밀번호 조회
        // executeQuery를 사용하면 내부적인 연결 획득/반환 로직이 O(1)로 최적화됨
        const selectSql = `
            SELECT USER_ID, PASSWORD_HASH, NICKNAME, USERNAME
            FROM T_USER
            WHERE USERNAME = :email
        `;
        // **DB 쿼리 시간 복잡도는 O(log N) 또는 O(1) (인덱스 사용)**
        const result = await executeQuery(selectSql, { email });

        const user = result.rows[0];

        // 사용자 ID 존재 확인 (O(1) 검사)
        if (!user) {
            return res.status(401).json({ message: '사용자 ID가 존재하지 않습니다.' });
        }

        // 2. 비밀번호 직접 비교 (O(L) 또는 O(1))
        const isMatch = (password === user.PASSWORD_HASH);

        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        // 3. 로그인 성공: JWT 토큰 발행 (O(1))
        const token = jwt.sign(
            { userId: user.USER_ID, username: user.USERNAME },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 4. LAST_LOGIN 시간 업데이트 및 트랜잭션 처리
        // 트랜잭션 처리가 필요하므로 executeTransaction을 사용합니다.
        const updateSql = `
            UPDATE T_USER
            SET LAST_LOGIN = CURRENT_TIMESTAMP
            WHERE USER_ID = :userId
        `;
        // **DB 쿼리 시간 복잡도는 O(log N) 또는 O(1) (인덱스 사용)**
        // executeTransaction이 내부적으로 커밋/롤백/연결반환을 처리합니다.
        await executeTransaction(updateSql, { userId: user.USER_ID });

        // 5. 클라이언트에게 토큰 및 사용자 정보 응답 (O(1))
        res.json({
            success: true,
            token: token,
            user: { userId: user.USER_ID, nickname: user.NICKNAME }
        });

    } catch (err) {
        console.error('Login Error:', err);
        // DB 로직이 분리되었으므로 여기서는 별도의 롤백/클로즈 처리가 필요 없습니다. (공간 복잡도 감소)
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

export default router;