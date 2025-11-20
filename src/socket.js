// src/socket.js
import { Server } from 'socket.io';
import { addSocket, removeSocket, setIoInstance, getOnlineUserIds } from './sockets/socketStore.js';
import chatSocket from './features/chat/chat.socket.js'; // [핵심] chat.socket.js 임포트

export default function initSocket(server) { // [수정] 'io' 대신 'server'를 받음
    const io = new Server(server, { 
        cors: { 
            origin: process.env.CLIENT_URL || 'http://localhost:5173', // server.js와 동일하게 수정
            methods: ['GET', 'POST'], 
            credentials: true 
        } 
    });
    setIoInstance(io); // SocketStore에 저장

    io.on('connection', (socket) => {
        // [수정] 사용자 ID 검증 로직 (기존 버전 A와 동일하게)
        const rawUserId = socket.handshake?.query?.userId;
        const userId = rawUserId ? String(rawUserId).trim() : '';

        if (!userId) {
            console.error('[Socket] userId missing. disconnect.');
            socket.disconnect();
            return;
        }
        
        socket.data.userId = userId;
        addSocket(userId, socket);
        // 온라인 사용자 목록 전체에 보내기
        io.emit('ONLINE_USERS', getOnlineUserIds());
        socket.join(`user:${userId}`);
        console.log(`[socket] user connected: ${userId}`); // 로그 추가

        // [핵심] chat.socket.js에 정의된 모든 이벤트를 등록
        chatSocket(io, socket); 

        socket.on('disconnect', (reason) => {
            removeSocket(userId);

            // 온라인 목록 갱신해서 전체에게 보내기
            io.emit('ONLINE_USERS',getOnlineUserIds());
            // [수정] 버전 A의 상세 로그 사용
            console.log(`[socket] user disconnected: ${userId} (${reason})`);
        });
    });

    return io;
}