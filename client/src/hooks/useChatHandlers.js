import { apiLeaveRoom } from '../api/roomApi.jsx';

export function useChatHandlers({
    socket,
    userId,
    userNickname,
    rooms,
    currentRoomId,
    selectRoom,
    refreshRooms,
    clearMessages
}) {
    
    // 방 나가기 핸들러
    const handleLeaveRoom = async () => {
        const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));
        if (!currentRoomId || !userId || !currentRoom) return false; // 실패

        const confirmLeave = window.confirm(`[${currentRoom.ROOM_NAME}] 방을 정말 나가시겠습니까?`);
        if (!confirmLeave) return false; // 취소됨

        try {
            // 서버 요청 대기
            await apiLeaveRoom(currentRoom.ROOM_ID, userId);
            
            selectRoom(null);
            refreshRooms();
            clearMessages();
            
            alert(`[${currentRoom.ROOM_NAME}] 방에서 성공적으로 나갔습니다.`);
            return true; // [수정] 성공 시 true 반환
        } catch (error) {
            console.error('방 나가기 실패:', error.response?.data || error.message);
            alert(error.response?.data?.message || '서버 오류로 인해 방 나가기에 실패했습니다.');
            return false; // [수정] 실패 시 false 반환
        }
    };

    // 파일 전송 핸들러
    const handleSendFile = ({ fileName, mimeType, fileData }) => {
        if (!socket) return alert('소켓이 연결되지 않았습니다.');
        if (!currentRoomId || !userNickname) {
            console.error('Room ID or User Nickname is missing');
            return alert('파일을 전송할 수 없습니다. (정보 부족)');
        }

        console.log(`Sending file: ${fileName}, mimeType: ${mimeType}`);

        socket.emit('SEND_FILE', {
            roomId: currentRoomId,
            fileName,
            mimeType,
            fileData,
            userNickname: userNickname
        }, (response) => {
            if (!response.ok) {
                console.error('File upload failed:', response.error);
                alert(`파일 업로드 실패: ${response.error}`);
            } else {
                console.log('File upload successful');
            }
        });
    };

    return {
        handleLeaveRoom,
        handleSendFile
    };
}