// src/lib/socket.js
import { io } from 'socket.io-client';

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

export function createSocket(userId) {
    if (!userId) return null;
    return io(SOCKET_URL, {
        withCredentials: true,
        query: { userId },
        transports: ['websocket', 'polling'],
        pingTimeout: 30000,
        pingInterval: 10000,
        reconnection: true,
        reconnectionAttempts: Infinity,
    });
}