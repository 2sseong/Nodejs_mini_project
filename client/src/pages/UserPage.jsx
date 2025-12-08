import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext.jsx';
import UserSearch from '../components/User/UserSearch.jsx';
import UserList from '../components/User/UserList.jsx';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { searchAllUsers, toggleUserPick } from '../api/usersApi.jsx';
import '../styles/UserPage.css';


export default function UserPage() {
    const [userList, setUserList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { userId, userNickname, username } = useAuth();
    const [filterType, setFilterType] = useState('ALL');

    const { onlineUsers } = useChatSocket({ userId, userNickname });

    const [myUserId, setMyUserId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setMyUserId(storedUserId);
        } else {
            setIsLoading(false);
            setError("사용자 ID를 찾을 수 없습니다.");
        }
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
                console.log(result.message);
            } else {
                console.error("즐겨찾기 토글 실패:", result.message);
                alert(`작업 실패: ${result.message}`);
            }
        } catch (err) {
            console.error("API 통신 중 오류 발생:", err);
            alert(`오류가 발생했습니다: ${err.message}`);
        }
    };

    useEffect(() => {
        if (!myUserId) return;
        const fetchUserList = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const data = await searchAllUsers(searchQuery, myUserId);
                const hasMe = data.some(u => String(u.userId) === String(myUserId));
                let usersWithMe = data;
                if (!hasMe && userNickname && !searchQuery.trim()) {
                    const myInfo = {
                        userId: myUserId,
                        username: username,
                        userNickname: userNickname,
                    };
                    usersWithMe = [myInfo, ...data];
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
            />
        );
    }

    return (
        <div className="user-page">
            {/* 헤더: 검색창 */}
            <div className="user-page-header">
                <UserSearch onQueryChange={handleQueryChange} />
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
        </div>
    );
}