import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // HTTP 요청을 위해 axios 추가
import '../styles/ChatPage.css';

// 💡 백엔드 라우트 URL. 환경 변수에서 가져오는 것이 좋습니다.
const BASE_URL = import.meta.env.VITE_BASE_URL || '/';
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
    const [authLoaded, setAuthLoaded] = useState(false);
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
    const prevRoomIdRef = useRef(null);

    // 💡 채팅방 생성 모달 관련 상태 추가
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

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
            transports: ['websocket', 'polling'],
            pingTimeout: 30000,
            pingInterval: 10000,
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
            const authToken = localStorage.getItem('authToken');
            socket.emit('rooms:fetch', { userId, authToken });
        };
        const onDisconnect = () => setConnected(false);

        const onRoomsList = (roomList) => {
            const normalized = (roomList || []).map(r => ({
                ...r, ROOM_ID: String(r.ROOM_ID)
            }));
            setRooms(normalized);

            // 방 목록이 로드된 후, 첫 번째 방을 선택하거나 기존 방 유지
            if (currentRoomId === null && normalized.length > 0) {
                setCurrentRoomId(normalized[0].ROOM_ID);
            }
        };

        const onNewRoomCreated = (roomData) => {
            console.log("🔥 New room created and received:", roomData);
            const normalizedRoom = {
                ROOM_ID: String(roomData.roomId),
                ROOM_NAME: roomData.roomName,
                ROOM_TYPE: 'GROUP' // 서버에서 type을 전달하지 않을 경우 대비
            };

            // 새 방을 목록 맨 앞에 추가하고, 새 방으로 자동 이동
            setRooms(prev => [normalizedRoom, ...prev]);
            setCurrentRoomId(normalizedRoom.ROOM_ID);
        }

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
        socket.on('room:new_created', onNewRoomCreated); // 새 방 생성 이벤트

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rooms:list', onRoomsList);
            socket.off('chat:message', onChatMessage);
            socket.off('chat:history', onChatHistory);
            socket.off('room:new_created', onNewRoomCreated);
            socket.close();
        };
    }, [socket, userId]);

    // 4) 방 변경 감지: 이전 방 leave → 새 방 join → 히스토리 요청
    useEffect(() => {
        if (!socket || !userId) return;

        // 현재 선택된 방 ID를 Ref에 저장하여 비동기 메시지 수신 핸들러가 참조하도록 함
        currentRoomIdRef.current = currentRoomId;

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

    // ----------------------------------------------------
    // 핸들러들
    // ----------------------------------------------------
    const handleRoomSelect = (roomId) => {
        const rid = String(roomId);
        if (!rid || rid === currentRoomId) return;
        setMessages([]);
        setCurrentRoomId(rid);
    };

    const send = () => {
        const trimmed = text.trim();

        if (!trimmed || !currentRoomId || !socket || !userId || !socket.connected) {
            console.error("🚫 메시지 전송 실패 (클라이언트 유효성):", {
                trimmed: trimmed.length > 0,
                currentRoomId: currentRoomId,
                socketConnected: !!socket && socket.connected,
                userId: userId,
            });
            if (!socket.connected) {
                console.warn("Socket is disconnected. Attempting to reconnect...");
                socket.connect(); // 연결 재시도
            }
            return;
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
        // 즉시 로컬에 메시지 표시 (낙관적 업데이트)
        setMessages((prev) => [...prev, { ...msg, user: 'me' }]);
        setText('');
    };

    // ----------------------------------------------------
    // 💡 채팅방 생성 로직 (수정된 부분)
    // ----------------------------------------------------
    const handleCreateRoom = async () => {
        if (isCreating) return;
        const trimmedName = newRoomName.trim();

        if (!trimmedName) {
            alert('채팅방 이름을 입력해주세요.');
            return;
        }
        
        // 💡 userId가 로드되지 않았다면 실행 중단
        if (!userId) {
            alert('사용자 정보를 불러올 수 없습니다.');
            return;
        }

        setIsCreating(true);
        // (authToken은 기능 구현 집중 단계에서는 사용하지 않음)
        // const authToken = localStorage.getItem('authToken'); 

        try {
            // 백엔드의 POST /chats/create 라우터 호출
            const response = await axios.post(`${BASE_URL}/chats/create`, {
                roomName: trimmedName,
                // 🔑 로컬 스토리지에서 가져온 userId를 요청 본문에 추가하여 전송
                creatorId: userId 
            });

            if (response.data.success) {
                setIsModalOpen(false);
                setNewRoomName('');
                // Socket.IO 이벤트 'room:new_created'가 목록 업데이트를 처리
            } else {
                alert(`방 생성 실패: ${response.data.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('Chatroom creation failed via HTTP:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.message || '서버 오류로 인해 방 생성에 실패했습니다.';
            alert(errorMessage);
        } finally {
            setIsCreating(false);
        }
    };


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
                <div className="sidebar-header">
                    <h3>참여중인 채팅방</h3>
                    {/* 💡 우측 상단 버튼 */}
                    <button
                        className="create-room-btn"
                        onClick={() => setIsModalOpen(true)}
                        title="새 채팅방 만들기"
                    >
                        + 방 만들기
                    </button>
                </div>

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
                            {room.ROOM_NAME || `방 이름: ${room.ROOM_NAME}`}
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
                                disabled={!connected}
                            />
                            <button onClick={send} disabled={!connected || text.trim().length === 0}>보내기</button>
                        </div>
                    </>
                ) : (
                    <div className="no-room-selected">
                        {rooms.length === 0 ? '참여중인 방이 없습니다.' : '채팅방을 선택해주세요.'}
                        {rooms.length === 0 && (
                            <button
                                className="create-room-btn-large"
                                onClick={() => setIsModalOpen(true)}
                            >
                                새 채팅방 만들기
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 💡 채팅방 생성 모달 컴포넌트 */}
            {isModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>새 그룹 채팅방 만들기</h3>
                        <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="채팅방 이름 (필수)"
                            disabled={isCreating}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setIsModalOpen(false)} disabled={isCreating}>취소</button>
                            <button onClick={handleCreateRoom} disabled={isCreating || newRoomName.trim().length === 0}>
                                {isCreating ? '생성 중...' : '생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}