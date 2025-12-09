// C:\Users\oneonly\Documents\GitHub\Nodejs_mini_project\client\src\components\Friend\FriendList.jsx

import React, { useState } from 'react';
import './UserList.css';
import DefaultAvatar from '../../assets/default-avatar.png';

// 이미지가 저장된 서버 URL
const IMAGE_BASE_URL = 'http://localhost:1337'; // 백엔드 서버 주소

// 개별 사용자 아이템 컴포넌트
function UserItem({ user, isOnline, onTogglePick, onStartChat }) {
    // user 객체에서 isMe 속성 추출(현재 로그인 사용자 여부)
    const { isMe } = user;
    // user 객체에서 isPick 속성 추출(즐겨찾기 여부)
    const isPicked = user.isPick === 1;
    // 프로필 이미지 URL 생성
    const profileImageUrl = user.profilePic ? `${IMAGE_BASE_URL}${user.profilePic}` : DefaultAvatar;

    // 즐겨찾기 토글 핸들러
    const handlePickClick = () => {
        // 현재 사용자가 자신이면 즐겨찾기 토글을 할 수 없음
        if (isMe) return;
        onTogglePick(user.userId, isPicked);
    };

    // 채팅 버튼 클릭 핸들러
    const handleChatClick = () => {
        if (isMe) return;
        // UserPage.jsx의 handleStartChat 함수 호출
        onStartChat(user);
    };

    return (
        <li
            key={user.userId}
            className={`user-list-item ${isMe ? 'user-me' : ''}`}
            style={{ backgroundColor: isMe ? '#e6f7ff' : 'white', borderLeft: isMe ? '4px solid #1890ff' : 'none' }}
        >
            {/* 프로필사진 렌더링 영역 */}
            <img
                src={profileImageUrl}
                alt={`${user.userNickname} 프로필 사진`}
                className="profile-pic"

                // 로딩 오류 처리
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = DefaultAvatar;
                }}
            />
            <div className="user-info">
                <div className="user-name-row">
                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                    <span className="user-nickname">
                        {isMe && <span className="me-tag" style={{ marginRight: '8px', color: '#6fa9e0ff', fontWeight: 'bold' }}>[나] </span>}
                        {user.userNickname}
                    </span>
                    {!isMe && (
                        <button
                            className={`btn-pick ${isPicked ? 'active' : ''}`}
                            onClick={handlePickClick}
                            title={isPicked ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        >
                            <i className={isPicked ? 'bi bi-star-fill' : 'bi bi-star'}></i>
                        </button>
                    )}
                </div>
                {(user.department || user.position) && (
                    <div className="user-details">
                        <span className="user-dept-position">
                            {user.department && user.position
                                ? `${user.department} / ${user.position}`
                                : user.department || user.position
                            }
                        </span>
                    </div>
                )}
                <span className="user-username">( {user.username} )</span>
            </div>

            {/* 채팅 버튼 활성화 및 핸들러 연결 */}
            {!isMe && (
                <div className="friend-actions">
                    <button
                        className="btn-chat"
                        onClick={handleChatClick} // 클릭 핸들러 연결
                        title="1:1 채팅"
                    >
                        <i className="bi bi-chat-dots-fill"></i>
                    </button>
                </div>
            )}
        </li>
    );
}

