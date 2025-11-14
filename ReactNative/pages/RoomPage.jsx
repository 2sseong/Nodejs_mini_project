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
  Dimensions, // [추가] Dimensions
} from 'react-native';
import io from 'socket.io-client';
import { CHAT_CONTRACT as C } from '../constants/chatContract';
import * as DocumentPicker from '@react-native-documents/picker';
// import RNFS from 'react-native-fs'; // 파일 데이터를 읽기 위해 필요(windows에서는 제공안해줌)

// [추가] 네이티브 모듈 없이 로컬 파일을 Base64로 읽는 함수 (Windows 환경 대응)
const readFileAsBase64 = async (uri) => {
    // 1. fetch API를 사용하여 로컬 파일 URI를 Blob 형태로 가져옵니다.
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // 2. Blob을 ArrayBuffer로 변환합니다.
    const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(blob);
    });

    // 3. ArrayBuffer를 Base64 문자열로 변환합니다.
    // React Native 환경에서는 Buffer나 atob/btoa가 완벽하게 지원되지 않을 수 있으므로,
    // ArrayBuffer를 8비트 정수 배열로 변환 후 Base64 인코딩을 수행합니다.
    // 하지만 대부분의 최신 RN 환경에서는 FileReader + btoa/Buffer가 작동합니다.
    
    // 이 예시에서는 FileReader와 React Native 환경의 BtoA 지원을 가정합니다.
    // 만약 Base64 변환 오류가 발생하면, 'Base64 Polyfill'을 추가해야 합니다.
    const base64String = Buffer.from(arrayBuffer).toString('base64');
    return base64String;
};


// [추가] 반응형 및 최소 크기 상수
const NARROW_BREAKPOINT = 768; // 이 너비 미만은 '좁은 화면'으로 간주
const MIN_WINDOW_WIDTH = 640;  // 앱의 최소 너비
const MIN_WINDOW_HEIGHT = 480; // 앱의 최소 높이

/** ────────────── 토스트 (변경 없음) ────────────── */
const Toast = React.memo(({ msg, type }) => {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, type === 'error' ? styles.toastErr : styles.toastOk]}>
      <Text style={styles.toastTxt}>{msg}</Text>
    </View>
  );
});

