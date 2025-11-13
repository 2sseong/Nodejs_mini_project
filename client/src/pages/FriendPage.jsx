import React, { useState } from 'react';
import FriendRequestList from '../components/Friend/FriendRequestList';
import UserSearch from '../components/Friend/UserSearch.jsx';
import '../styles/FriendPage.css';

export default function FriendPage() {
    return (
        <div className="friend-page">
            <div className="friend-page-header">
                <h1 className="page-title">친구 관리</h1>
                <p className="page-subtitle">친구를 검색하고 요청을 관리하세요</p>
            </div>

            <div className="friend-page-content">
                <section className="friend-section search-section">
                    <div className="section-header">
                        <div className="section-icon">🔍</div>
                        <h2 className="section-title">사용자 검색</h2>
                    </div>
                    <div className="section-content">
                        <UserSearch />
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

                <section className="friend-section list-section">
                    <div className="section-header">
                        <div className="section-icon">👥</div>
                        <h2 className="section-title">내 친구 목록</h2>
                    </div>
                    <div className="section-content">
                        <div className="placeholder-box">
                            <div className="placeholder-icon">✨</div>
                            <p className="placeholder-text">FriendList 컴포넌트가 여기에 표시됩니다</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}