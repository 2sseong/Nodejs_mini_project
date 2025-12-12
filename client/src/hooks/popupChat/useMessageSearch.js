// client/src/hooks/popup/useMessageSearch.js
// 메시지 검색 로직을 담당하는 커스텀 훅

import { useState, useRef, useEffect } from 'react';
import { searchMessagesApi, getMessagesContextApi } from '../../api/chatApi';

/**
 * 메시지 검색 로직
 * @param {Object} params
 * @param {string} params.roomId - 채팅방 ID
 * @param {Array} params.messages - 메시지 배열
 * @param {Function} params.overrideMessages - 메시지 덮어쓰기 함수
 */
export function useMessageSearch({ roomId, messages, overrideMessages }) {
    const [searchMatches, setSearchMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [scrollToMsgId, setScrollToMsgId] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const lastSearchReqId = useRef(0);

    // 검색 실행
    const handleServerSearch = async (keyword) => {
        setSearchKeyword(keyword);

        if (!keyword.trim()) {
            setSearchMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        const reqId = Date.now();
        lastSearchReqId.current = reqId;

        try {
            const response = await searchMessagesApi(roomId, keyword);

            if (lastSearchReqId.current !== reqId) return;

            const matches = response.data?.data || [];
            setSearchMatches(matches);

            if (matches.length > 0) {
                setCurrentMatchIndex(matches.length - 1);
            } else {
                setCurrentMatchIndex(-1);
            }
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    // 검색 결과로 이동
    useEffect(() => {
        const moveToMatch = async () => {
            if (currentMatchIndex < 0 || searchMatches.length === 0 || currentMatchIndex >= searchMatches.length) return;

            const target = searchMatches[currentMatchIndex];
            if (!target) return;

            const targetId = target.MSG_ID || target.msg_id;
            const isAlreadyLoaded = messages.some(m =>
                String(m.MSG_ID || m.msg_id) === String(targetId)
            );

            if (isAlreadyLoaded) {
                setScrollToMsgId(targetId);
            } else {
                try {
                    const response = await getMessagesContextApi(roomId, targetId);
                    const newContextMessages = response.data?.data || [];

                    if (overrideMessages) {
                        overrideMessages(newContextMessages);
                    }

                    setTimeout(() => {
                        setScrollToMsgId(targetId);
                    }, 100);

                } catch (err) {
                    console.error("Failed to fetch context:", err);
                }
            }
        };
        moveToMatch();
    }, [currentMatchIndex, searchMatches, messages, roomId, overrideMessages]);

    // 이전 검색 결과
    const handlePrevMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev - 1 < 0 ? searchMatches.length - 1 : prev - 1));
    };

    // 다음 검색 결과
    const handleNextMatch = () => {
        if (searchMatches.length === 0) return;
        setCurrentMatchIndex(prev => (prev + 1 >= searchMatches.length ? 0 : prev + 1));
    };

    // 스크롤 완료 후 초기화
    const clearScrollToMsgId = () => {
        setScrollToMsgId(null);
    };

    return {
        searchMatches,
        currentMatchIndex,
        scrollToMsgId,
        searchKeyword,
        handleServerSearch,
        handlePrevMatch,
        handleNextMatch,
        clearScrollToMsgId
    };
}
