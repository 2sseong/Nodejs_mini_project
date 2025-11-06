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
import inviteRouter from '../routes/invite.js';
// 🔑 SocketStore에 IO 인스턴스 설정을 위한 import 추가
import { setIoInstance } from './socketStore.js';
// ==========================================================

const app = express()
const PORT = process.env.PORT || 1337
// CLIENT_URL을 환경 변수에서 가져오는 것이 가장 안정적입니다.
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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
// 인원초대 라우터 추가
app.use('/users', inviteRouter);



// 6. Socket.IO 서버 설정
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true
    }
})

// 🔑 [O(1) 소켓 인스턴스 저장]
// SocketStore 모듈에 io 인스턴스를 저장하여 다른 모듈(라우터)에서 접근 가능하게 함.
setIoInstance(io);

// Socket.io 인스턴스를 Express 앱에 저장 (레거시 방식이지만, 필요시 대비)
app.set('io', io);

// 7. Socket.io 로직 분리: 초기화 함수 호출
initSocket(io);

// 8. 서버 리스닝 및 DB 초기화
httpServer.listen(PORT, async () => {
    try {
        // DB 연결 풀 초기화 실행 (시간 복잡도 최우선)
        await initOracleDB();
        console.log(`Oracle DB Connection Pool established successfully.`);
        console.log(`Server on http://localhost:${PORT}`);
    } catch (e) {
        // DB 초기화 실패 시 서버 종료
        console.error("Server failed to start due to DB initialization error:", e.message);
        process.exit(1);
    }
});
