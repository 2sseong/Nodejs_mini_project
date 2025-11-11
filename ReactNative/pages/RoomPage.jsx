import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    FlatList, 
    TextInput, 
    StyleSheet, 
    Modal, 
    ActivityIndicator,
    Alert,
} from 'react-native';

// --- 전역 설정 및 상수 ---
const WEBSOCKET_URL = 'ws://localhost:1337/ws/chat';
const MOCK_USER_ID = 'mock-user-ws-123456'; 

/**
 * @typedef {object} ChatRoom
 * @property {string} ROOM_ID
 * @property {string} ROOM_NAME
 * @property {'GROUP' | 'PRIVATE'} ROOM_TYPE
 */

/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {string} USER_ID
 * @property {string} TEXT
 * @property {Date} TIMESTAMP
 */


// --- MOCK 데이터: 웹소켓 연결이 없는 경우를 위한 초기 데이터 ---
const INITIAL_ROOMS = [
    { ROOM_ID: 'room-1', ROOM_NAME: '웹소켓 테스트방', ROOM_TYPE: 'GROUP' },
    { ROOM_ID: 'room-2', ROOM_NAME: 'React Native 피드백', ROOM_TYPE: 'GROUP' },
    { ROOM_ID: 'room-3', ROOM_NAME: '개인 메시지', ROOM_TYPE: 'PRIVATE' },
];

const INITIAL_MESSAGES = {
    'room-1': [
        { id: 'm1', USER_ID: MOCK_USER_ID, TEXT: '웹소켓 채팅 앱 시작!', TIMESTAMP: new Date(Date.now() - 60000) },
        { id: 'm2', USER_ID: 'server', TEXT: '서버에서 수신 확인되었습니다.', TIMESTAMP: new Date() },
    ],
    'room-2': [],
    'room-3': [],
};

// --- 1. 컴포넌트: RoomListItem ---
const RoomListItem = React.memo(({ room, active, onClick }) => {
    return (
        <TouchableOpacity
            style={[styles.roomItem, active ? styles.roomItemActive : styles.roomItemInactive]}
            onPress={() => onClick(room.ROOM_ID)}
        >
            <Text style={[styles.roomItemText, active ? styles.textWhite : styles.textGray]}>
                {room.ROOM_NAME || `방 이름: ${room.ROOM_ID}`}
            </Text>
            <View style={[styles.roomTypeBadge, active ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.roomTypeText, active ? styles.textWhite : styles.textGray]}>
                    {room.ROOM_TYPE === 'GROUP' ? '👨‍👦‍👦' : '👤'}
                </Text>
            </View>
        </TouchableOpacity>
    );
});


// --- 2. 컴포넌트: ChatSidebar ---
const ChatSidebar = React.memo(({
    userNickname,
    connected,
    rooms,
    currentRoomId,
    onSelectRoom,
    onOpenCreateModal,
}) => {
    const renderRoom = ({ item }) => (
        <RoomListItem
            room={item}
            active={String(item.ROOM_ID) === String(currentRoomId)}
            onClick={onSelectRoom}
        />
    );

    return (
        <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
                <Text style={styles.headerTitle}>참여중인 채팅방</Text>
                <TouchableOpacity
                    style={styles.createRoomBtn}
                    onPress={onOpenCreateModal}
                >
                    <Text style={styles.createRoomBtnText}>+ 방 만들기</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.connectionStatusContainer}>
                <Text style={styles.statusText}>
                    현재 사용자: 
                    <Text style={styles.nicknameText}>{userNickname}</Text>
                </Text>
                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>
                        연결 상태:{' '}
                    </Text>
                    <Text style={[styles.statusIndicatorText, connected ? styles.connectedText : styles.disconnectedText]}>
                        {connected ? 'ON' : 'OFF'}
                    </Text>
                    <View style={[styles.indicatorDot, connected ? styles.connectedDot : styles.disconnectedDot]} />
                </View>
            </View>

            <FlatList
                data={rooms}
                renderItem={renderRoom}
                keyExtractor={item => item.ROOM_ID}
                style={styles.roomList}
                ListEmptyComponent={() => (
                    <View style={styles.emptyList}>
                        <Text style={styles.emptyListText}>채팅방이 없습니다.</Text>
                    </View>
                )}
            />
        </View>
    );
});


