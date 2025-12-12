import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/AuthContext.jsx';
import UserSearch from '../components/User/UserSearch.jsx';
import UserList from '../components/User/UserList.jsx';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { useChatNotifications } from '../hooks/useChatNotifications.js';
import { searchAllUsers, toggleUserPick, getMyProfile } from '../api/usersApi.jsx';
import '../styles/UserPage.css';
// 1:1 채팅 API 임포트
import { checkOneToOneChat } from '../api/chatApi.jsx';
// 1:1 채팅 모달 임포트
import OneToOneChatModal from '../components/Room/Modals/OneToOneChatModal.jsx';

// 채팅방을 여는 핵심 함수
const openChatRoom = (roomId) => {
    console.log("openChatRoom called with:", roomId);
    console.log("window.electronAPI:", window.electronAPI);

    // 일렉트론 환경인지 확인
    if (window.electronAPI && typeof window.electronAPI.openChatRoom === 'function') {
        window.electronAPI.openChatRoom(roomId);
    } else {
        // 웹 브라우저 환경 (또는 Electron API 로드 실패 시)
        console.warn("Electron API not found or openChatRoom missing. Falling back to window.open");
        // [수정] HashRouter를 사용하므로 URL에 #을 포함해야 함
        const chatUrl = `#/popup/${roomId}`;
        window.open(chatUrl, `chat_room_${roomId}`, 'width=550,height=600,scrollbars=yes,resizable=yes');
    }
};

