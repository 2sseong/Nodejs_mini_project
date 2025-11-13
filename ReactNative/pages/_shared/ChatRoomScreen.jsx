import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, StyleSheet
} from 'react-native';
import { CHAT_CONTRACT as C } from '../../constants/chatContract';
import { chatSocket } from '../../constants/chatSocket';

/**
 * 공용 채팅 컴포넌트
 * props:
 *  - roomId: string (필수)
 *  - floating?: boolean (외부창/오버레이 스타일일 때 true)
 *  - roomTitle?: string (선택, 헤더 표시용)
 */
export default function ChatRoomScreen({ roomId, roomTitle, floating }) {
  const userId = global?.tempAuth?.userId;
  const userNickname = global?.tempAuth?.userNickname;

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(chatSocket.isConnected());
  const [text, setText] = useState('');
  const listRef = useRef(null);

  // 소켓 연결 확보
  useEffect(() => {
    const s = chatSocket.connect();
    if (!s) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // 방 참가 + 히스토리
    if (roomId) {
      s.emit(C.events.joinRoom, { roomId });
      s.emit(C.events.requestHistory, { roomId, limit: 50 });
    }

    // 히스토리 응답(배열)
    const onHistory = (arr) => {
      const normalized = C.normalize.history(arr, C.fields);
      // 같은 roomId인지 확인 (서버 응답에 ROOM_ID가 들어옴)
      const rid = String(arr?.[0]?.[C.fields.message.roomId] || roomId || '');
      if (!rid || String(rid) !== String(roomId)) return;
      setMessages(normalized);
    };

    // 새 메시지
    const onMessage = (raw) => {
      const m = C.normalize.message(raw, C.fields);
      if (!m || String(m.ROOM_ID) !== String(roomId)) return;
      setMessages((prev) => [...prev, m]);
    };

    s.on(C.events.history, onHistory);
    s.on(C.events.broadcastMessage, onMessage);

    return () => {
      // 방 이탈 + 리스너 해제
      if (roomId) s.emit(C.events.leaveRoom, { roomId });
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off(C.events.history, onHistory);
      s.off(C.events.broadcastMessage, onMessage);
    };
  }, [roomId]);

  // 리스트 자동 스크롤
  useEffect(() => {
    if (listRef.current && messages.length) {
      setTimeout(() => listRef.current.scrollToEnd({ animated: true }), 60);
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const v = text.trim();
    if (!v || !connected || !roomId) return;

    // Optimistic
    const temp = {
      id: 'temp-' + Date.now(),
      ROOM_ID: String(roomId),
      USER_ID: String(userId),
      TEXT: v,
      TIMESTAMP: new Date(),
      NICKNAME: userNickname,
    };
    setMessages((prev) => [...prev, temp]);

    chatSocket.emit(
      C.events.sendMessage,
      {
        [C.fields.message.roomId]: roomId,
        [C.fields.message.text]: v,
        [C.fields.message.nickname]: userNickname,
      },
      (ack) => {
        if (!ack?.ok) {
          // 실패 시(네트워크/서버) → 낙관적 메시지 롤백까지 원하면 여기 추가
        }
      }
    );
    setText('');
  }, [text, connected, roomId, userId, userNickname]);

  const Bubble = ({ m }) => {
    const mine = m.USER_ID === userId;
    const ts =
      m.TIMESTAMP instanceof Date
        ? m.TIMESTAMP.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '';
    return (
      <View style={mine ? s.myRow : s.otherRow}>
        <View style={[s.wrap, { flexDirection: mine ? 'row-reverse' : 'row' }]}>
          <View>
            {!mine && <Text style={s.nick}>{m.NICKNAME || m.USER_ID?.slice(0, 8)}</Text>}
            <View style={mine ? s.my : s.other}>
              <Text style={mine ? s.myTxt : s.otherTxt}>{m.TEXT}</Text>
            </View>
          </View>
          <View style={s.time}><Text style={mine ? s.myTime : s.otherTime}>{ts}</Text></View>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, floating && s.floating]}>
      {/* 헤더(외부창/오버레이에서도 깔끔하도록 최소) */}
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>
          {roomTitle || `채팅방 ${roomId}`}
        </Text>
        <View style={s.connDotWrap}>
          <View style={[s.connDot, connected ? s.on : s.off]} />
        </View>
      </View>

      {/* 메시지 */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <Bubble m={item} />}
        contentContainerStyle={s.listContent}
        style={{ flex: 1 }}
      />

      {/* 입력 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder={connected ? '메시지 입력…' : '연결 대기 중…'}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={connected}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!connected || !text.trim()}
            style={[s.send, (!connected || !text.trim()) && s.sendDis]}
          >
            <Text style={s.sendTxt}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  floating: { borderRadius: 12, overflow: 'hidden' },

  header: { height: 44, paddingHorizontal: 12, backgroundColor: '#F9FAFB', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 14, fontWeight: '800', color: '#111827', maxWidth: '80%' },
  connDotWrap: { padding: 8 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  on: { backgroundColor: '#10B981' },
  off: { backgroundColor: '#EF4444' },

  listContent: { padding: 10 },

  myRow: { alignItems: 'flex-end', marginBottom: 10 },
  otherRow: { alignItems: 'flex-start', marginBottom: 10 },
  wrap: { maxWidth: '80%', flexDirection: 'row', alignItems: 'flex-end' },
  time: { marginHorizontal: 6, marginBottom: 5, justifyContent: 'flex-end' },

  my: { backgroundColor: '#4F46E5', padding: 10, borderRadius: 15, borderTopRightRadius: 3 },
  other: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEE', padding: 10, borderRadius: 15, borderTopLeftRadius: 3 },

  myTxt: { color: '#fff', fontSize: 14 },
  otherTxt: { color: '#111827', fontSize: 14 },
  nick: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2, marginLeft: 10 },

  myTime: { color: '#A5B4FC', fontSize: 10 },
  otherTime: { color: '#9CA3AF', fontSize: 10 },

  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
  input: { flex: 1, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, marginRight: 8, fontSize: 16 },
  send: { width: 64, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  sendDis: { backgroundColor: '#A5B4FC' },
  sendTxt: { color: '#fff', fontWeight: '700' },
});
