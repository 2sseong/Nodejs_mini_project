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
    
    // [수정] 방 나가기 핸들러
    // 성공 시 { success: true } 반환, 실패 시 Error를 throw 합니다.
    const handleLeaveRoom = async () => {
        const currentRoom = rooms.find(r => String(r.ROOM_ID) === String(currentRoomId));
        
        // 유효성 검사 실패 시 에러 throw
        if (!currentRoomId || !userId || !currentRoom) {
            throw new Error('방 정보가 유효하지 않습니다.');
        }

        // 주의: 여기서 window.confirm을 호출하지 않습니다.
        // 호출하는 컴포넌트(ChatHeader 등)에서 ConfirmModal을 먼저 띄우고,
        // 사용자가 '확인'을 눌렀을 때만 이 함수를 실행해야 합니다.

        try {
            // 서버 요청 대기
            await apiLeaveRoom(currentRoom.ROOM_ID, userId);
            
            // 상태 초기화
            if (selectRoom) selectRoom(null);
            if (refreshRooms) refreshRooms();
            if (clearMessages) clearMessages();
            
            // 성공 반환 (alert 제거)
            return { success: true, roomName: currentRoom.ROOM_NAME };

        } catch (error) {
            console.error('방 나가기 실패:', error.response?.data || error.message);
            // 에러를 던져서 컴포넌트(ChatHeader 등)가 catch하여 모달을 띄울 수 있게 함
            throw new Error(error.response?.data?.message || '서버 오류로 인해 방 나가기에 실패했습니다.');
        }
    };

    // [수정] 파일 전송 핸들러
    // alert 대신 Promise를 반환하여 호출부에서 처리할 수 있도록 변경
    const handleSendFile = ({ fileName, mimeType, fileData }) => {
        return new Promise((resolve, reject) => {
            if (!socket) {
                return reject(new Error('소켓이 연결되지 않았습니다.'));
            }
            if (!currentRoomId || !userNickname) {
                console.error('Room ID or User Nickname is missing');
                return reject(new Error('파일을 전송할 수 없습니다. (정보 부족)'));
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
                    reject(new Error(`파일 업로드 실패: ${response.error}`));
                } else {
                    console.log('File upload successful');
                    resolve({ success: true });
                }
            });
        });
    };

    return {
        handleLeaveRoom,
        handleSendFile
    };
}