// client/src/pages/UserSearch.jsx

import React, { useEffect, useState } from 'react';
import { searchUsers, sendFriendRequest } from '../api/friendsApi.jsx';
import './UserSearch.css';

function UserSearch() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [message, setMessage] = useState('');

    // 로그인한 사용자 ID 상태
    const [currentUserId, setCurrentUserId] = useState(null);

    // 컴포넌트 마운트 시 localStorage에서 userId (UUID)를 가져옴
    useEffect(() => {
        // LoginPage에서 저장한 'userId' 키를 사용
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setCurrentUserId(storedUserId);
        } else {
            // 로그인 상태가 아니므로 메시지를 표시
            setMessage("로그인 상태가 아닙니다. 로그인이 필요합니다.");
        }
    }, []);

    // 사용자 검색 처리
    const handleSearch = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!searchQuery) {
            setMessage('검색어를 입력해주세요.');
            return;
        }

        if (!currentUserId) {
            setMessage("사용자 ID를 찾을 수 없습니다. 로그인 후 다시 시도해 주세요.");
            return;
        }

        try {
            // API 호출시 currentUSerId도 같이 전달
            const results = await searchUsers(searchQuery, currentUserId);
            console.log("프론트엔드가 받은 최종 데이터 구조:", results);
            setSearchResults(results);
            setMessage(`검색 결과 ${results.length}건.`);
        } catch (error) {
            setMessage(`검색 중 오류 발생: ${error.message}`);
        }
    };

    // 친구 요청 처리
    const handleSendRequest = async (recipientId, username) => {
        setMessage('');

        console.log("요청 전송 시 recipientId (상대방 ID):", recipientId);
        console.log("요청 전송 시 requesterId (내 로그인 ID):", currentUserId);

        // 로그인 ID가 없는 경우 체크
        if (!currentUserId) {
            setMessage("사용자 ID를 찾을 수 없어 요청을 보낼 수 없습니다.");
            return;
        }

        try {
            // API 호출 시 currentUserId를 함께 전달
            await sendFriendRequest(recipientId, currentUserId);
            setMessage(`${username}님에게 친구 요청을 성공적으로 보냈습니다!`);

            // 요청을 보내면 버튼을 요청보냄으로 바꾸는 로직
            setSearchResults(prevResults =>
                prevResults.map(user => {
                    if (user.userId === recipientId) {
                        return { ...user, relationshipStatus: 2 }; // isPending 플래그 설정
                    }
                    return user;
                })
            );

        } catch (error) {
            console.error('친구 요청 오류:', error);
            setMessage(`요청 실패: ${error.message}`);
        }
    };

    return (
        <div className="user-search-container">
            <h2>🔎 사용자 검색</h2>

            <form onSubmit={handleSearch}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="사용자 이름이나 아이디를 입력하세요..."
                />
                <button type="submit" className="btn-search">검색</button> 
            </form>

            {message && <p className="message">{message}</p>}

            <div className="search-results">
                {searchResults.map((user) => (
                    <div key={user.userId} className="user-item">
                        <span className="user-name">
                            {user.username} ({user.userNickname})
                        </span>

                        {user.relationshipStatus === 1 ? ( // 1 : 친구(ACCEPTED)
                            <button disabled className="btn-friend">친구</button>
                        ) : user.relationshipStatus === 2 ? ( // 2: 요청 중 (PENDING)
                            <button disabled className="btn-pending">요청 보냄</button>
                        ) : (
                            <button
                                        onClick={() => handleSendRequest(user.userId, user.username)}
                                className="btn-request"
                            >
                                요청
                            </button>
                        )}
                    </div>
                ))}
                {searchResults.length === 0 && searchQuery && !message.includes('오류') && (
                    <p className="no-results">검색 결과가 없습니다.</p>
                )}
            </div>
        </div>
    );
}

export default UserSearch;