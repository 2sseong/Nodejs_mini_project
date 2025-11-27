// C:\Users\oneonly\Documents\GitHub\Nodejs_mini_project\client\src\components\Friend\FriendList.jsx (최종)

import './FriendList.css';

/**
 * 전체 사용자 목록 또는 검색 결과를 렌더링
 * * @param {Array} users - 전체 사용자 목록 (DB에서 가져온 객체 배열)
 * @param {string} myUserId - 현재 로그인한 사용자의 고유 ID
 * @param {string} searchQuery - FriendPage에서 받은 현재 검색어 (결과 없을 때 메시지 용도)
 * @param {Array<string>} onlineUsers - 소켓에서 받은 온라인 사용자 ID 배열
 * @param {string} filterType - 'ALL' | 'ONLINE' | 'PICK'
 */
export default function FriendList({ users, myUserId, searchQuery, onlineUsers = [] , filterType = 'ALL' }) { 
    
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
            return <p className="empty-list-text">등록된 사용자가 없습니다.</p>
        }
    }
    // 1. 각 user에 isMe / isOnline 플래그 붙이기
    const usersWithFlags = users.map((u) => {
        const idStr = String(u.USER_ID);
        const myIdStr = String(myUserId);

        return {
            ...u,
            isMe: idStr === myIdStr,
            isOnline: onlineUsers.includes(idStr),
        };
    });

    // 2. 필터 타입에 따라 걸러내기
    let filtered = usersWithFlags;

    if (filterType === 'ONLINE'){
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

    // 4. 나를 위로 + 닉네임 오름차순 정렬
    const sorted = [...filtered].sort((a,b) => {
        // 1순위: isMe(내가 맨 위)
        if (a.isMe && !b.isMe) return -1;
        if (!a.isMe && b.isMe) return 1;

        // 2순위: 닉네임 한글 오름차순
        const nicknameA = a.NICKNAME || '';
        const nicknameB = b.NICKNAME || '';
        return nicknameA.localeCompare(nicknameB, 'ko', {sensitivity: 'base'});
    });

    // 검색 결과가 없을 때의 로직
    // if (sortedUsers.length === 0) {
    //     const trimmedQuery = searchQuery ? searchQuery.trim() : '';

    //     if (trimmedQuery.length > 0) {
    //         // 검색어를 입력했는데 결과가 0일 경우
    //         return (
    //             <div className="no-results">
    //                 <p className="no-results-text">"{trimmedQuery}"에 대한 검색 결과가 없습니다</p>
    //                 <p className="suggestion">다른 사용자 이름이나 아이디로 시도해보세요</p>
    //             </div>
    //         );
    //     } else {
    //         // 검색어 없이(초기 로딩 시) 유저가 0명일 경우
    //         return <p className="empty-list-text">등록된 사용자가 없습니다.</p>;
    //     }
    // }


    return (
        <ul className="user-list">
            {sorted.map((user) => {
                const {isMe, isOnline} = user;
                
                return (
                    <li 
                        key={user.USER_ID} 
                        className={`user-list-item ${isMe ? 'user-me' : ''}`}
                        style={{ backgroundColor: isMe ? '#e6f7ff' : 'white', borderLeft: isMe ? '4px solid #1890ff' : 'none' }}
                    >
                        <div className="user-info">
                            <span 
                            className={`status-dot ${isOnline ? 'online' : 'offline'}`} 
                            ></span>
                            <span className="user-nickname">
                                {isMe && <span className="me-tag" style={{ marginLeft: '8px', color: '#6fa9e0ff', fontWeight: 'bold' }}>[나] </span>} 
                                {user.NICKNAME} 
                            </span>
                            <span className="user-username">( {user.USERNAME} )</span>
                        </div>
                        
                        {!isMe && (
                            <div className="friend-actions">
                                <button disabled className="btn-friend">채팅</button> 
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}