// --- 3. 컴포넌트: ChatWindow (메시지 표시 및 전송) ---
const ChatWindow = React.memo(({ roomId, roomName, userId, messages, sendMessage }) => {
    const [messageText, setMessageText] = useState('');
    const flatListRef = useRef(null);

    // 메시지 목록이 업데이트 될 때마다 가장 아래로 스크롤
    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages]);

    // 메시지 전송 핸들러
    const handleSendMessage = useCallback(() => {
        if (messageText.trim() === '' || !roomId) return;

        // 부모 컴포넌트에서 받은 sendMessage 함수를 사용하여 웹소켓으로 메시지 전송
        sendMessage(roomId, messageText.trim());
        setMessageText(''); 
    }, [messageText, roomId, sendMessage]);

    // 메시지 버블 컴포넌트
    const MessageBubble = ({ message }) => {
        const isMine = message.USER_ID === userId;
        const timeString = message.TIMESTAMP instanceof Date 
            ? message.TIMESTAMP.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : '전송 중...';

        const bubbleStyle = isMine ? styles.myBubble : styles.otherBubble;
        const textStyle = isMine ? styles.myText : styles.otherText;
        const timeStyle = isMine ? styles.myTime : styles.otherTime;
        const containerStyle = isMine ? styles.myMessageContainer : styles.otherMessageContainer;

        return (
            <View style={containerStyle}>
                <View style={[styles.bubbleContainer, { flexDirection: isMine ? 'row-reverse' : 'row' }]}>
                    <View style={bubbleStyle}>
                        {!isMine && (
                            <Text style={styles.otherUsername}>
                                {message.USER_ID.substring(0, 8)}...
                            </Text>
                        )}
                        <Text style={textStyle}>{message.TEXT}</Text>
                        <Text style={timeStyle}>{timeString}</Text>
                    </View>
                </View>
            </View>
        );
    };

    if (!roomId) {
        return (
            <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>채팅방을 선택해주세요.</Text>
            </View>
        );
    }

    return (
        <View style={styles.chatWindow}>
            {/* Header */}
            <View style={styles.chatHeader}>
                <Text style={styles.chatHeaderTitle}>{roomName}</Text>
                <Text style={styles.chatHeaderSubtitle}>방 ID: {roomId}</Text>
            </View>
            
            {/* Message List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={({ item }) => <MessageBubble message={item} />}
                keyExtractor={item => item.id}
                style={styles.messageList}
            />

            {/* Input Area */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="메시지 입력..."
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="send"
                    onSubmitEditing={handleSendMessage}
                    blurOnSubmit={false}
                />
                <TouchableOpacity
                    style={[styles.sendButton, messageText.trim() === '' && styles.sendButtonDisabled]}
                    onPress={handleSendMessage}
                    disabled={messageText.trim() === ''}
                >
                    <Text style={styles.sendButtonText}>전송</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});


