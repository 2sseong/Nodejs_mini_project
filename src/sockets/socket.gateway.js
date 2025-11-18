import { getIoInstance } from './socketStore.js';

function _io() { return getIoInstance(); }

// 방 생성 알림(생성자에게만)
function notifyRoomCreatedToUser(userId, payload) {
    const io = _io();
    if (!io) return;
    io.to(`user:${userId}`).emit('room:new_created', payload);
}

// 초대된 사용자에게 방 목록 갱신 요청
function requestRoomsRefresh(userId) {
    const io = _io();
    if (!io) return;
    
    // 수정: 'rooms:fetch' -> 'rooms:refresh'
    // 'rooms:fetch'는 클라이언트가 요청하는 이벤트이므로, 
    // 서버는 'rooms:refresh'라는 새로운 이벤트를 보내야 합니다.
    io.to(`user:${userId}`).emit('rooms:refresh');
    console.log(`[Gateway] Sent 'rooms:refresh' to user: ${userId}`);
}

export default {
    notifyRoomCreatedToUser,
    requestRoomsRefresh,
};