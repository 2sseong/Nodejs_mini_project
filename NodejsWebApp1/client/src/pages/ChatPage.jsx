import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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

    // 채팅방 생성 모달 관련 상태 추가
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    //  인원 추가 모달 관련 상태 추가
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteeId, setInviteeId] = useState(''); // **최종 초대할 사용자의 ID (숨겨짐)**
    const [inviteeUsername, setInviteeUsername] = useState(''); // **검색 입력창에 표시되는 USERNAME**
    const [isInviting, setIsInviting] = useState(false);
    const [searchResults, setSearchResults] = useState([]); //   검색 결과 리스트 상태 추가
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const abortRef = useRef(null);
    const debounceRef = useRef(null);


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

    // 💡 채팅방 생성 로직
    const handleCreateRoom = async () => {
        if (isCreating) return;
        const trimmedName = newRoomName.trim();

        if (!trimmedName) {
            alert('채팅방 이름을 입력해주세요.');
            return;
        }

        if (!userId) {
            alert('사용자 정보를 불러올 수 없습니다.');
            return;
        }

        setIsCreating(true);

        try {
            // 백엔드의 POST /chats/create 라우터 호출
            const response = await axios.post(`${BASE_URL}/chats/create`, {
                roomName: trimmedName,
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

    // 사용자 검색 핸들러
    const handleSearchUsers = (input) => {
          const q = input.trim();
          setInviteeUsername(input);
          setSearchError('');
       
              // 길이 0~1: 즉시 리셋
              if (q.length < 2) {
                    if (abortRef.current) abortRef.current.abort();
                    clearTimeout(debounceRef.current);
                    setIsSearching(false);
                    setSearchResults([]);
                    return;
                  }
       
              // 디바운스
              clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(async () => {
                // 이전 요청 중단
                    if (abortRef.current) abortRef.current.abort();
                abortRef.current = new AbortController();
           
                    setIsSearching(true);
                setSearchResults([]);
                try {
                      const resp = await axios.get(
                            `${BASE_URL}/users/search`,
                            { params: { query: q }, signal: abortRef.current.signal }
                          );
                      // 응답 호환: {users:[...]} | {data:[...]} | 바로 배열
                          const payload = resp?.data;
                      const list =
                            Array.isArray(payload) ? payload :
                                Array.isArray(payload?.users) ? payload.users :
                                    Array.isArray(payload?.data) ? payload.data : [];
                      setSearchResults(list);
                    } catch (err) {
                          if (axios.isCancel?.(err) || err.name === 'CanceledError') return; // 취소는 무시
                          console.error('User search failed:', err.response?.data || err.message);
                          setSearchError(err.response?.data?.message || '검색 중 오류가 발생했습니다.');
                          setSearchResults([]);
                        } finally {
                      setIsSearching(false);
                    }
           }, 300); // 300ms 디바운스
     };

    //  검색 결과 클릭 시
    const handleUserSelect = (user) => {
        // 1. 최종 초대할 ID를 저장
        setInviteeId(String(user.USER_ID));
        // 2. 검색창에 선택된 사용자 이름 표시
        setInviteeUsername(user.USERNAME);
        // 3. 검색 결과 목록 숨기기
        setSearchResults([]);
    };

    // 인원 추가 요청 핸들러 함수 추가
    const handleInviteUser = async () => {
        // 초대할 사용자 ID를 상태에서 가져와 사용
        if (isInviting || !currentRoomId || !inviteeId) return;

        if (inviteeId === userId) {
            alert('자기 자신을 초대할 수 없습니다.');
            return;
        }

        setIsInviting(true);
        try {
            // 백엔드의 POST /chats/invite 라우터 호출 시, ID를 전송
            const response = await axios.post(`${BASE_URL}/users/invite`, {
                roomId: String(currentRoomId),
                inviterId: userId,
                inviteeId: inviteeId //   최종 ID 사용
            });

            if (response.data.success) {
                alert(`${inviteeUsername} 님을 성공적으로 초대했습니다.`);
                setIsInviteModalOpen(false);
                setInviteeId('');
                setInviteeUsername(''); // 상태 초기화
                // 방 목록을 새로고침할 필요가 없습니다. (초대된 사용자가 알아서 처리)
            } else {
                alert(`초대 실패: ${response.data.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            // ... (오류 처리 로직 유지)
        } finally {
            setIsInviting(false);
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
                            {/* 3. 채팅방 헤더에 인원 추가 버튼 추가 */}
                            <button
                                className="invite-user-btn"
                                onClick={() => setIsInviteModalOpen(true)}
                                title="인원 초대"
                                disabled={!currentRoomId}
                            >
                                + 초대
                            </button>
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

            {/* 💡 채팅방 생성 모달 컴포넌트 (이전과 동일) */}
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

            {/* 인원 추가 모달 컴포넌트 수정 */}
            {isInviteModalOpen && currentRoomId && (
                <div className="modal-backdrop" onClick={() => setIsInviteModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>[{currentRoom?.ROOM_NAME}]에 인원 초대</h3>

                        {/* 검색 입력창 */}
                        <input
                            type="text"
                            value={inviteeUsername}
                            //  입력 시 검색 요청
                            onChange={(e) => handleSearchUsers(e.target.value)}
                            placeholder="초대할 사용자 이름(USERNAME) 검색"
                            disabled={isInviting}
                        />

                        {/* 검색 결과 리스트 */}
                         <div className="search-results-wrap">
                               {isSearching && <div className="loading-indicator">검색 중...</div>}
                               {!isSearching && searchError && (
                                     <div className="search-error">{searchError}</div>
                                )}
                           {!isSearching && !searchError && inviteeUsername.trim().length >= 2 && searchResults.length === 0 && (
                                 <div className="search-empty">검색 결과가 없습니다.</div>
                                              )}
                       {searchResults.length > 0 && (
                             <ul className="search-results-list">
                           {searchResults.map((user) => (
                                 <li key= { String(user.USER_ID)} onClick={() => handleUserSelect(user)}>
                               {user.USERNAME} {user.NICKNAME ? `(${user.NICKNAME})` : ''}
                                 </li>
                                ))}
                            </ul>
                          )}
                        </div >

                        <div className="modal-actions">
                            <button onClick={() => {
                                setIsInviteModalOpen(false);
                                setSearchResults([]); // 모달 닫을 때 초기화
                                setInviteeUsername(''); // 모달 닫을 때 초기화
                                setInviteeId(''); // 모달 닫을 때 초기화
                            }} disabled={isInviting}>취소</button>

                            <button
                                onClick={handleInviteUser}
                                // ID가 선택되었을 때만 활성화
                                disabled={isInviting || !inviteeId}
                            >
                                {isInviting ? '초대 중...' : `초대 (${inviteeUsername || '선택 필요'})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}