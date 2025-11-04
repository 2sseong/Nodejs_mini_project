// 받은요청목록 - 수락/거절
import React, { useState, useEffect } from 'react';
import { fetchReceivedRequests, acceptFriendRequest } from '../api/friendsApi';

// 이 컴포넌트는 FriendPage.jsx에 포함되어 사용할 예정
function FriendRequestList() {
    // 1. 상태 관리: 요청 목록과 로딩 상태를 저장
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. 데이터 불러오기 함수
    const loadRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            // Mock API 호출 (실제 백엔드 API가 연결될 부분)
            const data = await fetchReceivedRequests();
            setRequests(data);
        } catch (err) {
            console.error("친구 요청 목록 로드 실패:", err);
            setError("친구 요청 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 컴포넌트가 처음 렌더링될 때 한 번만 데이터를 로드
    useEffect(() => {
        loadRequests();
    }, []);

    // 3. 요청 수락 처리 함수
    const handleAccept = async (requestId) => {
        try {
            // 요청 수락 API 호출
            await acceptFriendRequest(requestId);

            // 성공하면 해당 요청을 목록에서 제거. (UI 업데이트)
            setRequests(requests.filter(req => req.id !== requestId));
            alert(`요청 ID ${requestId}가 수락되었습니다.`);

        } catch (err) {
            console.error("요청 수락 실패:", err);
            alert("친구 요청 수락에 실패했습니다.");
        }
    };

    // 4. UI 렌더링
    if (loading) return <div>친구 요청 목록을 불러오는 중...</div>;
    if (error) return <div style={{ color: 'red' }}>에러: {error}</div>;
    if (requests.length === 0) return <div>새로운 친구 요청이 없습니다.</div>;

    return (
        <div className="friend-request-list">
            <h2>?? 받은 친구 요청 ({requests.length})</h2>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {/* map 함수 내에서 직접 아이템을 렌더링 */}
                {requests.map((request) => (
                    <li
                        key={request.id}
                        style={{
                            border: '1px solid #ccc',
                            padding: '10px',
                            margin: '10px 0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        {/* 개별 아이템 UI */}
                        <span>
                            **{request.requesterName}** ({request.requesterId}) 님이 친구를 요청했습니다.
                        </span>
                        <div>
                            <button
                                onClick={() => handleAccept(request.id)}
                                style={{
                                    backgroundColor: 'skyblue',
                                    color: 'white',
                                    marginRight: '5px',
                                    border: 'none',
                                    padding: '5px 10px',
                                    cursor: 'pointer'
                                }}
                            >
                                수락
                            </button>
                            {/* 거절 버튼도 여기에 추가할 수 있음 */}
                            <button
                                style={{
                                    backgroundColor: 'grey',
                                    color: 'white',
                                    border: 'none',
                                    padding: '5px 10px',
                                    cursor: 'pointer'
                                }}
                            >
                                거절
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default FriendRequestList;