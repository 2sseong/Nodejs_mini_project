// C:\Users\oneonly\Documents\GitHub\Nodejs_mini_project\client\src\components\Friend\FriendList.jsx (최종)

import React, { useState } from 'react';
import './FriendList.css';

/**
 * 전체 사용자 목록 또는 검색 결과를 렌더링
 * * @param {Array} users - 전체 사용자 목록 (DB에서 가져온 객체 배열)
 * @param {string} myUserId - 현재 로그인한 사용자의 고유 ID
 * @param {string} searchQuery - FriendPage에서 받은 현재 검색어 (결과 없을 때 메시지 용도)
 */
export default function FriendList({ users, myUserId, searchQuery, onlineUsers }) { 
    
    
    // 1. 나 자신을 목록 맨 위로 올리기 위해 정렬
    const sortedUsers = [...users].sort((a, b) => {
        if (a.USER_ID === myUserId) return -1; 
        if (b.USER_ID === myUserId) return 1;  
        return 0; 
    });

    // 2. 검색 결과가 없을 때의 로직
    if (sortedUsers.length === 0) {
        const trimmedQuery = searchQuery ? searchQuery.trim() : '';

        if (trimmedQuery.length > 0) {
            // 검색어를 입력했는데 결과가 0일 경우
            return (
                <div className="no-results">
                    <p className="no-results-text">"{trimmedQuery}"에 대한 검색 결과가 없습니다. 😭</p>
                    <p className="suggestion">다른 사용자 이름이나 아이디로 시도해보세요.</p>
                </div>
            );
        } else {
            // 검색어 없이(초기 로딩 시) 유저가 0명일 경우
            return <p className="empty-list-text">등록된 사용자가 없습니다.</p>;
        }
    }

    return (
        <ul className="user-list">
            {sortedUsers.map((user) => {
                const isMe = user.USER_ID === myUserId;
                const isOnline = onlineUsers.includes(String(user.USER_ID));
                
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