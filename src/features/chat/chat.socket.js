import roomSocket from './rooms/room.socket.js';
import messageSocket from './messages/message.socket.js';

export default function chatSocket(io, socket) {
    // 1. 방 관련 소켓 핸들러 등록
    roomSocket(io, socket);

    // 2. 메시지 관련 소켓 핸들러 등록
    messageSocket(io, socket);
}