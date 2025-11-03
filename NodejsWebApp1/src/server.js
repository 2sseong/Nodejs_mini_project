// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes.js';

const app = express();
const PORT = process.env.PORT || 1337;

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 미들웨어
app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/health', (_req, res) => res.send('ok'));

// API 라우트
app.use('/api', router);

// ---- 정적 파일 서빙 (public 폴더) ----
const publicPath = path.join(__dirname, '../public');

// 캐시 최적화 예시(필요 시)
const oneDay = 60 * 60 * 24 * 1000;
app.use(express.static(publicPath, {
    extensions: ['html'],     // /about → about.html 자동 해석(선택)
    maxAge: oneDay            // 브라우저 캐시(선택)
}));

// SPA 라우팅(React/Vue 등 클라이언트 라우터 쓸 때 선택)
// API 외의 모든 경로를 index.html로 리다이렉트
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});