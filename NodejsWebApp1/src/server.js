// src/server.js (최종 ESM 통합 및 안정화 버전)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server } from 'socket.io'
// import { createRequire } from 'module'; // ❌ CJS 모듈 로드를 위한 createRequire 제거

// ==========================================================
// 1. ESM 라우터/DB 모듈 불러오기: 표준 import 사용
// db/oracle.js에서 export된 initialize 함수를 명시적으로 가져옵니다.
import { initialize as initOracleDB } from '../db/oracle.js';
// routes/auth.js에서 export default된 라우터를 가져옵니다.
import authRouter from '../routes/auth.js';
// ==========================================================


const app = express()
const PORT = process.env.PORT || 1337

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 2. 미들웨어 설정
app.use(cors({ origin: true, credentials: true }))
app.use(express.json()) // JSON 본문 파싱
app.use(express.urlencoded({ extended: true })) // URL 인코딩 본문 파싱

// 3. API 라우터 마운트
app.use('/api', authRouter);

// 4. 정적 파일 (Vite 빌드 산출물)
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))

// 5. SPA 라우팅 추가 (가장 마지막)
app.get('*', (req, res) => {
    // API 경로로 들어온 요청이 라우터에 의해 처리되지 않은 경우 404 응답
    if (req.url.startsWith('/api')) {
        return res.status(404).send("API Not Found");
    }
    // 나머지 모든 요청은 index.html을 반환하여 React 라우팅 처리
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Socket.IO
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
})

io.on('connection', (socket) => {
    console.log('socket connected', socket.id)
    socket.on('chat:message', (msg) => {
        io.emit('chat:message', msg)
    })
    socket.on('disconnect', () => {
        console.log('socket disconnected', socket.id)
    })
})

// 6. 서버 리스닝 및 DB 초기화
httpServer.listen(PORT, async () => {
    try {
        // 🌟 DB 연결 풀 초기화 실행 (가장 중요)
        await initOracleDB();
        console.log(`Oracle DB Connection Pool established successfully.`);
        console.log(`Server on http://localhost:${PORT}`);
    } catch (e) {
        // DB 초기화 실패 시 서버 종료
        console.error("Server failed to start due to DB initialization error:", e.message);
        process.exit(1);
    }
});