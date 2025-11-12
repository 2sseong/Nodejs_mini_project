// constants/chatSocket.js
import io from 'socket.io-client';
import { CHAT_CONTRACT as C } from './chatContract';

// 싱글톤 소켓. .connect()를 여러번 호출해도 실제 연결은 1개만 유지
class ChatSocket {
  _socket = null;
  _connected = false;

  connect() {
    if (this._socket?.connected) return this._socket;
    const userId = global?.tempAuth?.userId;
    if (!userId) return null;

    this._socket = io(C.url, {
      query: { userId },
      transports: ['websocket'],
      autoConnect: true,
      forceNew: false, // 기존 연결 재사용
    });

    this._socket.on('connect', () => { this._connected = true; });
    this._socket.on('disconnect', () => { this._connected = false; });

    return this._socket;
  }

  socket() {
    return this._socket ?? this.connect();
  }

  isConnected() {
    return !!this._socket?.connected;
  }

  on(evt, handler) {
    this.socket()?.on(evt, handler);
  }
  off(evt, handler) {
    this.socket()?.off(evt, handler);
  }

  emit(evt, data, ack) {
    this.socket()?.emit(evt, data, ack);
  }
}

export const chatSocket = new ChatSocket();
