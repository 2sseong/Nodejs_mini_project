import React, { useState, useEffect } from 'react';
import FriendRequestList from '../components/Friend/FriendRequestList';
import UserSearch from '../components/Friend/UserSearch.jsx';
import FriendList from '../components/Friend/FriendList.jsx';
import '../styles/FriendPage.css';

const MY_USER_ID = localStorage.getItem('userId');

export default function FriendPage() {
    // 1. 유저 목록 상태 관리
    const [userList, setUserList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. 컴포넌트가 마운트될 때 유저 목록 불러오기
    useEffect(() => {
        const fetchUserList = async () => {
            try {
                // 이전 단계에서 정의한 HTTP API 경로로 요청
                const response = await fetch('/api/users/list'); 
                
                if (!response.ok) {
                    throw new Error('사용자 목록을 불러오는 데 실패했습니다.');
                }
                
                const data = await response.json();
                setUserList(data);
                
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserList();
    }, []); // 👈 빈 배열: 컴포넌트가 처음 로드될 때만 실행

    // 3. 렌더링 시 로딩, 에러 상태 처리
    let listContent;
    
    if (isLoading) {
        listContent = <p className="loading-text">사용자 목록을 불러오는 중...</p>;
    } else if (error) {
        listContent = <p className="error-text">오류: {error}</p>;
    } else {
        // 4. FriendList 컴포넌트에 데이터와 내 ID 전달
        listContent = (
            <FriendList 
                users={userList} // 👈 불러온 전체 유저 목록
                myUserId={MY_USER_ID} // 👈 로컬 저장소에서 가져온 내 ID
            />
        );
    }
    
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