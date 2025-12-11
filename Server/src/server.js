// Server/src/server.js
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs' // 파일 시스템 모듈 추가
import express from 'express'
import cors from 'cors'
import http from 'http'

// .env 파일 경로 설정 (Server 폴더)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import { initialize as initOracleDB } from '../db/oracle.js'

import authRouter from './features/auth/authRoutes.js'
import chatsRouter from './features/chat/chat.routes.js'
import searchRouter from './features/search/search.routes.js'
import userRoutes from './features/user/userRoutes.js'
import initSocket from './socket.js'

console.log('🔥 server.js loaded');

const app = express()
const PORT = process.env.PORT || 1337
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// 1. [중요] 경로 설정 (절대 경로로 확실하게 잡기)
const PROJECT_ROOT = path.join(__dirname, '..'); // src의 상위 폴더 (Server 폴더)

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
app.use('/api/users', userRoutes)

// 프론트엔드 빌드 파일
const publicPath = path.join(PROJECT_ROOT, '..', 'Client', 'dist')
app.use(express.static(publicPath, { extensions: ['html'], maxAge: 60 * 60 * 24 * 1000 }))

// --RN을 위한 설정--
// [수정] 모바일 개발을 위해 허용할 출처 추가
// Expo/React Native 개발 시 에뮬레이터나 실제 기기의 IP 주소를 포함해야 함
// 개발 단계에서는 모든 접근을 허용하는 와일드카드(*)를 사용하고,
// credentials: true를 유지하기 위해 와일드카드 대신 배열을 사용해야 함

// 모바일 개발 환경용 허용 목록 (출처를 배열로 관리)
// 1. 기존 웹 클라이언트 URL
// 2. 모바일 에뮬레이터 (일반적으로 10.0.2.2는 안드로이드 에뮬레이터의 localhost를 의미)
// 3. (옵션) 모든 IP를 허용하려면 '*' 대신 요청 시점의 Origin을 동적으로 처리해야 하지만, 
//    간단하게는 모바일 개발 출처를 추가하거나 임시로 와일드카드를 사용함

// [A] 개발 단계에서 가장 확실한 방법 (credentials: true를 잠시 제거하고 와일드카드 사용)
// CORS 설정이 복잡해지는 것을 막기 위해 임시로 이렇게 사용하거나,
/* app.use(cors({ origin: '*', credentials: false })) 
// 또는
app.use(cors()) // origin: * 와 같음
*/

// [B] credentials: true를 유지하면서 모바일 환경을 포함하는 방법 (이걸로 !)
const ALLOWED_ORIGINS = [
    CLIENT_URL,
    `http://${process.env.IP_ADDRESS}:${PORT}`, // 현재 서버 IP:포트 (192.168.0.18:1337)
    'http://localhost:8081', // React Native Metro Bundler의 일반적인 포트
    'http://10.0.2.2:8081', // Android Emulator의 루프백 주소
    'http://10.0.3.2:8081', // Genymotion Emulator의 루프백 주소
];

app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    // *주의: 만약 ALLOWED_ORIGINS에 로컬 IP 주소 외 다른 출처가 있다면 
    // Express 서버에서 'Access-Control-Allow-Origin: *' 헤더를 보내지 못하므로,
    // 정식 배포 전까지는 아래와 같이 요청 Origin을 체크하는 로직을 추가하는 것이 가장 좋음
    // origin: (origin, callback) => {
    //     if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    //         callback(null, true);
    //     } else {
    //         callback(new Error('Not allowed by CORS'));
    //     }
    // }
}));
// --RN을 위한 설정 끝--

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