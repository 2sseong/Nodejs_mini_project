// client/src/hooks/chat/useSocketConnection.js
import { useState, useEffect } from 'react';
import { createSocket } from '../../lib/socket';

export function useSocketConnection(userId) {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        if (!userId) return;

        console.log('[useSocketConnection] Creating socket...');
        const newSocket = createSocket(userId);
        setSocket(newSocket);

        const onConnect = () => {
            console.log('[Socket] Connected');
            setConnected(true);
        };
        const onDisconnect = (reason) => {
            console.warn('[Socket] Disconnected:', reason);
            setConnected(false);
        };
        const onOnlineUsers = (list) => setOnlineUsers(list.map(String));

        newSocket.on('connect', onConnect);
        newSocket.on('disconnect', onDisconnect);
        newSocket.on('ONLINE_USERS', onOnlineUsers);

        return () => {
            console.log('[useSocketConnection] Cleaning up...');
            newSocket.disconnect();
            newSocket.off('connect', onConnect);
            newSocket.off('disconnect', onDisconnect);
            newSocket.off('ONLINE_USERS', onOnlineUsers);
        };
    }, [userId]);

    return { socket, connected, onlineUsers };
}