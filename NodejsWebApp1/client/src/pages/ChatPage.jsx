import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import '../styles/ChatPage.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

function sanitizeStorageValue(v) {
    // "null", "undefined", 빈 문자열 등 비정상 값 방지
    if (v === null) return null;
    const trimmed = String(v).trim().replace(/^"+|"+$/g, '');
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

export default function ChatPage() {
    const navigate = useNavigate();

    // 인증 관련
    const [authLoaded, setAuthLoaded] = useState(false); // 스토리지 로드 완료 여부
    const [userId, setUserId] = useState(null);
    const [userNickname, setUserNickname] = useState(null);

    // 채팅 관련
    const [connected, setConnected] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const bottomRef = useRef(null);
    const currentRoomIdRef = useRef(null);

    // 이전 방 추적용
    const prevRoomIdRef = useRef(null);

    // 1) 최초 1회: 로컬 스토리지에서 인증정보 로드만 담당 (소켓 X)
    useEffect(() => {
        // 키 이름 불일치 대비: userid / userId 둘 다 시도
        const idRaw = localStorage.getItem('userid') ?? localStorage.getItem('userId');
        const nickRaw = localStorage.getItem('userNickname') ?? localStorage.getItem('nickname');

        const id = sanitizeStorageValue(idRaw);
        const nickname = sanitizeStorageValue(nickRaw);

        setUserId(id);
        setUserNickname(nickname);
        setAuthLoaded(true);

        if (!id || !nickname) {
            console.error('로그인 정보가 로컬 스토리지에서 null/invalid로 확인되었습니다. 리디렉션합니다.');
            // replace: 뒤로 가기 방지
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    // 2) userId가 있을 때만 소켓 인스턴스 생성
    const socket = useMemo(() => {
        if (!userId) return null;
        return io(SOCKET_URL, {
            withCredentials: true,
            query: { userId: userId },
            // 필요 시 transports 지정: transports: ['websocket']
            transports: ['websocket', 'polling'],

            // 💡 연결 안정성 확보를 위해 이 두 옵션을 추가/수정
            pingTimeout: 30000,   // 서버가 핑 응답을 기다리는 시간을 30초로 늘림
            pingInterval: 10000,  // 핑을 10초마다 보내 연결을 적극적으로 유지

            reconnection: true,
            reconnectionAttempts: Infinity,
        });
    }, [userId]);

    // 3) 소켓 이벤트 바인딩(연결/방 목록/메시지 등) — socket 존재할 때만
    useEffect(() => {
        if (!socket || !userId) return;

        const onConnect = () => {
            setConnected(true);
            console.log("✅ Socket connected successfully.");
            socket.emit('rooms:fetch', { userId });
        };
        const onDisconnect = () => setConnected(false);

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({...r, ROOM_ID: String(r.ROOM_ID)
            }));
            setRooms(normalized);
            if (normalized.length && currentRoomId === null) {
                setCurrentRoomId(normalized[0].ROOM_ID); // string
                }
        };

        const onChatMessage = (msg) => {
            // Ref를 사용하여 최신 currentRoomId 값에 접근
            const latestRoomId = String(currentRoomIdRef.current);
            const incomingRoomId = String(msg.ROOM_ID);
            setMessages(prev => (incomingRoomId === latestRoomId ? [...prev, msg] : prev));
        };

        const onChatHistory = (historyMessages) => {
            setMessages(historyMessages || []);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rooms:list', onRoomsList);
        socket.on('chat:message', onChatMessage);
        socket.on('chat:history', onChatHistory);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('chat:message', onChatMessage);
            socket.off('chat:history', onChatHistory);
            socket.close();
        };
    }, [socket, userId]);

    // 4) 방 변경 감지: 이전 방 leave → 새 방 join → 히스토리 요청
    useEffect(() => {
        if (!socket || !userId) return;
        const prev = prevRoomIdRef.current;

        // 이전 방이 있었다면 떠나기
        if (prev && prev !== currentRoomId) {
            socket.emit('room:leave', { roomId: prev, userId });
        }
        // 현재 방 입장 + 히스토리
        if (currentRoomId) {
            socket.emit('room:join', { roomId: String(currentRoomId), userId });
            socket.emit('chat:get_history', { roomId: String(currentRoomId) });
        }

        prevRoomIdRef.current = currentRoomId;
    }, [currentRoomId, socket, userId]);

    // 5) 스크롤 자동 이동
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 핸들러들
    const handleRoomSelect = (roomId) => {
        const rid = String(roomId);
        if (!rid || rid === currentRoomId) return;
        setMessages([]);
        setCurrentRoomId(rid);
    };

    const send = () => {
        const trimmed = text.trim();

        // 💡 클라이언트 콘솔에 디버깅 정보 출력
        if (!trimmed || !currentRoomId || !socket || !userId) {
            console.error("🚫 메시지 전송 실패 (클라이언트 유효성):", {
                trimmed: trimmed.length > 0,
                currentRoomId: currentRoomId, // 이 값이 null인지 확인하세요.
                socketConnected: !!socket,
                userId: userId,
            });
            return;
        }

        // 소켓이 연결되어 있지 않으면 재연결을 시도하고 전송을 중단
        if (!socket.connected) {
            console.warn("Socket is disconnected. Attempting to reconnect...");
            socket.connect(); // 연결 재시도
            return; // 즉시 전송하지 않고 다음 연결 성공 시 재시도하도록 유도
        }

        const msg = {
            ROOM_ID: String(currentRoomId),
            SENDER_ID: userId,
            NICKNAME: userNickname,
            CONTENT: trimmed,
            SENT_AT: Date.now(),
        };

        console.log("✅ 서버로 메시지 전송 시도:", msg);
        socket.emit('chat:message', msg);
        setMessages((prev) => [...prev, { ...msg, user: 'me' }]);
        setText('');
    };

    // currentRoomId가 변경될 때마다 Ref 업데이트
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

   const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));

    // 로딩/리다이렉트 처리
    if (!authLoaded) {
        return <div>로딩 중... (인증 확인)</div>;
    }
    if (!userId || !userNickname) {
        return <div>로그인 페이지로 이동 중...</div>;
    }

    return (
        <div className="chat-container">
            <div className="sidebar">
                <h3>참여중인 채팅방</h3>
                <div className="connection-status">현재 사용자: <strong>{userNickname}</strong></div>
                <div className="connection-status">
                    연결 상태: <span className={connected ? 'connected' : 'disconnected'}>{connected ? 'ON' : 'OFF'}</span>
                </div>

                <ul className="room-list">
                    {rooms.map((room) => (
                        <li
                            key={room.ROOM_ID}
                            className={`room-item ${String(room.ROOM_ID) === String(currentRoomId) ? 'active' : ''}`}
                            onClick={() => handleRoomSelect(room.ROOM_ID)}
                        >
                            {room.ROOM_NAME || `방 ID: ${room.ROOM_ID}`}
                            <span className="room-type">{room.ROOM_TYPE === 'GROUP' ? '👥' : '👤'}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="chat-main">
                {currentRoomId ? (
                    <>
                        <div className="chat-header">
                            <h2>{currentRoom?.ROOM_NAME || '채팅방'}</h2>
                        </div>

                        <div className="message-area">
                            {messages.map((m, i) => (
                                <div
                                    key={i}
                                    className={`message-bubble ${m.SENDER_ID === userId ? 'mine' : 'theirs'}`}
                                >
                                    <div className="message-info">
                                        <span className="message-user">
                                            {m.SENDER_ID === userId ? userNickname : (m.NICKNAME || m.SENDER_ID)}
                                        </span>
                                        <span className="message-time">
                                            {new Date(m.SENT_AT).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="message-content">{m.CONTENT || m.text}</div>
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>

                        <div className="input-area">
                            <input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && send()}
                                placeholder="메시지를 입력하세요..."
                            />
                            <button onClick={send} disabled={!connected}>보내기</button>
                        </div>
                    </>
                ) : (
                    <div className="no-room-selected">
                        {rooms.length === 0 ? '참여중인 방이 없습니다.' : '채팅방을 선택해주세요.'}
                    </div>
                )}
            </div>
        </div>
    );
}