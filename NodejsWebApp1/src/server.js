// src/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server } from 'socket.io'

// 그대로 사용: 네 oracle.js
import { initialize as initOracleDB } from '../db/oracle.js'

// 기존 라우터 그대로 사용(프론트 경로 안 깨짐)
import authRouter from '../routes/auth.js'
import chatsRouter from '../routes/chats.js'
import inviteRouter from '../routes/invite.js'
import friendRoutes from '../routes/friendRoutes.js'

// 소켓 초기화/스토어
import initSocket from './socket.js'            // ← 현재 initSocket(io)를 쓰는 형태라면 그대로
import { setIoInstance } from './sockets/socketStore.js'

const app = express()
const PORT = process.env.PORT || 1337
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 미들웨어
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API 라우터 
app.use('/api', authRouter)
app.use('/chats', chatsRouter)
app.use('/users', inviteRouter)
app.use('/api/friends', friendRoutes)

// 정적 파일
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))

// 서버 스타트 함수로 감싸서 DB 먼저 초기화
async function start() {
    try {
        // 1) DB 풀 먼저 준비
        await initOracleDB()
        console.log('Oracle DB Connection Pool established successfully.')

        // 2) HTTP + Socket.IO
        const httpServer = http.createServer(app)
        const io = new Server(httpServer, {
            cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true }
        })

        // SocketStore에 보관(게이트웨이 패턴)
        setIoInstance(io)

        // (선택) 레거시 호환 필요 없으면 다음 줄은 제거 가능
        // app.set('io', io)

        // 현재 구조가 initSocket(io)라면 그대로
        initSocket(io)

        httpServer.listen(PORT, () => {
            console.log(`Server on http://localhost:${PORT}`)
        })
    } catch (e) {
        console.error('Server failed to start:', e)
        process.exit(1)
    }
}

start()