// --- 4. 컴포넌트: CreateRoomModal (방 생성 모달) ---
const CreateRoomModal = React.memo(({ isOpen, onClose, onRoomCreated }) => {
    const [roomName, setRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreateRoom = async () => {
        if (roomName.trim() === '') {
            setError('방 이름을 입력해주세요.');
            return;
        }

        setIsCreating(true);
        setError('');

        // 웹소켓 서버로 방 생성 요청을 보낸다고 가정
        try {
            // 실제 웹소켓 요청 로직 (예: socket.send(JSON.stringify({ type: 'CREATE_ROOM', name: roomName })))
            await new Promise(resolve => setTimeout(resolve, 500)); // Mock API 지연

            // 서버로부터 새 방 ID를 받았다고 가정
            const newRoomId = 'new-room-' + Math.random().toString(36).substring(2, 7);

            // App 컴포넌트에 새 방 정보를 추가하도록 콜백 호출
            onRoomCreated(newRoomId, roomName.trim());
            
            setRoomName('');
            onClose(); 
        } catch (e) {
            console.error("채팅방 생성 중 오류: ", e);
            setError('방 생성에 실패했습니다. (웹소켓 연결 확인)');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isOpen}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>새 채팅방 만들기</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.modalCloseText}>X</Text>
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <View style={styles.modalError}>
                            <Text style={styles.modalErrorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.modalBody}>
                        <Text style={styles.inputLabel}>채팅방 이름</Text>
                        <TextInput
                            style={styles.modalTextInput}
                            value={roomName}
                            onChangeText={setRoomName}
                            placeholder="예: 프로젝트 팀 회의"
                            editable={!isCreating}
                        />
                    </View>
                    
                    <TouchableOpacity
                        style={[styles.modalButton, (isCreating || roomName.trim() === '') && styles.modalButtonDisabled]}
                        onPress={handleCreateRoom}
                        disabled={isCreating || roomName.trim() === ''}
                    >
                        {isCreating ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.modalButtonText}>방 생성하기</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});


// --- 5. 메인 컴포넌트: App (웹소켓 연결 관리 및 상태 중앙 집중화) ---
export default function App() {
    // ----------------------------
    // 5-1. 상태 관리
    // ----------------------------
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [userId, setUserId] = useState(MOCK_USER_ID); // Mock User ID 사용
    const [rooms, setRooms] = useState(INITIAL_ROOMS);
    const [messagesByRoom, setMessagesByRoom] = useState(INITIAL_MESSAGES);
    const [currentRoomId, setCurrentRoomId] = useState(INITIAL_ROOMS[0].ROOM_ID);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const latestRoomIdRef = useRef(currentRoomId); // 웹소켓 핸들러에서 최신 RoomId를 참조하기 위한 Ref
    
    useEffect(() => {
        latestRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    const userNickname = useMemo(() => `${userId.substring(0, 8)}...`, [userId]);

    // ----------------------------
    // 5-2. 웹소켓 연결 및 이벤트 핸들링 (O(1) on event)
    // ----------------------------
    useEffect(() => {
        const ws = new WebSocket(`${WEBSOCKET_URL}?userId=${userId}`);
        setSocket(ws);

        ws.onopen = () => {
            console.log('웹소켓 연결 성공');
            setConnected(true);
            
            // 연결 성공 시, 서버에 현재 참여 중인 방 목록 요청을 보낸다고 가정
            // ws.send(JSON.stringify({ type: 'GET_ROOMS', userId: userId }));
            // ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: latestRoomIdRef.current })); // 현재 방 입장
        };

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            console.log('메시지 수신:', data);

            switch (data.type) {
                case 'ROOM_LIST':
                    // 서버로부터 방 목록 수신 시 rooms 상태 업데이트
                    // setRooms(data.rooms);
                    break;
                case 'MESSAGE':
                    // 서버로부터 새로운 메시지 수신 시 처리 (O(1) 덧붙이기)
                    setMessagesByRoom(prev => {
                        const newMsg = {
                            id: data.id,
                            USER_ID: data.userId,
                            TEXT: data.text,
                            TIMESTAMP: new Date(),
                        };
                        const newMessages = [...(prev[data.roomId] || []), newMsg];
                        return { ...prev, [data.roomId]: newMessages };
                    });
                    break;
                // 기타: 'USER_JOINED', 'ERROR' 등
                default:
                    console.log(`알 수 없는 메시지 타입: ${data.type}`);
            }
        };

        ws.onclose = (e) => {
            console.log('웹소켓 연결 종료:', e.code, e.reason);
            setConnected(false);
        };

        ws.onerror = (e) => {
            console.error('웹소켓 오류 발생:', e.message);
            setConnected(false);
            Alert.alert("연결 오류", "웹소켓 연결 중 오류가 발생했습니다.");
        };

        // 클린업 함수: 컴포넌트 언마운트 시 웹소켓 연결 해제
        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [userId]);


    // ----------------------------
    // 5-3. 채팅 메시지 전송 로직
    // ----------------------------
    const sendMessage = useCallback((roomId, text) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            Alert.alert("오프라인", "서버에 연결되지 않았습니다.");
            return;
        }

        // 웹소켓으로 JSON 형식 메시지 전송
        const messagePayload = JSON.stringify({
            type: 'SEND_MESSAGE',
            roomId: roomId,
            userId: userId,
            text: text,
            timestamp: new Date().toISOString(),
        });
        
        socket.send(messagePayload);

        // **주의**: 실제 앱에서는 서버에서 메시지를 다시 받아야 하지만, UX를 위해
        // 임시로 로컬 상태에 먼저 추가하는 'Optimistic Update'를 적용할 수 있습니다.
        const tempMsg = {
            id: 'temp-' + Date.now(),
            USER_ID: userId,
            TEXT: text,
            TIMESTAMP: new Date(),
        };
        setMessagesByRoom(prev => {
            const newMessages = [...(prev[roomId] || []), tempMsg];
            return { ...prev, [roomId]: newMessages };
        });

    }, [socket, userId]);


    // ----------------------------
    // 5-4. 핸들러 함수
    // ----------------------------
    const handleSelectRoom = useCallback((roomId) => {
        // 방 변경 시 이전 방 퇴장, 새 방 입장 메시지를 서버로 보낸다고 가정
        // if (socket && socket.readyState === WebSocket.OPEN && latestRoomIdRef.current) {
        //     socket.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId: latestRoomIdRef.current }));
        // }
        // if (socket && socket.readyState === WebSocket.OPEN) {
        //     socket.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: roomId }));
        // }
        setCurrentRoomId(roomId);
    }, []);

    const handleRoomCreated = useCallback((newRoomId, roomName) => {
        // 로컬 상태에 새 방 추가 및 바로 선택
        const newRoom = { ROOM_ID: newRoomId, ROOM_NAME: roomName, ROOM_TYPE: 'GROUP' };
        setRooms(prev => [...prev, newRoom]);
        setMessagesByRoom(prev => ({ ...prev, [newRoomId]: [] }));
        setCurrentRoomId(newRoomId);
    }, []);

    const currentRoom = useMemo(() => {
        return rooms.find(r => String(r.ROOM_ID) === String(currentRoomId)) || {};
    }, [rooms, currentRoomId]);

    const currentMessages = useMemo(() => {
        const msgs = messagesByRoom[currentRoomId] || [];
        // 메시지를 시간 순으로 정렬하여 반환 (이미 추가 시점에 정렬되지만 안전 장치)
        return msgs.sort((a, b) => a.TIMESTAMP.getTime() - b.TIMESTAMP.getTime());
    }, [messagesByRoom, currentRoomId]);


    if (!userId) { // 실제 인증 로직이 있다면 여기서 로딩 처리
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>사용자 인증 중...</Text>
            </View>
        );
    }
    
    // ----------------------------
    // 5-5. 렌더링
    // ----------------------------
    return (
        <View style={styles.container}>
            {/* Sidebar */}
            <ChatSidebar
                userNickname={userNickname}
                connected={connected}
                rooms={rooms}
                currentRoomId={currentRoomId}
                onSelectRoom={handleSelectRoom}
                onOpenCreateModal={() => setIsModalOpen(true)}
            />

            {/* Main Chat Window */}
            <ChatWindow
                roomId={currentRoomId}
                roomName={currentRoom.ROOM_NAME || "채팅방을 선택하세요"}
                userId={userId}
                messages={currentMessages}
                sendMessage={sendMessage}
            />

            {/* Create Room Modal */}
            <CreateRoomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRoomCreated={handleRoomCreated}
            />
        </View>
    );
}

