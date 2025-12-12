// client/src/hooks/popup/useReadStatus.js
// 읽음 처리 로직을 담당하는 커스텀 훅

import { useEffect, useRef } from 'react';

/**
 * 채팅방 읽음 처리 로직
 * @param {Object} params
 * @param {Object} params.socket - 소켓 인스턴스
 * @param {boolean} params.connected - 소켓 연결 상태
 * @param {string} params.roomId - 채팅방 ID
 * @param {string} params.userId - 사용자 ID
 */
export function useReadStatus({ socket, connected, roomId, userId }) {
    // 윈도우 포커스 상태 추적
    const isWindowFocusedRef = useRef(document.hasFocus());
    // 쓰로틀링(3초 제한) 기준 시간
    const lastFocusTimeRef = useRef(0);
    // 화면이 꺼진 동안 메시지가 왔는지 체크
    const hasUnreadSinceLastFocusRef = useRef(false);

    // [통합 함수] 서버로 읽음 처리 요청 전송
    const sendMarkAsRead = (triggerSource) => {
        const now = Date.now();

        // '포커스 이벤트'일 때만 쓰로틀링 로직을 적용
        if (triggerSource === 'FOCUS_EVENT') {
            if (!hasUnreadSinceLastFocusRef.current) {
                if (now - lastFocusTimeRef.current < 3000) return;
            }
        }

        if (socket && connected && roomId) {
            socket.emit('chat:mark_as_read', {
                roomId,
                lastReadTimestamp: now
            });
            lastFocusTimeRef.current = now;
            hasUnreadSinceLastFocusRef.current = false;
        }
    };

    // A. 윈도우 포커스 감지 (딴짓하다가 돌아왔을 때 처리)
    useEffect(() => {
        const handleFocus = () => {
            isWindowFocusedRef.current = true;
            sendMarkAsRead('FOCUS_EVENT');
        };
        const handleBlur = () => {
            isWindowFocusedRef.current = false;
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        // 초기 진입 시 이미 포커스 상태라면 즉시 요청
        if (document.hasFocus()) {
            sendMarkAsRead('FOCUS_EVENT');
        }

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, [roomId, socket, connected]);

    // B. 실시간 메시지 수신 감지 (화면 보고 있을 때 처리)
    useEffect(() => {
        if (!socket || !connected) return;

        const handleNewMessage = (msg) => {
            if (String(msg.ROOM_ID) === String(roomId) && msg.SENDER_ID !== userId) {
                if (isWindowFocusedRef.current) {
                    sendMarkAsRead('NEW_MESSAGE');
                } else {
                    hasUnreadSinceLastFocusRef.current = true;
                }
            }
        };

        socket.on('chat:message', handleNewMessage);

        return () => {
            socket.off('chat:message', handleNewMessage);
        };
    }, [socket, connected, roomId, userId]);

    return { sendMarkAsRead };
}
