import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext.jsx';
import UserSearch from '../components/User/UserSearch.jsx';
import UserList from '../components/User/UserList.jsx';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { searchAllUsers, toggleUserPick } from '../api/usersApi.jsx';
import '../styles/UserPage.css';


export default function UserPage() {
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

    // 즐겨찾기 토글 처리를 위한 핸들러 함수
    const handleTogglePick = async (targetUserId, isPick) => {
        // isPick 상태는 현재 상태이므로, API에는 반대 액션(추가/제거)을 전달해야 함
        // isAdding: true면 추가 (현재 isPick이 false), false면 제거 (현재 isPick이 true)
        const isAdding = !isPick;

        try {
            // 1. API 호출: 백엔드에 즐겨찾기 상태 변경 요청
            const result = await toggleUserPick(targetUserId, isAdding);

            if (result.success) {
                // 2. [로컬 상태 업데이트]: API 성공 후 userList 상태를 즉시 업데이트
                // 사용자 목록을 순회하며 targetUserId와 일치하는 사용자의 isPick 상태만 반전시킴
                setUserList(prevUsers =>
                    prevUsers.map(user =>
                        user.userId === targetUserId
                            ? { ...user, isPick: isAdding ? 1 : 0 } // isPick 상태 반전
                            : user
                    )
                );
                // 성공 메시지 처리
                console.log(result.message);

            } else {
                // API 실패 메시지 처리
                console.error("즐겨찾기 토글 실패:", result.message);
                // [참고]: alert() 대신 Toast나 Modal UI를 사용하는 것이 좋음(보류)
                alert(`작업 실패: ${result.message}`);
            }

        } catch (err) {
            console.error("API 통신 중 오류 발생:", err);
            alert(`오류가 발생했습니다: ${err.message}`);
        }
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
        // UserList 컴포넌트에 필요한 props만 전달
        listContent = (
            <UserList
                users={userList}
                myUserId={myUserId}
                searchQuery={searchQuery}
                onlineUsers={onlineUsers}
                filterType={filterType}
                onTogglePick={handleTogglePick}
            />
        );
    }

    return (
        <div className="friend-page">
            <div className="friend-page-header">
                <h1 className="page-title">사용자 관리</h1>
                <p className="page-subtitle">사용자를 검색하고 목록을 관리하세요</p>
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
            </div>
        </div>
    );
}