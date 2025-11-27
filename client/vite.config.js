// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        // 빌드 결과 폴더가 'dist'가 아니라면 여기서 'outDir'을 수정해야 합니다.
        outDir: 'dist', 
    },
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
            '/chats': {
                target: 'http://localhost:1337',
                changeOrigin: true,
            },
            '/users': {
                target: 'http://localhost:1337',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:1337',
                changeOrigin: true, //출처 변경
            },
            // '/friends': {
            //     target: 'http://localhost:1337',
            //     changeOrigin: true,
            // },
        }
    }
})