/** ────────────── 말풍선 (수정됨) ────────────── */
const Bubble = React.memo(function Bubble({ m, userId, compact }) {
  const mine = m.USER_ID === userId;
  const isFile = m.MESSAGE_TYPE === 'FILE'; // [추가] 파일 메시지 여부
  const isSystem = m.MESSAGE_TYPE === 'SYSTEM'; // 시스템 메시지 (선택 사항)

  // 파일 다운로드 핸들러
  const handleDownload = useCallback(() => {
    if (!m.FILE_URL || m.FILE_URL === 'PENDING') {
      alert('파일 다운로드 준비 중이거나 URL이 유효하지 않습니다.');
      return;
    }
    // 실제 다운로드 로직 구현 필요
    // React Native for Windows (RNFS)를 사용한 다운로드 로직을 여기에 구현합니다.
    // 예시: RNFS.downloadFile({ fromUrl: m.FILE_URL, toFile: RNFS.DocumentDirectoryPath + '/' + m.FILE_NAME }).promise...
    alert(`[다운로드 시작] 파일: ${m.FILE_NAME}\nURL: ${m.FILE_URL}`);
  }, [m.FILE_URL, m.FILE_NAME]);

  // 시스템 메시지 렌더링
  if (isSystem) {
    return (
      <View style={wS.systemRow}>
        <Text style={wS.systemTxt}>{m.CONTENT || m.TEXT}</Text>
      </View>
    );
  }

  const ts =
    m.SENT_AT instanceof Date
      ? m.SENT_AT.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';
  
  // 파일 메시지 스타일 조정
  const bubbleStyle = [
    mine ? wS.my : wS.other,
    compact && (mine ? wS.myCompact : wS.otherCompact),
    isFile && wS.fileBubble, // [추가] 파일 메시지 스타일
  ];

  return (
    <View style={mine ? wS.myRow : wS.otherRow}>
      <View style={[wS.wrap, { flexDirection: mine ? 'row-reverse' : 'row' }]}>
        <View>
          {!mine && !compact && (
            <Text style={wS.nick}>{m.NICKNAME || m.USER_ID?.slice(0, 8)}</Text>
          )}
          <View style={bubbleStyle}>
            {isFile ? (
              // [추가] 파일 메시지 컨텐츠
              <View>
                <Text style={wS.fileIcon}>📄</Text>
                <Text style={wS.fileNameTxt} numberOfLines={2}>
                  {m.FILE_NAME}
                </Text>
                <TouchableOpacity onPress={handleDownload} style={wS.downloadBtn}>
                  <Text style={wS.downloadTxt}>다운로드</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // 기존 텍스트 메시지 컨텐츠
              <Text style={[mine ? wS.myTxt : wS.otherTxt, compact && wS.msgTxtCompact]}>
                {m.CONTENT || m.TEXT} {/* CONTENT 필드 사용 (DB 필드에 맞춤) */}
              </Text>
            )}
          </View>
        </View>
        {!compact && (
          <View style={wS.time}>
            <Text style={mine ? wS.myTime : wS.otherTime}>{ts}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

/** ─────────────────────────────────────────────────────────
 * ChatRoomScreen (수정됨)
 * - 'isNarrow' prop을 받아 좁은 화면/넓은 화면용 닫기 버튼을 구분
 * ───────────────────────────────────────────────────────── */
const ChatRoomScreen = React.memo(function ChatRoomScreen({
  roomId, roomName, userId, messages, connected, onSend, socket,
  onClose,
  onPressPlus,
  isNarrow, // [추가] 반응형 레이아웃 여부
}) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const compact = layout.w < 420 || layout.h < 420;

  // join + history (변경 없음)
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit(C.events.joinRoom, { roomId });
    socket.emit(C.events.requestHistory, { roomId, limit: 50 });
    return () => socket.emit(C.events.leaveRoom, { roomId });
  }, [socket, roomId]);

  // 자동 스크롤 (변경 없음)
  useEffect(() => {
    if (!listRef.current) return;
    const t = setTimeout(() => { try { listRef.current.scrollToEnd({ animated: true }); } catch {} }, 0);
    return () => clearTimeout(t);
  }, [messages?.length]);

  // 메시지 전송 (변경 없음)
  const handleSend = useCallback(() => {
    const v = text.trim();
    if (!v || !roomId || !connected) return;
    onSend(roomId, v);
    setText('');
  }, [text, onSend, roomId, connected]);

  return (
    <View
      style={[
        wS.window,
        { flex: 1 }, // 부모(SafeAreaView 또는 styles.right)를 꽉 채움
        // [수정] 넓은 화면(isNarrow: false)일 때만 오른쪽 경계선 표시
        !isNarrow && styles.chatRoomBorder,
      ]}
      onLayout={(e) => setLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* 헤더 */}
      <View style={[wS.header, compact && wS.headerCompact]}>
        <View style={[wS.headerLeft, compact && wS.headerLeftCompact]}>
          <Text style={[wS.title, compact && wS.titleCompact]} numberOfLines={1}>
            {roomName || `방 ${roomId}`}
          </Text>
        </View>

        {/* [수정] 닫기/뒤로가기 버튼 (반응형) */}
        <View style={wS.headerRight}>
          <TouchableOpacity
            onPress={onClose}
            style={[wS.close, compact && wS.headerBtnCompact]}
            accessibilityLabel={isNarrow ? "목록으로 돌아가기" : "채팅창 닫기"}
          >
            {/* 좁으면 'ᐸ'(뒤로가기), 넓으면 '×'(닫기) */}
            <Text style={[wS.closeTxt, compact && wS.headerBtnTxtCompact]}>
              {isNarrow ? 'ᐸ' : '×'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 메시지 (변경 없음) */}
      <View style={[wS.body, compact && wS.bodyCompact]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(it) => String(it.id ?? `${it.ROOM_ID}-${it.TIMESTAMP?.valueOf?.() ?? Math.random()}`)}
          renderItem={({ item }) => <Bubble m={item} userId={userId} compact={compact} />}
          contentContainerStyle={[wS.listContent, compact && wS.listContentCompact]}
          removeClippedSubviews
          initialNumToRender={20}
          windowSize={7}
        />
      </View>

      {/* 입력 (변경 없음) */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[wS.inputRow, compact && wS.inputRowCompact]}>
            {/* [추가] 파일 선택 버튼 */}
            <TouchableOpacity
                onPress={onPressPlus} // 2. 새로운 prop 추가
                style={[wS.plusBtn, compact && wS.headerBtnCompact]}
                accessibilityLabel="파일 전송"
            >
                <Text style={wS.plusBtnTxt}>+</Text>
            </TouchableOpacity>
          <TextInput
            style={[wS.input, compact && wS.inputCompact]}
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
            style={[wS.send, (!connected || !text.trim()) && wS.sendDis, compact && wS.sendCompact]}
          >
            <Text style={[wS.sendTxt, compact && wS.sendTxtCompact]}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
});

/** ─────────────────────────────────────────────────────────
 * [신규] ChatListComponent (모듈화)
 * - 기존 RoomPage에 있던 사이드바 로직을 분리
 * ───────────────────────────────────────────────────────── */
const ChatListComponent = React.memo(({
  rooms,
  connected,
  userNickname,
  onOpenRoom,
  activeRoomId, // [추가] 넓은 화면에서 활성 채팅방 강조용
  isNarrow,     // [추가] 좁은 화면인지 여부
}) => {
  return (
    <View style={[styles.sidebar, isNarrow && { width: '100%', borderRightWidth: 0 }]}>
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
        renderItem={({ item }) => {
          const isActive = !isNarrow && String(item.ROOM_ID) === activeRoomId;
          return (
            <TouchableOpacity
              style={[
                styles.roomItem,
                // [수정] 활성화된 아이템 강조 (넓은 화면에서만)
                isActive ? styles.roomActive : styles.roomInactive,
              ]}
              onPress={() => onOpenRoom(String(item.ROOM_ID))}
            >
              <Text numberOfLines={1} style={[styles.roomTxt, isActive ? styles.white : styles.gray]}>
                {item.ROOM_NAME || `방 ${item.ROOM_ID}`}
              </Text>
              <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeIn]}>
                <Text style={[styles.badgeTxt, isActive ? styles.white : styles.gray]}>
                  {item.ROOM_TYPE === '1_TO_1' ? '1:1' : '그룹'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>참여중인 방이 없습니다.</Text>
          </View>
        }
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 12 }}
      />
    </View>
  );
});


/** ─────────────────────────────────────────────────────────
 * RoomPage (수정됨)
 * - 반응형 레이아웃 로직 추가
 * ───────────────────────────────────────────────────────── */
export default function RoomPage() {
  const auth = global?.tempAuth;
  const userId = auth?.userId;
  const userNickname = auth?.userNickname;

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [status, setStatus] = useState({ msg: '', type: '' });

  const [activeRoomId, setActiveRoomId] = useState(null);

  /** ────────────── 파일 메시지 전송 함수 (수정됨) ────────────── */
const sendFileMessage = useCallback((roomId, fileName, mimeType, fileData) => {
    if (!socket?.connected) {
        setStatus({ msg: '연결되지 않았습니다.', type: 'error' });
        return;
    }
    const tempId = 'temp-' + Date.now(); // 임시 ID 생성 (응답 후 교체될 예정)

    // 로컬에 임시 메시지 추가 (UX를 위해)
    const temp = { 
        id: tempId, // 임시 ID 사용
        ROOM_ID: String(roomId),
        USER_ID: String(userId),
        NICKNAME: userNickname,
        CONTENT: `[전송 중...] ${fileName}`, // 임시 텍스트
        MESSAGE_TYPE: 'FILE', // 파일 타입 명시
        SENT_AT: new Date(),
        // 임시 파일 메타데이터
        FILE_NAME: fileName,
        FILE_URL: 'PENDING', // 전송 중 상태 표시
    };
    setMessagesByRoom((prev) => ({ ...prev, [roomId]: [...(prev[roomId] || []), temp] }));

    // 서버로 전송할 페이로드 (Base64 인코딩된 데이터 포함)
    const payload = {
        [C.fields.message.roomId]: roomId,
        [C.fields.message.type]: 'FILE', // 서버에서 MESSAGE_TYPE으로 사용됨
        [C.fields.message.content]: fileName, // CONTENT 필드에 파일 이름을 임시로 전달
        file_name: fileName,
        mime_type: mimeType,
        file_data: fileData, // Base64 인코딩된 파일 내용
        [C.fields.message.nickname]: userNickname,
    };

    socket.emit(C.events.sendMessage, payload, (ack) => {
        if (!ack?.ok || !ack.message) {
            setStatus({ msg: `파일 전송 실패: ${ack?.error || 'ERROR'}`, type: 'error' });
            // 실패 시 임시 메시지 제거 또는 오류 표시
            setMessagesByRoom((prev) => ({ 
                ...prev, 
                [roomId]: prev[roomId].filter(m => m.id !== tempId) 
            }));
            return;
        }

        // 서버 응답이 성공하면, 임시 메시지를 서버 데이터로 대체
        const serverMsg = C.normalize.message(ack.message, C.fields);
        setMessagesByRoom((prev) => ({
            ...prev, 
            [roomId]: prev[roomId].map(m => m.id === tempId ? serverMsg : m)
        }));
    });

}, [socket, userId, userNickname]); 

  // [추가] 창 크기 상태
  const [windowSize, setWindowSize] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });

  // [추가] 좁은 화면 여부
  const isNarrow = windowSize.width < NARROW_BREAKPOINT;

  // ... (소켓 연결 useEffect - 변경 없음) ...
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


  /** 메시지 전송 (변경 없음) */
  const sendMessage = useCallback(/* ... */ (roomId, text) => {
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
    }, [socket, userId, userNickname]);


  /** [추가] 파일 메시지 전송 */
  const handlePickFile = useCallback(async () => {
    try {
        const res = await DocumentPicker.pick({
            type: [DocumentPicker.types.allFiles],
        });

        const file = res[0];

        // 1. 파일 데이터 읽기 (Node.js/WebSocket 전송을 위해 Base64 인코딩)
        const fileData = await readFileAsBase64(file.uri);

        // 2. 서버로 파일 정보 및 데이터 전송
        // 이 로직은 sendMessage와 유사하게 socket.emit으로 분리되어야 합니다.
        sendFileMessage(activeRoomId, file.name, file.type, fileData);

    } catch (err) {
        if (DocumentPicker.isCancel(err)) {
            // 사용자가 취소했을 경우
        } else {
            setStatus({ msg: `파일 선택 오류: ${err.message}`, type: 'error' });
        }
    }
  }, [activeRoomId, sendFileMessage, setStatus]);

  /** 방 클릭 (변경 없음) */
  const openRoom = useCallback((rid) => {
    setActiveRoomId(String(rid));
  }, []);

  /** [수정] 채팅방 닫기 (넓은/좁은 화면 공용) */
  const closeActiveRoom = useCallback(() => {
    setActiveRoomId(null);
  }, []);

  // [추가] 레이아웃 변경 핸들러
  const handleRootLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setWindowSize({ width, height });
  }, []);

  // [추가] O(N) -> O(1) 조회 최적화 (useMemo)
  const activeRoomData = useMemo(() => {
    if (!activeRoomId) return null;

    const msgs = (messagesByRoom[activeRoomId] || [])
      .slice()
      .sort((a, b) => (a.TIMESTAMP?.valueOf?.() || 0) - (b.TIMESTAMP?.valueOf?.() || 0));
    
    // O(N) (N=rooms.length) 이지만, activeRoomId가 바뀔 때만 실행됨
    const roomName = rooms.find((r) => String(r.ROOM_ID) === String(activeRoomId))?.ROOM_NAME;

    return { msgs, roomName };
  }, [activeRoomId, messagesByRoom, rooms]);


  // 인증/로딩 가드 (변경 없음)
  if (!userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>로그인 정보가 없습니다. 로그인 페이지로 돌아가 주세요.</Text>
      </View>
    );
  }
  
  /** ──────────────────
   * [수정] 반응형 렌더링
   * ────────────────── */
  const renderContent = () => {
    // 1. 좁은 화면 (모바일/태블릿 세로)
    if (isNarrow) {
      if (activeRoomId && activeRoomData) {
        // 1-1. 좁은 화면 + 채팅방 선택됨
        return (
          <ChatRoomScreen
            key={activeRoomId}
            roomId={activeRoomId}
            onPressPlus={handlePickFile}
            roomName={activeRoomData.roomName}
            userId={userId}
            messages={activeRoomData.msgs}
            connected={connected}
            onSend={sendMessage}
            socket={socket}
            onClose={closeActiveRoom}
            isNarrow={true}
          />
        );
      }
      // 1-2. 좁은 화면 + 채팅방 미선택 (목록)
      return (
        <ChatListComponent
          rooms={rooms}
          connected={connected}
          userNickname={userNickname}
          onOpenRoom={openRoom}
          activeRoomId={activeRoomId}
          isNarrow={true}
        />
      );
    }

    // 2. 넓은 화면 (PC)
    return (
      <View style={styles.wrap}>
        {/* 2-1. 좌측 사이드바 (고정) */}
        <ChatListComponent
          rooms={rooms}
          connected={connected}
          userNickname={userNickname}
          onOpenRoom={openRoom}
          activeRoomId={activeRoomId}
          isNarrow={false}
        />

        {/* 2-2. 우측 컨텐츠 영역 (선택에 따라 변경) */}
        <View style={styles.right}>
          {activeRoomId && activeRoomData ? (
            // 채팅방 선택됨
            <ChatRoomScreen
              key={activeRoomId}
              roomId={activeRoomId}
              roomName={activeRoomData.roomName}
              onPressPlus={handlePickFile}
              userId={userId}
              messages={activeRoomData.msgs}
              connected={connected}
              onSend={sendMessage}
              socket={socket}
              onClose={closeActiveRoom}
              isNarrow={false}
            />
          ) : (
            // 채팅방 미선택 (빈 화면)
            <View style={[styles.center, { backgroundColor: '#F9FAFB' }]}>
              <Text style={styles.emptyTxt}>채팅방을 선택하세요.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.safe}
      onLayout={handleRootLayout} // [추가] 레이아웃 변경 감지
    >
      {renderContent()}
      <Toast msg={status.msg} type={status.type} />
    </SafeAreaView>
  );
}

/* ────────────── styles (수정됨) ────────────── */
const styles = StyleSheet.create({
  // [수정] 최소 너비/높이 적용
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
  },
  systemRow: { 
    alignItems: 'center', 
    marginVertical: 10 
},
  systemTxt: { 
    fontSize: 12, 
    color: '#9CA3AF', 
    backgroundColor: '#E5E7EB', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12 
},

  // [추가] 파일 메시지 스타일
  fileBubble: { 
    padding: 12, 
    minWidth: 160, 
    borderWidth: 1, 
    borderColor: '#D1D5DB' 
},
  fileIcon: { 
    fontSize: 24, 
    marginBottom: 4 
},
  fileNameTxt: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#1F2937', 
    marginBottom: 6 
},
  downloadBtn: { 
    backgroundColor: '#4F46E5', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8, 
    marginTop: 4 
},
  downloadTxt: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    fontWeight: '700', 
    textAlign: 'center' 
},
  wrap: { flex: 1, flexDirection: 'row', maxWidth: 1200, alignSelf: 'center', width: '100%', backgroundColor: '#F3F4F6', overflow: 'hidden' /* [수정] */ },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sidebar: { width: 300, backgroundColor: '#fff', borderRightWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  sbHeader: { marginBottom: 12, borderBottomWidth: 1, borderColor: '#F3F4F6', paddingBottom: 10 }, // [수정] 구분선
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

  // [제거] arrBtn* (정렬 버튼 제거됨)

  roomItem: { padding: 12, borderRadius: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomInactive: { backgroundColor: '#F9FAFB' /* [수정] 비활성 색 */ },
  // [추가] 활성 채팅방 스타일
  roomActive: { backgroundColor: '#4F46E5' },
  roomTxt: { fontSize: 14, fontWeight: '700', flexShrink: 1, marginRight: 8 },
  gray: { color: '#374151' },
  white: { color: '#FFFFFF' }, // [추가]
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeIn: { backgroundColor: '#E5E7EB' },
  badgeActive: { backgroundColor: '#4338CA' }, // [추가]
  badgeTxt: { fontSize: 10 },

  right: { flex: 1, overflow: 'hidden' }, // [수정]
  // [추가] 채팅방 컨테이너 경계선
  chatRoomBorder: {
    borderLeftWidth: 1,
    borderColor: '#E5E7EB',
  },

  toast: { position: 'absolute', top: 0, left: 0, right: 0, padding: 10, alignItems: 'center', zIndex: 9999 },
  toastOk: { backgroundColor: '#10B981' },
  toastErr: { backgroundColor: '#EF4444' },
  toastTxt: { color: '#fff', fontWeight: '700' },

  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyTxt: { color: '#6B7280' },

  // [제거] dock 스타일
});

