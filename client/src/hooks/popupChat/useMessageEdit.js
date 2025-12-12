// client/src/hooks/popup/useMessageEdit.js
// 메시지 수정 로직을 담당하는 커스텀 훅

import { useState } from 'react';

/**
 * 메시지 수정 로직
 * @param {Function} editMessage - 메시지 수정 함수 (useChatSocket에서 제공)
 */
export function useMessageEdit(editMessage) {
    const [editingMessage, setEditingMessage] = useState(null); // { msgId, content }

    // 수정 시작 핸들러 (MessageItem에서 호출)
    const handleStartEdit = ({ msgId, content }) => {
        setEditingMessage({ msgId, content });
    };

    // 수정 취소 핸들러
    const handleCancelEdit = () => {
        setEditingMessage(null);
    };

    // 수정 저장 핸들러
    const handleSaveEdit = (msgId, newContent) => {
        if (editMessage) {
            editMessage(msgId, newContent);
        }
        setEditingMessage(null);
    };

    return {
        editingMessage,
        handleStartEdit,
        handleCancelEdit,
        handleSaveEdit
    };
}
