import React, { useState, useEffect } from 'react';
import FriendRequestList from '../components/Friend/FriendRequestList';
import { useAuth } from '../hooks/AuthContext.jsx';
import UserSearch from '../components/Friend/UserSearch.jsx';
import FriendList from '../components/Friend/FriendList.jsx';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { searchAllUsers } from '../api/friendsApi.jsx';
import '../styles/FriendPage.css';


export default function FriendPage() {
    // 1. 유저 목록 상태 관리
    const [userList, setUserList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { userId, userNickname, username } = useAuth();
    const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ONLINE' | '⭐'

    // 소켓 훅에서 온라인 사용자 목록 가져오기
    const { onlineUsers } = useChatSocket({ userId, userNickname });

    // 사용자 ID 상태 - 동적관리
    const [myUserId, setMyUserId] = useState(null);
    // 2. 검색어 상태 (UserSearch에서 전달받을 값)
    const [searchQuery, setSearchQuery] = useState('');

    // 컴포넌트 마운트 시 로컬 스토리지에서 최신 userId를 로드
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setMyUserId(storedUserId);
        } else {
            // ID가 없으면 로딩을 끝내고 에러 표시
            setIsLoading(false);
            setError("사용자 ID를 찾을 수 없습니다. 로그인 상태를 확인하세요.");
        }
    }, []); // 최초 마운트 시점에만 실행

    // 3. UserSearch에서 폼 제출 시 호출될 핸들러 함수
    const handleQueryChange = (query) => {
        // 입력이 들어올 때마다 searchQuery 상태 업뎃
        setSearchQuery(query.trim());
    };

    // 4. 데이터 페칭 + 정렬 (검색어 변경 시마다 실행)
    useEffect(() => {
        // ID를 불러오지 못했거나 ID가 없으면 페칭을 실행하지 않음
        if (!myUserId) return;
        const fetchUserList = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const data = await searchAllUsers(searchQuery, myUserId);
                const hasMe = data.some(u => String(u.userId) === String(myUserId));
                let usersWithMe = data;
                // 검색어가 없을 때만 '나'를 추가
                if (!hasMe && userNickname && !searchQuery.trim()) {
                    const myInfo = {
                        userId: myUserId,
                        username: username,
                        userNickname: userNickname,
                    };
                    usersWithMe = [myInfo, ...data];
                }

                // 정렬: 나를 맨 위로 + 나머지는 닉네임 오름차순               
                const sorted = [...usersWithMe].sort((a, b) => {
                    const isAMe = String(a.userId) === String(myUserId);
                    const isBMe = String(b.userId) === String(myUserId);

                    // 1순위: isMe(내가 맨 위)
                    if (isAMe && !isBMe) return -1;
                    if (!isAMe && isBMe) return 1;

                    // 2순위: 닉네임 한글 오름차순
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
    }, [myUserId, searchQuery]); // myUserId나 검색어(searchQuery)가 바뀔 때마다 이펙트가 재실행

    // 렌더링 시 로딩, 에러 상태 처리
    let listContent;

    if (myUserId === null || isLoading) {
        listContent = <p className="loading-text">사용자 정보 및 목록을 불러오는 중...</p>;
    } else if (error) {
        listContent = <p className="error-text">오류: {error}</p>;
    } else {
        // FriendList 컴포넌트에 필요한 prps만 전달
        listContent = (
            <FriendList
                users={userList} // 불러온 전체 유저 목록
                myUserId={myUserId} // 로컬 저장소에서 가져온 내 ID
                searchQuery={searchQuery} // 검색어 상태 전달
                onlineUsers={onlineUsers}
                filterType={filterType}
            />
        );
    }

    return (
        <div className="friend-page">
            <div className="friend-page-header">
                <h1 className="page-title">친구 관리</h1>
                <p className="page-subtitle">친구를 검색하고 목록을 관리하세요</p>
            </div>

            <div className="friend-page-content">

                <section className="friend-section list-section">
                    <div className="section-header">
                        <div className="section-icon">👥</div>
                        <h2 className="section-title">
                            {searchQuery ? `검색 결과 (${userList.length}건)` : '사용자 목록'}
                        </h2>
                    </div>
                    <div className="filter-buttons">
                        <button
                            className={filterType === 'ALL' ? 'active' : ''}
                            onClick={() => setFilterType('ALL')}
                        >
                            전체
                        </button>

                        <button
                            className={filterType === 'ONLINE' ? 'active' : ''}
                            onClick={() => setFilterType('ONLINE')}
                        >
                            접속중
                        </button>

                        <button
                            className={filterType === 'PICK' ? 'active' : ''}
                            onClick={() => setFilterType('PICK')}
                        >
                            ⭐
                        </button>
                    </div>
                    <div className="section-content">
                        {/* UserSearch 컴포넌트를 이 섹션 안으로 이동 */}
                        <UserSearch
                            onQueryChange={handleQueryChange}
                        />
                        {listContent} {/* 전체 목록/검색 결과 표시 */}
                    </div>
                </section>

                <section className="friend-section request-section">
                    <div className="section-header">
                        <div className="section-icon">📬</div>
                        <h2 className="section-title">친구 요청</h2>
                    </div>
                    <div className="section-content">
                        <FriendRequestList />
                    </div>
                </section>
            </div>
        </div>
    );
}