// src/server.js (정리판: 프론트에서 미사용 API/헬스 제거)
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server } from 'socket.io'
import authRouter from '../routes/auth.js'

const app = express()
const PORT = process.env.PORT || 1337

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 미들웨어
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 정적 파일 (Vite 빌드 산출물)
const publicPath = path.join(__dirname, '../client/dist')
const oneDay = 60 * 60 * 24 * 1000
app.use(express.static(publicPath, { extensions: ['html'], maxAge: oneDay }))
app.use('/api', authRouter)

// SPA 라우팅
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, '../index.html'))
})

// Socket.IO
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
})

io.on('connection', (socket) => {
    console.log('socket connected', socket.id)

    socket.on('chat:message', (msg) => {
        // 모두에게 브로드캐스트
        io.emit('chat:message', msg)
    })

    socket.on('disconnect', () => {
        console.log('socket disconnected', socket.id)
    })
})

httpServer.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`)
})