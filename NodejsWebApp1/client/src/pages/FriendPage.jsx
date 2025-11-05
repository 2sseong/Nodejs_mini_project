import React, { useState } from 'react';
import FriendRequestList from '../components/FriendRequestList';
import UserSearch from '../components/UserSearch.jsx';
// import '/FriendPage.css';

export default function FriendPage() {

    return (

        <div className="friend-management-container">
            <h1>친구 관리 페이지</h1>

            <section className="search-section">
                <h2>사용자 검색 및 친구 요청</h2>
                <UserSearch />
            </section>

            <section className="request-section">
                <FriendRequestList />
            </section>

            <section className="list-section">
                <h2>내 친구 목록</h2>
                <div style={{ backgroundColor: '#f9f9f9', padding: '15px', textAlign: 'center' }}>
                    [여기에 FriendList.jsx 컴포넌트 들어갈 자리!!!]
                </div>
            </section>
        </div>
    );
}