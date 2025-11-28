// C:\Users\oneonly\Documents\GitHub\Nodejs_mini_project\client\src\components\Friend\FriendList.jsx

import React from 'react';
import './FriendList.css';

// 개별 사용자 아이템 컴포넌트 (useState를 안전하게 사용하기 위해 분리)
function UserItem({ user, myUserId }) {
    const { isMe, isOnline } = user;
    const [isPicked, setIsPicked] = React.useState(false);

    return (
        <li
            key={user.userId}
            className={`user-list-item ${isMe ? 'user-me' : ''}`}
            style={{ backgroundColor: isMe ? '#e6f7ff' : 'white', borderLeft: isMe ? '4px solid #1890ff' : 'none' }}
        >
            <div className="user-info">
                <div className="user-name-row">
                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                    <span className="user-nickname">
                        {isMe && <span className="me-tag" style={{ marginLeft: '8px', color: '#6fa9e0ff', fontWeight: 'bold' }}>[나] </span>}
                        {user.userNickname}
                    </span>
                    {!isMe && (
                        <button
                            className={`btn-pick ${isPicked ? 'active' : ''}`}
                            onClick={() => setIsPicked(!isPicked)}
                        >
                            <i className={isPicked ? 'fas fa-star' : 'far fa-star'}></i>
                        </button>
                    )}
                </div>
                <span className="user-username">( {user.username} )</span>
            </div>

            {!isMe && (
                <div className="friend-actions">
                    <button disabled className="btn-friend">채팅</button>
                </div>
            )}
        </li>
    );
}

/**
 * 전체 사용자 목록 또는 검색 결과를 렌더링
 * @param {Array} users - 전체 사용자 목록 (DB에서 가져온 객체 배열)
 * @param {string} myUserId - 현재 로그인한 사용자의 고유 ID
 * @param {string} searchQuery - FriendPage에서 받은 현재 검색어 (결과 없을 때 메시지 용도)
 * @param {Array<string>} onlineUsers - 소켓에서 받은 온라인 사용자 ID 배열
 * @param {string} filterType - 'ALL' | 'ONLINE' | 'PICK'
 */
export default function FriendList({ users, myUserId, searchQuery, onlineUsers = [], filterType = 'ALL' }) {

    // 0. 전체 유저 자체가 없을 때 (검색 결과 0)
    if (!users || users.length === 0) {
        const trimmedQuery = searchQuery ? searchQuery.trim() : '';
        if (trimmedQuery.length > 0) {
            return (
                <div className="no-results">
                    <p className="no-results-text">
                        {`"${trimmedQuery}"에 대한 검색 결과가 없습니다`}
                    </p>
                    <p className="suggestion">
                        다른 사용자 이름이나 아이디로 시도해보세요
                    </p>
                </div>
            );
        } else {
            return <p className="empty-list-text">등록된 사용자가 없습니다.</p>;
        }
    }
    // 1. 각 user에 isMe / isOnline 플래그 붙이기
    const usersWithFlags = users.map((u) => ({
        ...u,
        isMe: String(u.userId) === String(myUserId),
        isOnline: onlineUsers.includes(String(u.userId)),
    }));

    // 2. 필터 타입에 따라 걸러내기
    let filtered = usersWithFlags;

    if (filterType === 'ONLINE') {
        filtered = usersWithFlags.filter((u) => u.isOnline);
    } else if (filterType === 'PICK') {
        filtered = usersWithFlags.filter((u) => u.IS_PICK);
    }

    // 3. 필터 결과가 비어있을 때 (전체 유저는 있으나 필터 조건에 맞는 사람이 없음)
    if (filtered.length === 0) {
        if (filterType === 'ONLINE') {
            return <p className='empty-list-text'>현재 접속중인 사용자가 없습니다.</p>
        }
        if (filterType === 'PICK') {
            return <p className='empty-list-text'>즐겨찾기한 사용자가 없습니다.</p>
        }
    }


    return (
        <ul className="user-list">
            {filtered.map((user) => (
                <UserItem key={user.userId} user={user} myUserId={myUserId} />
            ))}
        </ul>
    );
}