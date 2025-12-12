// client/src/hooks/popup/useNotice.js
// 공지사항 로직을 담당하는 커스텀 훅

import { useState, useEffect } from 'react';

/**
 * 채팅방 공지사항 로직
 * @param {Object} params
 * @param {Object} params.socket - 소켓 인스턴스
 * @param {boolean} params.connected - 소켓 연결 상태
 * @param {string} params.roomId - 채팅방 ID
 */
export function useNotice({ socket, connected, roomId }) {
    const [roomNotice, setRoomNotice] = useState(null);
    const [isNoticeVisible, setIsNoticeVisible] = useState(true);

    // 방 입장 시 공지 조회
    useEffect(() => {
        if (!socket || !connected || !roomId) return;
        socket.emit('room:get_notice', { roomId });
    }, [socket, connected, roomId]);

    // 공지 이벤트 리스너
    useEffect(() => {
        if (!socket) return;

        const handleNotice = ({ roomId: rid, notice }) => {
            if (String(rid) === String(roomId)) {
                setRoomNotice(notice);
            }
        };

        const handleNoticeUpdated = ({ roomId: rid, notice }) => {
            if (String(rid) === String(roomId)) {
                setRoomNotice(notice);
            }
        };

        socket.on('room:notice', handleNotice);
        socket.on('room:notice_updated', handleNoticeUpdated);

        return () => {
            socket.off('room:notice', handleNotice);
            socket.off('room:notice_updated', handleNoticeUpdated);
        };
    }, [socket, roomId]);

    // 공지 설정 핸들러
    const handleSetNotice = (msgId, content) => {
        if (socket && roomId) {
            socket.emit('room:set_notice', { roomId, msgId, content });
        }
    };

    return {
        roomNotice,
        isNoticeVisible,
        setIsNoticeVisible,
        handleSetNotice
    };
}
