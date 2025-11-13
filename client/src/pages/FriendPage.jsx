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

    // 2. 검색어 상태 (UserSearch에서 전달받을 값)
    const [searchQuery, setSearchQuery] = useState('');

    // 3. UserSearch에서 폼 제출 시 호출될 핸들러 함수
    const handleQueryChange = (query) => {
        // 입력이 들어올 때마다 searchQuery 상태 업뎃
        setSearchQuery(query.trim());
    };

    // 4. 데이터 페칭 (검색어 변경 시마다 실행)
    useEffect(() => {
        const fetchUserList = async () => {
            setIsLoading(true);
            setError(null);
            
            // 검색어에 따라 쿼리 파라미터 생성: 검색어가 없으면 전체 목록 요청
            const queryParam = searchQuery ? `?query=${searchQuery}` : '';

            try {
            // 통합된 엔드포인트: /users/search + queryParam
                const response = await fetch(`/users/search${queryParam}`); 
                
                if (!response.ok) {
                    throw new Error('사용자 목록을 불러오는 데 실패했습니다.');
                }
                
                const data = await response.json();

                // 서버 응답 형태가 {success: true, users: [...]}라고 쳤을때
                setUserList(data.users || data);
                
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserList();
    }, [searchQuery]); // 검색어(searchQuery)가 바뀔 때마다 이펙트가 재실행

    // 렌더링 시 로딩, 에러 상태 처리
    let listContent;
    
    if (isLoading) {
        listContent = <p className="loading-text">사용자 목록을 불러오는 중...</p>;
    } else if (error) {
        listContent = <p className="error-text">오류: {error}</p>;
    } else {
        // FriendList 컴포넌트에 필요한 prps만 전달
        listContent = (
            <FriendList 
                users={userList} // 불러온 전체 유저 목록
                myUserId={MY_USER_ID} // 로컬 저장소에서 가져온 내 ID
                searchQuery={searchQuery} // 검색어 상태 전달
            />
        );
    }
    
    return (
        <div className="friend-page">
            <div className="friend-page-header">
                <h1 className="page-title">친구 관리</h1>
                <p className="page-subtitle">친구를 검색하고 목록을 관리하세요</p>
            </div>

<div className="friend-page-content">
                
                <section className="friend-section list-section">
                    <div className="section-header">
                        <div className="section-icon">👥</div>
                        <h2 className="section-title">
                            {searchQuery ? `검색 결과 (${userList.length}건)` : '사용자 목록'}
                        </h2>
                    </div>
                    <div className="section-content">
                        {/* UserSearch 컴포넌트를 이 섹션 안으로 이동 */}
                        <UserSearch 
                            onQueryChange={handleQueryChange}             
                        />
                        {listContent} {/* 전체 목록/검색 결과 표시 */}
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
            </div>
        </div>
    );
}