// client/src/hooks/popup/useRoomNotification.js
// 채팅방 알림 설정 로직을 담당하는 커스텀 훅

import { useState, useEffect } from 'react';
import { apiGetNotificationSetting, apiSetNotificationSetting } from '../../api/roomApi';

/**
 * 채팅방 알림 설정 로직
 * @param {Object} params
 * @param {Object} params.socket - 소켓 인스턴스
 * @param {string} params.roomId - 채팅방 ID
 * @param {string} params.userId - 사용자 ID
 */
export function useRoomNotification({ socket, roomId, userId }) {
    const [isRoomNotificationEnabled, setIsRoomNotificationEnabled] = useState(true);

    // 채팅방 알림 상태 조회
    useEffect(() => {
        if (roomId) {
            apiGetNotificationSetting(roomId)
                .then(res => {
                    if (res.data?.success) {
                        setIsRoomNotificationEnabled(res.data.enabled);
                    }
                })
                .catch(err => console.error('알림 설정 조회 실패:', err));
        }
    }, [roomId]);

    // 다른 창에서 알림 설정 변경 시 현재 창 상태 갱신
    useEffect(() => {
        if (!socket) return;
        const handleNotificationUpdated = ({ roomId: updatedRoomId, enabled }) => {
            if (String(updatedRoomId) === String(roomId)) {
                setIsRoomNotificationEnabled(enabled);
            }
        };
        socket.on('room:notification_updated', handleNotificationUpdated);
        return () => socket.off('room:notification_updated', handleNotificationUpdated);
    }, [socket, roomId]);

    // 채팅방 알림 토글 핸들러
    const handleToggleRoomNotification = async () => {
        const newEnabled = !isRoomNotificationEnabled;
        try {
            const res = await apiSetNotificationSetting(roomId, newEnabled);
            if (res.data?.success) {
                setIsRoomNotificationEnabled(newEnabled);
                if (socket) {
                    socket.emit('room:notification_changed', { roomId, enabled: newEnabled, userId });
                }
            }
        } catch (err) {
            console.error('알림 설정 변경 실패:', err);
        }
    };

    return {
        isRoomNotificationEnabled,
        handleToggleRoomNotification
    };
}