// --- 6. 스타일 시트 (이전 버전과 동일) ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row', // 사이드바와 채팅창을 가로로 배치
        backgroundColor: '#F3F4F6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#4B5563',
    },
    // --- Sidebar Styles ---
    sidebar: {
        width: 280, 
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        padding: 15,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    createRoomBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    createRoomBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    connectionStatusContainer: {
        marginBottom: 15,
    },
    statusText: {
        fontSize: 12,
        color: '#4B5563',
        marginBottom: 3,
    },
    nicknameText: {
        fontWeight: '700',
        color: '#4F46E5',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicatorText: {
        fontWeight: '700',
        marginLeft: 4,
    },
    connectedText: {
        color: '#10B981',
    },
    disconnectedText: {
        color: '#F87171',
    },
    indicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 5,
    },
    connectedDot: {
        backgroundColor: '#10B981',
    },
    disconnectedDot: {
        backgroundColor: '#F87171',
    },
    roomList: {
        flex: 1,
    },
    emptyList: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    emptyListText: {
        color: '#9CA3AF',
        fontSize: 13,
        textAlign: 'center',
    },
    // --- RoomListItem Styles ---
    roomItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        marginBottom: 6,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    roomItemActive: {
        backgroundColor: '#4F46E5',
    },
    roomItemInactive: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    roomItemText: {
        fontSize: 14,
        fontWeight: '600',
        flexShrink: 1,
        marginRight: 10,
    },
    textWhite: {
        color: '#FFFFFF',
    },
    textGray: {
        color: '#374151',
    },
    roomTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 15,
    },
    badgeActive: {
        backgroundColor: '#3730A3', // Indigo-700
    },
    badgeInactive: {
        backgroundColor: '#E5E7EB', // Gray-200
    },
    roomTypeText: {
        fontSize: 10,
    },
    // --- ChatWindow Styles ---
    chatWindow: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    welcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    welcomeText: {
        fontSize: 18,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    chatHeader: {
        padding: 15,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 3,
    },
    chatHeaderTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1F2937',
    },
    chatHeaderSubtitle: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    messageList: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    // Message Bubble Styles
    myMessageContainer: {
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    otherMessageContainer: {
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bubbleContainer: {
        maxWidth: '70%',
    },
    myBubble: {
        backgroundColor: '#4F46E5', // Indigo-600
        padding: 10,
        borderRadius: 15,
        borderTopRightRadius: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    otherBubble: {
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 15,
        borderTopLeftRadius: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    myText: {
        color: '#FFFFFF',
        fontSize: 14,
        marginBottom: 2,
    },
    otherText: {
        color: '#1F2937',
        fontSize: 14,
        marginBottom: 2,
    },
    otherUsername: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 2,
    },
    myTime: {
        color: '#A5B4FC', // Indigo-300
        fontSize: 10,
        textAlign: 'right',
    },
    otherTime: {
        color: '#9CA3AF', // Gray-400
        fontSize: 10,
        textAlign: 'right',
    },
    // Input Area Styles
    inputContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    textInput: {
        flex: 1,
        height: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
        fontSize: 16,
        color: '#1F2937',
    },
    sendButton: {
        width: 60,
        height: 40,
        backgroundColor: '#4F46E5',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#A5B4FC',
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    // --- Modal Styles ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4F46E5',
    },
    modalCloseText: {
        fontSize: 18,
        color: '#9CA3AF',
    },
    modalError: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#F87171',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
    },
    modalErrorText: {
        color: '#B91C1C',
        fontSize: 13,
    },
    modalBody: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 5,
    },
    modalTextInput: {
        height: 45,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    modalButton: {
        backgroundColor: '#4F46E5',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalButtonDisabled: {
        backgroundColor: '#A5B4FC',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});