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

        // [수정] confirm 창을 띄우기 전에 현재 버튼에 잡힌 포커스를 해제합니다.
        // 이렇게 해야 취소 후 키보드 입력 시 입력창이나 윈도우로 포커스가 자연스럽게 돌아갑니다.
        if (document.activeElement && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        // 포커스 해제가 UI에 반영될 시간을 아주 잠깐 줍니다.
        await new Promise(resolve => setTimeout(resolve, 0));

        const confirmLeave = window.confirm(`[${currentRoom.ROOM_NAME}] 방을 정말 나가시겠습니까?`);
        if (!confirmLeave) return false; // 취소됨

        try {
            // 서버 요청 대기
            await apiLeaveRoom(currentRoom.ROOM_ID, userId);
            
            selectRoom(null);
            refreshRooms();
            clearMessages();
            
            alert(`[${currentRoom.ROOM_NAME}] 방에서 성공적으로 나갔습니다.`);
            return true; // 성공 시 true 반환
        } catch (error) {
            console.error('방 나가기 실패:', error.response?.data || error.message);
            alert(error.response?.data?.message || '서버 오류로 인해 방 나가기에 실패했습니다.');
            return false; // 실패 시 false 반환
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