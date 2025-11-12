// pages/RoomPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  PanResponder,
  DeviceEventEmitter,
  NativeModules,
} from 'react-native';
import io from 'socket.io-client';
import { CHAT_CONTRACT as C } from '../constants/chatContract';

const { ChatWindowManager } = NativeModules;

/** 외부 보조창 오픈 (성공 시 true/false 반환) */
async function openExternalChat(roomId, roomName) {
  if (!ChatWindowManager?.open) return false;
  try {
    const ok = await ChatWindowManager.open(String(roomId), String(roomName || '채팅'));
    return !!ok;
  } catch {
    return false;
  }
}

/** ────────────── 간단 토스트 ────────────── */
const Toast = React.memo(({ msg, type }) => {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, type === 'error' ? styles.toastErr : styles.toastOk]}>
      <Text style={styles.toastTxt}>{msg}</Text>
    </View>
  );
});

/** ─────────────────────────────────────────────────────────
 * ChatRoomWindow(오버레이): 드래그/다중/포커스
 * 시간복잡도: 렌더 O(M), 드래그 O(1) per move
 * ───────────────────────────────────────────────────────── */
const ChatRoomWindow = React.memo(function ChatRoomWindow({
  roomId,
  roomName,
  userId,
  messages,
  connected,
  onSend,
  socket,
  initialPos,
  zIndex,
  onFocus,
  onClose,
}) {
  const [text, setText] = useState('');
  const [pos, setPos] = useState(initialPos || { x: 360, y: 80 });
  const offset = useRef({ x: pos.x, y: pos.y });

  // join + history (mount/unmount)
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit(C.events.joinRoom, { roomId });
    socket.emit(C.events.requestHistory, { roomId, limit: 50 });
    return () => {
      socket.emit(C.events.leaveRoom, { roomId });
    };
  }, [socket, roomId]);

  const handleSend = useCallback(() => {
    const v = text.trim();
    if (!v || !roomId || !connected) return;
    onSend(roomId, v); // O(1)
    setText('');
  }, [text, onSend, roomId, connected]);

  // Drag
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onFocus?.(); // 클릭 시 맨 앞으로
          offset.current = { x: pos.x, y: pos.y };
        },
        onPanResponderMove: (_, g) => {
          setPos({ x: offset.current.x + g.dx, y: offset.current.y + g.dy });
        },
      }),
    [pos, onFocus]
  );

  const Bubble = ({ m }) => {
    const mine = m.USER_ID === userId;
    const ts =
      m.TIMESTAMP instanceof Date
        ? m.TIMESTAMP.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '';
    return (
      <View style={mine ? wS.myRow : wS.otherRow}>
        <View style={[wS.wrap, { flexDirection: mine ? 'row-reverse' : 'row' }]}>
          <View>
            {!mine && <Text style={wS.nick}>{m.NICKNAME || m.USER_ID?.slice(0, 8)}</Text>}
            <View style={mine ? wS.my : wS.other}>
              <Text style={mine ? wS.myTxt : wS.otherTxt}>{m.TEXT}</Text>
            </View>
          </View>
          <View style={wS.time}>
            <Text style={mine ? wS.myTime : wS.otherTime}>{ts}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[wS.window, { left: pos.x, top: pos.y, zIndex }]}
      onStartShouldSetResponder={() => (onFocus?.(), false)}
    >
      {/* 헤더(드래그 핸들) */}
      <View style={wS.header} {...panResponder.panHandlers}>
        <Text style={wS.title} numberOfLines={1}>
          {roomName || `방 ${roomId}`}
        </Text>
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <TouchableOpacity onPress={onClose} style={wS.close}>
            <Text style={wS.closeTxt}>×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 메시지 */}
      <View style={wS.body}>
        <FlatList
          data={messages}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <Bubble m={item} />}
          contentContainerStyle={wS.listContent}
        />
      </View>

      {/* 입력 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={wS.inputRow}>
          <TextInput
            style={wS.input}
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
            style={[wS.send, (!connected || !text.trim()) && wS.sendDis]}
          >
            <Text style={wS.sendTxt}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

/** ────────────── RoomPage ────────────── */
export default function RoomPage() {
  const auth = global?.tempAuth;
  const userId = auth?.userId;
  const userNickname = auth?.userNickname;

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [status, setStatus] = useState({ msg: '', type: '' });

  // 다중 오버레이 창: {roomId, x, y, z}
  const [windows, setWindows] = useState([]);
  const topZ = useRef(10);

  // 외부창 오픈 확인: 네이티브 'ChatWindowOpened' 이벤트 못 받으면 폴백
  const externalOpenWait = useRef(new Map()); // roomId -> timeoutId

  // 외부창 이벤트 수신 (DeviceEventEmitter 사용)
  useEffect(() => {
    const onOpened = DeviceEventEmitter.addListener('ChatWindowOpened', (payload) => {
      const rid = String(payload?.roomId || '');
      const t = rid && externalOpenWait.current.get(rid);
      if (t) {
        clearTimeout(t);
        externalOpenWait.current.delete(rid);
      }
    });
    const onClosed = DeviceEventEmitter.addListener('ChatWindowClosed', () => {});
    return () => {
      onOpened.remove();
      onClosed.remove();
      for (const [, id] of externalOpenWait.current) clearTimeout(id);
      externalOpenWait.current.clear();
    };
  }, []);

  // 소켓 연결
  useEffect(() => {
    if (!userId) return;
    const s = io(C.url, {
      query: { userId },
      transports: ['websocket'],
      autoConnect: true,
      forceNew: true,
    });
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      setStatus({ msg: '서버에 연결되었습니다.', type: 'ok' });
      s.emit(C.events.fetchRooms);
    });

    s.on(C.events.roomsList, (serverRooms) => {
      const rs = (serverRooms || []).map((r) => C.normalize.room(r, C.fields)).filter(Boolean);
      setRooms(rs);
    });

    s.on(C.events.history, (array) => {
      const normalized = C.normalize.history(array, C.fields);
      const rid = String(array?.[0]?.[C.fields.message.roomId] || '');
      if (!rid) return;
      setMessagesByRoom((prev) => ({ ...prev, [rid]: normalized }));
      setStatus({ msg: '채팅 기록을 불러왔습니다.', type: 'ok' });
    });

    s.on(C.events.broadcastMessage, (raw) => {
      const msg = C.normalize.message(raw, C.fields);
      if (!msg) return;
      setMessagesByRoom((prev) => {
        const list = prev[msg.ROOM_ID] || [];
        return { ...prev, [msg.ROOM_ID]: [...list, msg] };
      });
    });

    s.on('disconnect', (reason) => {
      setConnected(false);
      setStatus({ msg: `연결 종료: ${reason}`, type: 'error' });
    });

    s.on('connect_error', (err) => {
      setConnected(false);
      setStatus({ msg: `연결 오류: ${err.message}`, type: 'error' });
    });

    return () => {
      s.removeAllListeners();
      s.close();
    };
  }, [userId]);

  /** 메시지 전송: O(1) */
  const sendMessage = useCallback(
    (roomId, text) => {
      if (!socket?.connected) {
        setStatus({ msg: '연결되지 않았습니다.', type: 'error' });
        return;
      }
      const temp = {
        id: 'temp-' + Date.now(),
        ROOM_ID: String(roomId),
        USER_ID: String(userId),
        TEXT: text,
        TIMESTAMP: new Date(),
        NICKNAME: userNickname,
      };
      setMessagesByRoom((prev) => ({ ...prev, [roomId]: [...(prev[roomId] || []), temp] }));

      socket.emit(
        C.events.sendMessage,
        {
          [C.fields.message.roomId]: roomId,
          [C.fields.message.text]: text,
          [C.fields.message.nickname]: userNickname,
        },
        (ack) => {
          if (!ack?.ok) setStatus({ msg: `전송 실패: ${ack?.error || 'ERROR'}`, type: 'error' });
        }
      );
    },
    [socket, userId, userNickname]
  );

  /** 방 클릭 → 외부창 우선, 실패/타임아웃시 오버레이 */
  const openRoom = useCallback(
    async (rid, title) => {
      const hasNative = typeof ChatWindowManager?.open === 'function';
      if (!hasNative) {
        openWindowForRoom(rid);
        return;
      }
      try {
        const tid = setTimeout(() => {
          if (externalOpenWait.current.has(rid)) {
            externalOpenWait.current.delete(rid);
            openWindowForRoom(rid);
          }
        }, 700); // 0.7s
        externalOpenWait.current.set(rid, tid);

        const ok = await openExternalChat(rid, title);
        if (ok === false) {
          // 즉시 실패 리턴 시 폴백
          const t = externalOpenWait.current.get(rid);
          if (t) clearTimeout(t);
          externalOpenWait.current.delete(rid);
          openWindowForRoom(rid);
        }
      } catch {
        const t = externalOpenWait.current.get(rid);
        if (t) clearTimeout(t);
        externalOpenWait.current.delete(rid);
        openWindowForRoom(rid);
      }
    },
    []
  );

  /** 오버레이 창 열기/포커스/닫기 — 각 O(N) (N=열린 창 수, 일반적으로 적음) */
  const openWindowForRoom = useCallback((roomId) => {
    setWindows((prev) => {
      const exists = prev.find((w) => String(w.roomId) === String(roomId));
      if (exists) {
        const newZ = ++topZ.current;
        return prev.map((w) => (w.roomId === roomId ? { ...w, z: newZ } : w));
      }
      const newZ = ++topZ.current;
      const offset = 60 * (prev.length % 6); // 계단식 배치
      return [...prev, { roomId, x: 360 + offset, y: 80 + offset, z: newZ }];
    });
  }, []);

  const focusWindow = useCallback((roomId) => {
    setWindows((prev) => {
      const newZ = ++topZ.current;
      return prev.map((w) => (w.roomId === roomId ? { ...w, z: newZ } : w));
    });
  }, []);

  const closeWindow = useCallback((roomId) => {
    setWindows((prev) => prev.filter((w) => w.roomId !== roomId));
  }, []);

  // 인증/로딩 가드
  if (!userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>로그인 정보가 없습니다. 로그인 페이지로 돌아가 주세요.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        {/* 좌측: 방 리스트 */}
        <View style={styles.sidebar}>
          <View style={styles.sbHeader}>
            <Text style={styles.sbTitle}>참여중인 채팅방</Text>
            <View style={styles.connRow}>
              <Text style={styles.connTxt}>연결:</Text>
              <Text style={[styles.connState, connected ? styles.on : styles.off]}>{connected ? 'ON' : 'OFF'}</Text>
              <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
            </View>
            <Text style={styles.meTxt}>
              사용자: <Text style={{ fontWeight: '800' }}>{userNickname}</Text>
            </Text>
          </View>

          <FlatList
            data={rooms}
            keyExtractor={(it) => String(it.ROOM_ID)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.roomItem, styles.roomInactive]}
                onPress={() => openRoom(String(item.ROOM_ID), String(item.ROOM_NAME || '채팅'))}
              >
                <Text numberOfLines={1} style={[styles.roomTxt, styles.gray]}>
                  {item.ROOM_NAME || `방 ${item.ROOM_ID}`}
                </Text>
                <View style={[styles.badge, styles.badgeIn]}>
                  <Text style={[styles.badgeTxt, styles.gray]}>{item.ROOM_TYPE === '1_TO_1' ? '1:1' : '그룹'}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTxt}>참여중인 방이 없습니다.</Text>
              </View>
            }
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        </View>

        {/* 우측: 빈 영역 (탑바/테두리 없음) */}
        <View style={styles.right} />
        <Toast msg={status.msg} type={status.type} />

        {/* 다중 오버레이 창 */}
        {windows.map((w) => {
          const msgs = (messagesByRoom[w.roomId] || [])
            .slice()
            .sort((a, b) => (a.TIMESTAMP?.valueOf?.() || 0) - (b.TIMESTAMP?.valueOf?.() || 0));
          const roomName = rooms.find((r) => String(r.ROOM_ID) === String(w.roomId))?.ROOM_NAME;
          return (
            <ChatRoomWindow
              key={w.roomId}
              roomId={w.roomId}
              roomName={roomName}
              userId={userId}
              messages={msgs}
              connected={connected}
              onSend={sendMessage}
              socket={socket}
              initialPos={{ x: w.x, y: w.y }}
              zIndex={w.z}
              onFocus={() => focusWindow(w.roomId)}
              onClose={() => closeWindow(w.roomId)}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/* ────────────── styles ────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  wrap: { flex: 1, flexDirection: 'row', maxWidth: 1200, alignSelf: 'center', width: '100%', backgroundColor: '#F3F4F6', overflow: 'visible' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sidebar: { width: 300, backgroundColor: '#fff', borderRightWidth: 0, padding: 14 },
  sbHeader: { marginBottom: 12, borderBottomWidth: 0, paddingBottom: 10 },
  sbTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 6 },
  connRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  connTxt: { fontSize: 12, color: '#6B7280' },
  connState: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  on: { color: '#10B981' },
  off: { color: '#EF4444' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  dotOn: { backgroundColor: '#10B981' },
  dotOff: { backgroundColor: '#EF4444' },
  meTxt: { fontSize: 12, color: '#4B5563', marginTop: 2 },

  roomItem: { padding: 12, borderRadius: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomInactive: { backgroundColor: '#fff' },
  roomTxt: { fontSize: 14, fontWeight: '700', flexShrink: 1, marginRight: 8 },
  gray: { color: '#374151' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeIn: { backgroundColor: '#E5E7EB' },
  badgeTxt: { fontSize: 10 },

  right: { flex: 1 },

  toast: { position: 'absolute', top: 0, left: 0, right: 0, padding: 10, alignItems: 'center', zIndex: 9999 },
  toastOk: { backgroundColor: '#10B981' },
  toastErr: { backgroundColor: '#EF4444' },
  toastTxt: { color: '#fff', fontWeight: '700' },

  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyTxt: { color: '#6B7280' },
});

/* 오버레이 창 스타일 */
const wS = StyleSheet.create({
  window: {
    position: 'absolute',
    width: 520,
    height: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: '800', color: '#111827', maxWidth: 360 },
  close: { width: 32, height: 28, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 18, color: '#111827', lineHeight: 18 },

  body: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  listContent: { paddingBottom: 8 },

  myRow: { alignItems: 'flex-end', marginBottom: 10 },
  otherRow: { alignItems: 'flex-start', marginBottom: 10 },
  wrap: { maxWidth: '80%', flexDirection: 'row', alignItems: 'flex-end' },
  time: { marginHorizontal: 5, marginBottom: 5, justifyContent: 'flex-end' },

  my: { backgroundColor: '#4F46E5', padding: 10, borderRadius: 15, borderTopRightRadius: 3 },
  other: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEE', padding: 10, borderRadius: 15, borderTopLeftRadius: 3 },

  myTxt: { color: '#fff', fontSize: 14 },
  otherTxt: { color: '#111827', fontSize: 14 },
  nick: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2, marginLeft: 10 },

  myTime: { color: '#A5B4FC', fontSize: 10 },
  otherTime: { color: '#9CA3AF', fontSize: 10 },

  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  input: { flex: 1, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, marginRight: 8, fontSize: 16 },
  send: { width: 64, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  sendDis: { backgroundColor: '#A5B4FC' },
  sendTxt: { color: '#fff', fontWeight: '700' },
});
