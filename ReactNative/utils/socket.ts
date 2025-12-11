import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

// 서버 URL (api/client.ts와 동일)
const SOCKET_URL = 'http://192.168.0.20:1337';

let socket: Socket | null = null;

export const createSocket = async (): Promise<Socket | null> => {
    try {
        const userDataStr = await SecureStore.getItemAsync('userData');
        if (!userDataStr) {
            console.log('[Socket] No user data found');
            return null;
        }

        const userData = JSON.parse(userDataStr);
        const userId = userData.userId;

        if (!userId) {
            console.log('[Socket] No userId found');
            return null;
        }

        // 이미 연결된 소켓이 있으면 재사용
        if (socket && socket.connected) {
            return socket;
        }

        console.log('[Socket] Creating new connection for user:', userId);

        socket = io(SOCKET_URL, {
            query: { userId },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            timeout: 20000,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
            console.log('[Socket] Connection error:', error.message);
        });

        return socket;
    } catch (error) {
        console.error('[Socket] Error creating socket:', error);
        return null;
    }
};

export const getSocket = (): Socket | null => {
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
