// routes/auth.js (ES Module)

// 1. require 대신 import 사용
import express from 'express';
// db/oracle.js에서 export된 함수들을 Named Import로 가져옵니다.
import { getConnection, oracledb } from '../db/oracle.js';
import jwt from 'jsonwebtoken';
// import bcrypt from 'bcrypt'; // 나중에 bcrypt 사용 시 주석 해제

const router = express.Router();

// .env 파일에서 JWT 비밀키를 불러오거나, 없을 경우 대체 값 사용
// process.env를 직접 사용해도 됩니다.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// /api/auth/login
router.post('/login', async (req, res) => {
    // ?? 시간 복잡도 O(1)의 객체 비구조화 할당
    const { email, password } = req.body;

    let connection;
    try {
        // ?? DB 연결 시간복잡도는 O(1) (풀 사용)
        connection = await getConnection(); // Named Import된 getConnection 사용

        // 1. 사용자 정보 및 저장된 비밀번호 조회 (시간 복잡도는 O(log N) 또는 O(1), 인덱스 사용 시)
        const sql = `
            SELECT USER_ID, PASSWORD_HASH, NICKNAME, USERNAME
            FROM T_USER
            WHERE USERNAME = :email
        `;

        const result = await connection.execute(
            sql,
            { email },
            // oracledb 객체도 Named Import로 가져와서 사용
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const user = result.rows[0];

        // 사용자 ID 존재 확인 (O(1) 검사)
        if (!user) {
            return res.status(401).json({ message: '사용자 ID가 존재하지 않습니다.' });
        }

        // 2. 비밀번호 직접 비교 (test)
        // ?? 현재는 O(L) (L은 비밀번호 길이) 또는 O(1) 비교
        // ?? 나중에 bcrypt를 사용한다면 시간복잡도는 O(N) (N은 해시 라운드 수) -> 보안을 위해 권장
        const isMatch = (password === user.PASSWORD_HASH);

        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        // 3. 로그인 성공: JWT 토큰 발행 (O(1) 또는 O(L) ? 페이로드 길이)
        const token = jwt.sign(
            { userId: user.USER_ID, username: user.USERNAME },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 로그인 성공 후 LAST_LOGIN 시간 업데이트
        const updateSql = `
            UPDATE T_USER
            SET LAST_LOGIN = CURRENT_TIMESTAMP
            WHERE USER_ID = :userId
        `;

        // ?? 시간 복잡도 O(log N) 또는 O(1) (인덱스 사용 시)
        await connection.execute(updateSql, { userId: user.USER_ID });
        await connection.commit(); // ?? 트랜잭션 커밋

        // 4. 클라이언트에게 토큰 및 사용자 정보 응답 (O(1))
        res.json({
            success: true,
            token: token,
            user: { userId: user.USER_ID, nickname: user.NICKNAME }
        });

    } catch (err) {
        console.error('Login Error:', err);
        // 오류 발생 시 롤백 (안전성 증가)
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error('Error during rollback:', rbErr);
            }
        }
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) {
            try {
                // 연결 풀로 커넥션 반환 (O(1))
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// 2. module.exports 대신 export default 사용
export default router;