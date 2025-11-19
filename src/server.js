// src/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
//import { Server } from 'socket.io'


// 그대로 사용: 네 oracle.js
import { initialize as initOracleDB } from '../db/oracle.js'

// 기존 라우터 그대로 사용(프론트 경로 안 깨짐)
import authRouter from './features/auth/authRoutes.js'
import chatsRouter from './features/chat/chat.routes.js'
import searchRouter from './features/search/search.routes.js'
import friendRoutes from './features/friend/friendRoutes.js'

// 소켓 초기화/스토어
import initSocket from './socket.js'            // ← 현재 initSocket(io)를 쓰는 형태라면 그대로
//import { setIoInstance } from './sockets/socketStore.js'

const app = express()
const PORT = process.env.PORT || 1337
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '..','public','uploads');
// 미들웨어
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(PUBLIC_UPLOADS_DIR));

// API 라우터 
app.use('/api/auth', authRouter)
app.use('/chats', chatsRouter)
app.use('/users', searchRouter)
app.use('/api/friends', friendRoutes)

// 정적 파일
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))

// 서버 스타트 함수로 감싸서 DB 먼저 초기화
async function start() {
    try {
        // 1) DB 풀 먼저 준비
        await initOracleDB();
        console.log('Oracle DB Connection Pool established successfully.');

        // 2) [수정] HTTP 서버 생성까지만
        const httpServer = http.createServer(app);

        // 3) [수정] initSocket이 io 인스턴스를 생성하고 반환하도록 함
        //    (io 생성, setIoInstance, io.on('connection') 로직이 모두 socket.js로 이동)
        const io = initSocket(httpServer); 

        // 4) [수정] 기존 http 서버 리슨
        httpServer.listen(PORT, () => {
            console.log(`Server on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Server failed to start:', e);
        process.exit(1);
    }
}

start()