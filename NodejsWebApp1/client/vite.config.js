// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // 1. 일반 HTTP/API 요청 프록시
            '/api': {
                target: 'http://localhost:1337',
                changeOrigin: true,
            },
            // 2. Socket.io 또는 WebSocket 요청만 프록시
            '/socket': {
                target: 'http://localhost:1337',
                ws: true, // WebSocket 프록시 활성화
                changeOrigin: true,
            },
        }
    }
})