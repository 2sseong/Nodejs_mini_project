// src/socketStore.js (ESM 방식)

//   최적의 자료구조: Map (Hash Map)을 사용하여 USER_ID를 Key로 O(1) 검색을 보장합니다.
// Key: String(USER_ID), Value: Socket.IO Socket Object
const userSocketMap = new Map();
let ioInstance = null; // Socket.IO Server 인스턴스를 저장

// --- 서버 인스턴스 관리 ---

/**
 * Socket.IO 서버 인스턴스를 저장합니다. (O(1))
 * @param {import('socket.io').Server} io - Socket.IO Server 인스턴스
 */
export function setIoInstance(io) {
    ioInstance = io;
}

/**
 * 저장된 Socket.IO 서버 인스턴스를 반환합니다. (O(1))
 * @returns {import('socket.io').Server | null}
 */
export function getIoInstance() {
    return ioInstance;
}

// --- 사용자 소켓 관리 (O(1) 로직) ---

/**
 * 사용자 ID와 소켓을 Map에 매핑합니다. (O(1))
 * @param {string} userId - 사용자 고유 ID
 * @param {import('socket.io').Socket} socket - 해당 사용자의 Socket 객체
 */
export function addSocket(userId, socket) {
    //   O(1) 삽입/업데이트
    userSocketMap.set(String(userId), socket);
    console.log(`[SocketStore] ? User ${userId} connected. Total online: ${userSocketMap.size}`);
}

/**
 * 사용자 ID를 통해 해당 소켓 객체를 O(1)에 검색하여 반환합니다. (O(1))
 * @param {string} userId - 사용자 고유 ID
 * @returns {import('socket.io').Socket | undefined}
 */
export function getSocketByUserId(userId) {
    //   O(1) 검색
    return userSocketMap.get(String(userId));
}

/**
 * 연결 해제 시 사용자 ID를 Map에서 제거합니다. (O(1))
 * @param {string} userId - 사용자 고유 ID
 */
export function removeSocket(userId) {
    //   O(1) 삭제
    const wasDeleted = userSocketMap.delete(String(userId));
    if (wasDeleted) {
        console.log(`[SocketStore] ??? User ${userId} disconnected. Total online: ${userSocketMap.size}`);
    }
}
