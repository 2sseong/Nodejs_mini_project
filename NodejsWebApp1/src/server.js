// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes.js';

const app = express();
const PORT = process.env.PORT || 1337;

// __dirname 대체 (ESM 환경용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- 미들웨어 ----------
app.use(cors({ origin: true, credentials: true })); // 프록시 연동 대비
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- API ----------
app.use('/api', router);

// ---------- 헬스체크 ----------
app.get('/health', (_req, res) => res.send('ok'));


// ---------- 정적 파일 ----------
const publicPath = path.join(__dirname, '../public');
const oneDay = 60 * 60 * 24 * 1000;

app.use(express.static(publicPath, {
    extensions: ['html'],  // /about → about.html 허용
    maxAge: oneDay,        // 캐시 1일
}));

// ---------- SPA 라우팅 ----------
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ---------- 서버 시작 ----------
app.listen(PORT, () => {
    console.log(`? Server running on http://localhost:${PORT}`);
});