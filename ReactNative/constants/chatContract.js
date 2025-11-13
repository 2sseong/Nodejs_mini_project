// constants/chatContract.js
import { Platform } from 'react-native';

// 네가 올린 로그인 페이지의 BACKEND_URL과 동일하게 사용
export const BACKEND_URL =
  Platform.OS === 'android'
    ? 'http://192.168.0.5:1337' // 에뮬레이터도 같은 IP면 OK
    : 'http://192.168.0.5:1337'; // RNW 데스크톱

export const CHAT_CONTRACT = {
  url: BACKEND_URL,

  // 백엔드 socket.js에서 확정된 이벤트명
  events: {
    fetchRooms: 'rooms:fetch',
    roomsList: 'rooms:list',
    joinRoom: 'room:join',
    leaveRoom: 'room:leave',
    requestHistory: 'chat:get_history',
    history: 'chat:history', // 서버는 "배열"만 내려줌
    sendMessage: 'chat:message',
    broadcastMessage: 'chat:message',
  },

  // 오라클 컬럼명 매핑
  fields: {
    room: {
      id: 'ROOM_ID',
      name: 'ROOM_NAME',
      type: 'ROOM_TYPE', // 'GROUP' | '1_TO_1'
    },
    message: {
      id: 'MSG_ID',
      roomId: 'ROOM_ID',
      userId: 'SENDER_ID', // 서버는 SENDER_ID로 내려줌
      text: 'CONTENT',
      sentAt: 'SENT_AT',
      nickname: 'NICKNAME', // socket.js에서 그대로 실어줌(선택)
    },
  },

  normalize: {
    room(raw, F) {
      if (!raw) return null;
      return {
        ROOM_ID: String(raw[F.room.id]),
        ROOM_NAME: raw[F.room.name] == null ? '' : String(raw[F.room.name]),
        ROOM_TYPE: raw[F.room.type] == null ? 'GROUP' : String(raw[F.room.type]),
      };
    },
    message(raw, F) {
      if (!raw) return null;
      const sent = raw[F.message.sentAt];
      const ts = sent instanceof Date ? sent : sent ? new Date(sent) : new Date();
      return {
        id: String(raw[F.message.id]),
        ROOM_ID: String(raw[F.message.roomId]),
        USER_ID: String(raw[F.message.userId]), // 프론트 내부 표준 키로 통일
        TEXT: raw[F.message.text] == null ? '' : String(raw[F.message.text]),
        TIMESTAMP: ts,
        NICKNAME: raw[F.message.nickname] ? String(raw[F.message.nickname]) : undefined,
      };
    },
    history(arrayOrPayload, F) {
      // 서버는 배열만 내려주므로 arrayOrPayload는 배열
      const arr = Array.isArray(arrayOrPayload) ? arrayOrPayload : [];
      return arr
        .map((x) => CHAT_CONTRACT.normalize.message(x, F))
        .filter(Boolean)
        .sort((a, b) => a.TIMESTAMP - b.TIMESTAMP);
    },
  },
};
