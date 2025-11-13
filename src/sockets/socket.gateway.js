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
    io.to(`user:${userId}`).emit('rooms:fetch', { userId, authToken: null });
}

export default {
    notifyRoomCreatedToUser,
    requestRoomsRefresh,
};