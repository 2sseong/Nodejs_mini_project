
document.getElementById('load').addEventListener('click', async () => {
    const res = await fetch('/api/items');    // 같은 오리진 → CORS 걱정 X
    const data = await res.json();
    document.getElementById('out').textContent = JSON.stringify(data, null, 2);
});

const express = require('express');
const authRoutes = require('./routes/auth');
const app = express();


// ** db연동 **
const oracle = require('./db/oracle');
const port = 1337;

// 서버 시작
async function startServer() {
    try {
        // 1. Oracle DB 연결 풀 초기화 시도
        await oracle.initialize();

        // 2. 서버 리스닝 시작
        server.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });

    } catch (err) {
        console.error('Server startup failed due to DB error:', err);
        process.exit(1); // 오류 발생 시 서버 종료
    }
}

// 서버 시작
startServer();

// Socket.IO 이벤트 핸들링...
// (여기에 실시간 채팅 로직이 들어갑니다)
io.on('connection', (socket) => {
    // ...
});

// 1. JSON 파싱 미들웨어 (req.body를 읽기 위해 필수)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 인증 라우트 등록
// '/api/auth' 경로로 들어오는 모든 요청을 authRoutes (routes/auth.js)로 보냄
app.use('/api/auth', authRoutes); 