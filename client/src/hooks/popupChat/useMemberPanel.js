// client/src/hooks/popup/useMemberPanel.js
// 멤버 패널 로직을 담당하는 커스텀 훅

import { useState } from 'react';
import { apiGetRoomMembers } from '../../api/roomApi';

/**
 * 멤버 패널 로직
 * @param {string} roomId - 채팅방 ID
 */
export function useMemberPanel(roomId) {
    const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // 멤버 패널 토글
    const handleToggleMemberPanel = async () => {
        if (isMemberPanelOpen) {
            setIsMemberPanelOpen(false);
            return;
        }

        setLoadingMembers(true);
        setIsMemberPanelOpen(true);
        try {
            const res = await apiGetRoomMembers(roomId);
            if (res.data?.success) {
                setMembers(res.data.members || []);
            }
        } catch (error) {
            console.error('멤버 목록 조회 실패:', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    // 멤버 패널 닫기
    const closeMemberPanel = () => {
        setIsMemberPanelOpen(false);
    };

    return {
        isMemberPanelOpen,
        members,
        loadingMembers,
        handleToggleMemberPanel,
        closeMemberPanel
    };
}
