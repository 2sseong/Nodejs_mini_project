// src/server.js (최종 ESM 통합 버전)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server } from 'socket.io'

// ==========================================================
// 1. ESM 모듈 불러오기
import { initialize as initOracleDB } from '../db/oracle.js';
import authRouter from '../routes/auth.js';
import initSocket from './socket.js'; // 💡 socket.js 모듈 추가
// ==========================================================

const app = express()
const PORT = process.env.PORT || 1337
const CLIENT_URL = 'http://localhost:5173';

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 2. 미들웨어 설정
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 3. API 라우터 마운트
app.use('/api', authRouter);

// 4. 정적 파일 (Vite 빌드 산출물)
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))

// 5. SPA 라우팅 추가
app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
        return res.status(404).send("API Not Found");
    }
    res.sendFile(path.join(publicPath, 'index.html'));
});

// 6. Socket.IO 서버 설정
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true
    }
})

// 💡 7. Socket.io 로직 분리: 초기화 함수 호출
initSocket(io);

// 8. 서버 리스닝 및 DB 초기화
httpServer.listen(PORT, async () => {
    try {
        // 🌟 DB 연결 풀 초기화 실행
        await initOracleDB();
        console.log(`Oracle DB Connection Pool established successfully.`);
        console.log(`Server on http://localhost:${PORT}`);
    } catch (e) {
        console.error("Server failed to start due to DB initialization error:", e.message);
        process.exit(1);
    }
});