/* 오버레이 창 스타일 (wS) (수정됨) */
const wS = StyleSheet.create({
  window: {
    // [제거] position: 'absolute' 및 그림자/borderRadius
    backgroundColor: '#FFFFFF',
  },
  plusBtn: { width: 32, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  plusBtnTxt: { fontSize: 24, color: '#4F46E5', fontWeight: 'bold' },
  header: {
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1, // [추가] 구분선
    borderColor: '#E5E7EB',
  },
  headerCompact: { height: 40, paddingHorizontal: 10 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8},
  headerLeftCompact: { paddingRight: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },

  title: { fontSize: 14, fontWeight: '800', color: '#111827', maxWidth: 360 },
  titleCompact: { fontSize: 13, maxWidth: 260 },
  
  // [제거] headerBtn* (최소화 버튼 제거됨)

  close: { width: 32, height: 28, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 18, color: '#111827', fontWeight: 'bold' }, // [수정] '×'와 'ᐸ' 둘 다 잘 보이도록

  body: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  bodyCompact: { paddingHorizontal: 8, paddingTop: 6 },
  listContent: { paddingBottom: 8 },

  // ... (말풍선 스타일 - myRow ~ otherTime - 변경 없음) ...
  myRow: { alignItems: 'flex-end', marginBottom: 10 },
  otherRow: { alignItems: 'flex-start', marginBottom: 10 },
  wrap: { maxWidth: '80%', flexDirection: 'row', alignItems: 'flex-end' },
  time: { marginHorizontal: 5, marginBottom: 5, justifyContent: 'flex-end' },
  my: { backgroundColor: '#4F46E5', padding: 10, borderRadius: 15, borderTopRightRadius: 3 },
  other: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEE', padding: 10, borderRadius: 15, borderTopLeftRadius: 3 },
  myCompact: { padding: 8, borderRadius: 12 },
  otherCompact: { padding: 8, borderRadius: 12 },
  myTxt: { color: '#fff', fontSize: 14 },
  otherTxt: { color: '#111827', fontSize: 14 },
  nick: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2, marginLeft: 10 },
  msgTxtCompact: { fontSize: 13 },
  myTime: { color: '#A5B4FC', fontSize: 10 },
  otherTime: { color: '#9CA3AF', fontSize: 10 },

  // [수정] 하단 Radius 제거
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFF' },
  inputRowCompact: { padding: 8 },
  input: { flex: 1, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, marginRight: 8, fontSize: 16 },
  inputCompact: { height: 36, borderRadius: 18, fontSize: 15, paddingHorizontal: 12, marginRight: 6 },
  send: { width: 64, height: 40, borderRadius: 20, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  sendDis: { backgroundColor: '#A5B4FC' },
  sendTxt: { color: '#fff', fontWeight: '700' },
  sendCompact: { width: 56, height: 36, borderRadius: 18 },
  sendTxtCompact: { fontSize: 13 },
});