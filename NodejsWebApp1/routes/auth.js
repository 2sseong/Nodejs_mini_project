// routes/auth.js

const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
// const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// .env 파일에서 JWT 비밀키를 불러오거나, 없을 경우 대체 값 사용
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body; // 클라이언트에서 전송된 ID, PW

    let connection;
    try {
        connection = await oracle.getConnection();

        // 1. 사용자 정보 및 저장된 비밀번호 조회
        // DB에서 UUID 형태의 USER_ID 조회
        const sql = `
            SELECT USER_ID, PASSWORD_HASH, NICKNAME 
            FROM T_USER 
            WHERE USERNAME = :email
        `;
        const result = await connection.execute(sql, { email }, { outFormat: oracle.oracledb.OUT_FORMAT_OBJECT });

        const user = result.rows[0];

        // 사용자 ID 존재 확인
        if (!user) {
            return res.status(401).json({ message: '사용자 ID가 존재하지 않습니다.' });
        }

        // 2. 비밀번호 직접 비교 (test) 나중에 해시값으로 변경
        // user.PASSWORD는 DB에 저장된 비밀번호
        const isMatch = (password === user.PASSWORD_HASH);

        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        // 3. 로그인 성공: JWT 토큰 발행
        // DB에서 조회된 UUID 형태의 user.USER_ID를 JWT 페이로드에 담기
        const token = jwt.sign(
            { userId: user.USER_ID, username: user.USERNAME },
            JWT_SECRET,
            { expiresIn: '1h' } // 토큰 유효 기간 1시간 설정
        );

        // 로그인 성공 후 LAST_LOGIN 시간 업데이트
        const updateSql = `
            UPDATE T_USER
            SET LAST_LOGIN = CURRENT_TIMESTAMP
            WHERE USER_ID = :userId
        `;
        await connection.execute(updateSql, { userId: user.USER_ID });

        // 4. 클라이언트에게 토큰 및 사용자 정보 응답
        res.json({
            success: true,
            token: token,
            user: { userId: user.USER_ID, nickname: user.NICKNAME }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) {
            try {
                await connection.close(); // 연결 풀로 커넥션 반환
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

module.exports = router;