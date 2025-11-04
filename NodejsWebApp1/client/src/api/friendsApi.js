// 백엔드 연동 전 더미(나중에수정)
const mockReceivedRequests = [
    { id: 1, requesterId: "dongdong", requesterName: "동동이", status: "PENDING" },
    { id: 2, requesterId: "mangmang", requesterName: "망망이", status: "PENDING" },
];

const mockFriendList = [
    { id: 10, friendUserId: "userB", friendName: "둥둥이" },
    { id: 11, friendUserId: "userC", friendName: "밍밍이" },
];


// 1. 받은 친구 요청 목록 조회 API (GET /api/v1/friends/requests/received)
export const fetchReceivedRequests = () => {
    console.log("Mock API: 받은 친구 요청 목록 조회");
    // 실제 API에서는 axios.get('/api/v1/friends/requests/received') 등을 사용
    return Promise.resolve(mockReceivedRequests);
};

// 2. 친구 요청 수락 API (PATCH /api/v1/friends/requests/:id)
export const acceptFriendRequest = (requestId) => {
    console.log(`Mock API: 요청 ID ${requestId} 수락 처리`);
    // 실제 API에서는 axios.patch(`/api/v1/friends/requests/${requestId}`, { action: 'ACCEPT' }) 등을 사용
    // 성공했다고 가정하고 성공 메시지를 반환
    return Promise.resolve({ success: true, message: "요청이 수락되었습니다." });
};

// 3. 내 친구 목록 조회 API (GET /api/v1/friends)
export const fetchFriendList = () => {
    console.log("Mock API: 내 친구 목록 조회");
    return Promise.resolve(mockFriendList);
};