// 부서별 섹션 컴포넌트
function DepartmentSection({ department, users, myUserId, onlineUsers, onTogglePick, onStartChat }) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="department-section">
            <div className="department-header" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="expand-icon"><i className={isExpanded ? 'bi bi-chevron-down' : 'bi bi-chevron-right'}></i></span>
                <span className="department-name">{department || '미배정'}</span>
                <span className="user-count">({users.length}명)</span>
            </div>
            {isExpanded && (
                <ul className="user-list">
                    {users.map((user) => (
                        <UserItem
                            key={user.userId}
                            user={user}
                            myUserId={myUserId}
                            isOnline={onlineUsers.includes(String(user.userId))}
                            onTogglePick={onTogglePick}
                            onStartChat={onStartChat}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * 전체 사용자 목록 또는 검색 결과를 렌더링
 * @param {Array} users - 전체 사용자 목록 (DB에서 가져온 객체 배열)
 * @param {string} myUserId - 현재 로그인한 사용자의 고유 ID
 * @param {string} searchQuery - FriendPage에서 받은 현재 검색어 (결과 없을 때 메시지 용도)
 * @param {Array<string>} onlineUsers - 소켓에서 받은 온라인 사용자 ID 배열
 * @param {string} filterType - 'ALL' | 'ONLINE' | 'PICK'
 * @param {Function} onTogglePick - 즐겨찾기 토글 핸들러 함수
 * @param {Function} onStartChat - 1:1 채팅 시작 핸들러 함수 (UserPage.jsx에서 전달됨)
 */
export default function UserList({ users, myUserId, searchQuery, onlineUsers = [], filterType = 'ALL', onTogglePick, onStartChat }) {

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
        // department와 position 필드 추가 (대소문자 통일)
        department: u.DEPARTMENT || u.department,
        position: u.POSITION || u.position,
    }));

    // 2. 필터 타입에 따라 걸러내기
    let filtered = usersWithFlags;

    if (filterType === 'ONLINE') {
        filtered = usersWithFlags.filter((u) => u.isOnline);
    } else if (filterType === 'PICK') {
        filtered = usersWithFlags.filter((u) => u.isPick === 1);
    }

    // '나' 자신은 필터링 조건과 관계없이 항상 목록의 맨 위에 표시되도록 finalFiltered를 구성
    const finalFiltered = usersWithFlags.filter(u =>
        u.isMe || (filterType === 'ALL' ? true : filtered.includes(u))
    );

    // 3. 필터 결과가 비어있을 때 (전체 유저는 있으나 필터 조건에 맞는 사람이 없음)
    if (filtered.length === 0) {
        if (filterType === 'ONLINE') {
            return <p className='empty-list-text'>현재 접속중인 사용자가 없습니다.</p>
        }
        if (filterType === 'PICK') {
            return <p className='empty-list-text'>즐겨찾기한 사용자가 없습니다.</p>
        }
    }

    // 4. 부서별로 그룹화
    const groupedByDepartment = {};

    // '나' 자신을 먼저 처리
    const me = finalFiltered.find(u => u.isMe);
    const others = finalFiltered.filter(u => !u.isMe);

    // 다른 사용자들을 부서별로 그룹화
    others.forEach(user => {
        const dept = user.department || '미배정';
        if (!groupedByDepartment[dept]) {
            groupedByDepartment[dept] = [];
        }
        groupedByDepartment[dept].push(user);
    });

    // 부서명 정렬 (한글 오름차순)
    const sortedDepartments = Object.keys(groupedByDepartment).sort((a, b) =>
        a.localeCompare(b, 'ko', { sensitivity: 'base' })
    );

    return (
        <div className="friend-list-container">
            {/* 나 자신을 맨 위에 표시 */}
            {me && (
                <div className="my-profile-section">
                    <ul className="user-list">
                        <UserItem
                            key={me.userId}
                            user={me}
                            myUserId={myUserId}
                            isOnline={me.isOnline}
                            onTogglePick={onTogglePick}
                            onStartChat={onStartChat} // onStartChat prop 전달
                        />
                    </ul>
                </div>
            )}

            {/* 부서별로 그룹화된 사용자 목록 */}
            {sortedDepartments.map(department => (
                <DepartmentSection
                    key={department}
                    department={department}
                    users={groupedByDepartment[department]}
                    myUserId={myUserId}
                    onlineUsers={onlineUsers}
                    onTogglePick={onTogglePick}
                    onStartChat={onStartChat} // onStartChat prop 전달
                />
            ))}
        </div>
    );
}