// FriendRequestList 넣고 친구목록, 검색 컴포넌트 넣을 것

import React from 'react';
import FriendRequestList from '../components/FriendRequestList'; // 요청 목록 컴포넌트



export default function FriendPage() {
    return (
        <div className="friend-management-container" style={{ padding: '20px' }}>
            <h1>친구 관리 페이지</h1>

            {/* ---------------------------------------------------- */}
            {/* 1. 사용자 검색 및 요청 보내기 영역 (UserSearch 컴포넌트 자리) */}
            <section className="search-section" style={{ marginBottom: '40px', border: '1px solid #ddd', padding: '20px' }}>
                <h2>사용자 검색 및 친구 요청</h2>
                {/* 여기에 UserSearch.jsx 컴포넌트 나중에 넣기
                   이 컴포넌트는 사용자를 검색하고 친구 요청 (POST)을 보냄
                */}
                <div style={{ backgroundColor: '#f9f9f9', padding: '15px', textAlign: 'center' }}>
                    [UserSearch.jsx 컴포넌트 들어갈 자리!!!]
                </div>
            </section>

            {/* ---------------------------------------------------- */}
            {/* 2. 받은 친구 요청 목록 영역 */}
            <section className="request-section" style={{ marginBottom: '40px', border: '1px solid #ddd', padding: '20px' }}>
                {/* FriendRequestList 컴포넌트 렌더링 */}
                <FriendRequestList />
            </section>

            {/* ---------------------------------------------------- */}
            {/* 3. 최종 친구 목록 영역 (FriendList 컴포넌트 자리) */}
            <section className="list-section" style={{ border: '1px solid #ddd', padding: '20px' }}>
                <h2>? 내 친구 목록</h2>
                {/* 여기에 FriendList.jsx 컴포넌트가 들어갈 예정
                   이 컴포넌트는 ACCEPTED 상태의 친구들을 보여줌
                */}
                <div style={{ backgroundColor: '#f9f9f9', padding: '15px', textAlign: 'center' }}>
                    [여기에 FriendList.jsx 컴포넌트 들어갈 자리!!!]
                </div>
            </section>
        </div>
    );
}