export default function UserPage() {
    const [userList, setUserList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { userId, userNickname, username } = useAuth();
    const [filterType, setFilterType] = useState('ALL');

    const { socket, onlineUsers, rooms, currentRoomId, selectRoom, addRoomToState } = useChatSocket({ userId, userNickname });

    // [추가] 알림 기능 활성화 - 이 페이지에서도 메시지 알림이 표시됩니다
    useChatNotifications({ socket, userId, rooms, currentRoomId, selectRoom });

    const [myUserId, setMyUserId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // 1:1 채팅 모달 상태 관리
    const [isOneToOneModalOpen, setIsOneToOneModalOpen] = useState(false);
    const [targetUserForChat, setTargetUserForChat] = useState(null); // 모달에 전달할 대상 사용자 정보

    // 검색창 ref (Ctrl+F 포커스용)
    const searchRef = useRef(null);

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setMyUserId(storedUserId);
        } else {
            setIsLoading(false);
            setError("사용자 ID를 찾을 수 없습니다.");
        }
    }, []);

    // Ctrl+F 키보드 단축키 핸들러
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleQueryChange = (query) => {
        setSearchQuery(query.trim());
    };

    const handleTogglePick = async (targetUserId, isPick) => {
        const isAdding = !isPick;

        try {
            const result = await toggleUserPick(targetUserId, isAdding);

            if (result.success) {
                setUserList(prevUsers =>
                    prevUsers.map(user =>
                        user.userId === targetUserId
                            ? { ...user, isPick: isAdding ? 1 : 0 }
                            : user
                    )
                );
                // console.log(result.message);
            } else {
                console.error("즐겨찾기 토글 실패:", result.message);
                alert(`작업 실패: ${result.message}`);
            }
        } catch (err) {
            console.error("API 통신 중 오류 발생:", err);
            alert(`오류가 발생했습니다: ${err.message}`);
        }
    };

    // 1:1 채팅 시작 버튼 클릭 핸들러 (핵심 로직)
    const handleStartChat = async (user) => {
        // userId는 number/string 타입이 다를 수 있으므로, String()으로 통일하여 비교
        if (String(user.userId) === String(myUserId)) return;

        try {
            // 1. 기존 채팅방 존재 여부 확인 API 호출
            const result = await checkOneToOneChat(user.userId);

            if (result.exists && result.roomId) {
                // (1) 기존 방이 존재하는 경우: 즉시 채팅방 열기
                openChatRoom(result.roomId);
            } else {
                // (2) 기존 방이 없는 경우: 방 이름 설정 모달 열기
                setTargetUserForChat(user);
                setIsOneToOneModalOpen(true);
            }
        } catch (error) {
            console.error("채팅 시작 중 오류 발생:", error);
            alert(`채팅방 확인 중 오류 발생: ${error.message || error}`);
        }
    };

    // 모달에서 새 채팅방 개설을 확정했을 때 처리 (Modal -> UserPage)
    const handleCreateChatConfirmed = (roomId, roomName) => {

        // 1. 모달 닫기 및 상태 초기화
        setIsOneToOneModalOpen(false);
        setTargetUserForChat(null);

        // 2. 생성된 방 열기
        // 서버에서 room:force_join이벤트를 보내고 프론트가 구독하는데 시간이 필요하기 때문에
        // setTimeout을 사용하여 0.3초 후에 채팅방을 열도록 함
        setTimeout(() => {
            openChatRoom(roomId);
        }, 300); // 0.3초 후에 채팅방 열기(소켓동기화 대기용)
    };


    useEffect(() => {
        if (!myUserId) return;
        const fetchUserList = async () => {
            setIsLoading(true);
            setError(null);

            try {

                // Promise.all로 본인 프로필과 다른 사용자 동시 조회
                const [myProfileData, otherUsersData] = await Promise.all([
                    getMyProfile(),
                    searchAllUsers(searchQuery, myUserId)
                ]);

                // DB에서 받은 본인 데이터 사용
                // 백엔드에서 profileImage로 넘어오는 경우 profilePic으로 매핑
                if (myProfileData && myProfileData.profileImage) {
                    myProfileData.profilePic = myProfileData.profileImage;
                }

                let usersWithMe = otherUsersData;
                if (!searchQuery.trim()) {
                    usersWithMe = [myProfileData, ...otherUsersData];
                }

                const sorted = [...usersWithMe].sort((a, b) => {
                    const isAMe = String(a.userId) === String(myUserId);
                    const isBMe = String(b.userId) === String(myUserId);

                    if (isAMe && !isBMe) return -1;
                    if (!isAMe && isBMe) return 1;

                    const nicknameA = a.userNickname || '';
                    const nicknameB = b.userNickname || '';
                    return nicknameA.localeCompare(nicknameB, 'ko', { sensitivity: 'base' });
                });

                setUserList(sorted);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserList();
    }, [myUserId, searchQuery]);

    let listContent;

    if (myUserId === null || isLoading) {
        listContent = <p className="loading-text">불러오는 중...</p>;
    } else if (error) {
        listContent = <p className="error-text">오류: {error}</p>;
    } else {
        listContent = (
            <UserList
                users={userList}
                myUserId={myUserId}
                searchQuery={searchQuery}
                onlineUsers={onlineUsers}
                filterType={filterType}
                onTogglePick={handleTogglePick}
                onStartChat={handleStartChat}
            />
        );
    }

    return (
        <div className="user-page">
            {/* 헤더: 검색창 */}
            <div className="user-page-header">
                <UserSearch ref={searchRef} onQueryChange={handleQueryChange} />
            </div>

            {/* 필터 탭 */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filterType === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterType('ALL')}
                >
                    전체
                </button>
                <button
                    className={`filter-tab ${filterType === 'PICK' ? 'active' : ''}`}
                    onClick={() => setFilterType('PICK')}
                >
                    <i className="bi bi-star-fill"></i>
                </button>
                <button
                    className={`filter-tab ${filterType === 'ONLINE' ? 'active' : ''}`}
                    onClick={() => setFilterType('ONLINE')}
                >
                    <span className="online-dot"></span> 접속중
                </button>
            </div>

            {/* 유저 리스트 */}
            <div className="user-list-container">
                {listContent}
            </div>

            {/* 1:1 채팅 모달 */}
            <OneToOneChatModal
                isOpen={isOneToOneModalOpen}
                userId={myUserId} // 로그인 사용자
                targetUser={targetUserForChat}
                onClose={() => {
                    setIsOneToOneModalOpen(false);
                    setTargetUserForChat(null);
                }}
                // 생성 확정 시 호출될 함수 연결
                onCreate={handleCreateChatConfirmed}
            />
        </div>
    );
}

