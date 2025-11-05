// src/server.js (채팅 및 Socket.IO 모듈 통합 최종 버전)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server } from 'socket.io'

// ==========================================================
// 1. ESM 모듈 불러오기 (DB, 인증, 채팅 라우터, 소켓 초기화)
import { initialize as initOracleDB } from '../db/oracle.js';
import authRouter from '../routes/auth.js';
import chatsRouter from '../routes/chats.js';
import initSocket from './socket.js';
// ==========================================================

const app = express()
const PORT = process.env.PORT || 1337
// CLIENT_URL을 환경 변수에서 가져오는 것이 가장 안정적입니다.
const CLIENT_URL = 'http://localhost:5173';

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 2. 미들웨어 설정
app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 3. API 라우터 마운트
app.use('/api', authRouter);
// 채팅방 라우터 추가
app.use('/chats', chatsRouter);

// 4. 정적 파일 (Vite 빌드 산출물)
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))

// 5. SPA 라우팅 추가
app.get('*', (req, res) => {
    // 💡 API 경로로 들어온 요청이 라우터에 의해 처리되지 않은 경우 404 응답 (시간 복잡도 O(1) 검사)
    if (req.url.startsWith('/api')) {
        return res.status(404).send("API Not Found");
    }
    // 나머지 모든 요청은 index.html을 반환하여 React 라우팅 처리 (시간 복잡도 O(1) I/O)
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

// Socket.io 인스턴스를 Express 앱에 저장
// 이렇게 해야 routes/chats.js에서 req.app.get('io')로 접근
app.set('io', io);

// 7. Socket.io 로직 분리: 초기화 함수 호출
initSocket(io);

// 8. 서버 리스닝 및 DB 초기화
httpServer.listen(PORT, async () => {
    try {
        // 🌟 DB 연결 풀 초기화 실행 (시간 복잡도 최우선)
        // 서버 실행 전 DB 연결 준비를 완료하여 런타임 성능을 극대화합니다.
        await initOracleDB();
        console.log(`Oracle DB Connection Pool established successfully.`);
        console.log(`Server on http://localhost:${PORT}`);
    } catch (e) {
        // DB 초기화 실패 시 서버 종료
        console.error("Server failed to start due to DB initialization error:", e.message);
        process.exit(1);
    }
});