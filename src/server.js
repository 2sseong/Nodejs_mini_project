// src/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs' // [필수] 파일 시스템 모듈 추가
import { fileURLToPath } from 'url'
import http from 'http'
import { initialize as initOracleDB } from '../db/oracle.js'

import authRouter from './features/auth/authRoutes.js'
import chatsRouter from './features/chat/chat.routes.js'
import searchRouter from './features/search/search.routes.js'
import friendRoutes from './features/friend/friendRoutes.js'
import initSocket from './socket.js'

console.log('🔥 server.js loaded');

const app = express()
const PORT = process.env.PORT || 1337
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// 1. [중요] 경로 설정 (절대 경로로 확실하게 잡기)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.join(__dirname, '..'); // src의 상위 폴더 (프로젝트 루트)

const PUBLIC_UPLOADS_DIR = path.join(PROJECT_ROOT, 'public', 'uploads');
const PUBLIC_PROFILE_DIR = path.join(PROJECT_ROOT, 'public', 'profile');


// 3. 미들웨어 설정
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 요청 로그 (이미지 요청은 별도로 표시하여 확인 쉽도록 함)
app.use((req, res, next) => {
    if (req.path.startsWith('/profile/')) {
        console.log(`[IMG Req] ${req.method} ${req.path}`);
    } else {
        // API 요청 로그가 너무 많으면 주석 처리 가능
        console.log(`[API Req] ${req.method} ${req.path}`);
    }
    next();
});

// 4. [핵심] 정적 파일 제공 설정 (헤더 추가)
app.use('/uploads', express.static(PUBLIC_UPLOADS_DIR));

app.use('/profile', (req, res, next) => {
    // 이미지가 다른 포트(5173)에서 잘 보이도록 보안 헤더 설정
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(PUBLIC_PROFILE_DIR));

// 5. [디버깅] 404 에러 핸들러 (이미지 못 찾았을 때 이유 출력)
// 정적 파일 미들웨어에서 파일을 못 찾으면 이 라우터로 넘어옵니다.
app.get('/profile/*', (req, res) => {
    console.error(`[ERROR] 404 Not Found: ${req.path}`);
    console.error(`        -> 서버는 여기를 찾아봤습니다: ${PUBLIC_PROFILE_DIR}`);
    res.status(404).send('Image not found on server');
});

// 6. API 라우터
app.use('/api/auth', authRouter)
app.use('/chats', chatsRouter)
app.use('/users', searchRouter)
app.use('/api/friends', friendRoutes)

// 프론트엔드 빌드 파일
const publicPath = path.join(__dirname, '../client/dist')
app.use(express.static(publicPath, { extensions: ['html'], maxAge: 60 * 60 * 24 * 1000 }))

// 서버 시작
async function start() {
    try {
        await initOracleDB();
        console.log('Oracle DB Connection Pool established successfully.');

        const httpServer = http.createServer(app);
        
        // 1. 소켓 생성
        const io = initSocket(httpServer); 

        // Express 앱 어디서든 io를 쓸 수 있게 저장
        app.set('io', io); 

        httpServer.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Server failed to start:', e);
        process.exit(1);
    }
}

start()