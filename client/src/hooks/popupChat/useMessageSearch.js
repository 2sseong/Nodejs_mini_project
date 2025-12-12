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

    // 현재 로드된 메시지 ID 집합 (빠른 조회용)
    const loadedMsgIdsRef = useRef(new Set());

    // messages 변경 시 로드된 ID 집합 업데이트
    useEffect(() => {
        loadedMsgIdsRef.current = new Set(
            messages.map(m => String(m.MSG_ID || m.msg_id))
        );
    }, [messages]);

    // 검색 결과로 이동 (messages 의존성 제거)
    useEffect(() => {
        const moveToMatch = async () => {
            if (currentMatchIndex < 0 || searchMatches.length === 0 || currentMatchIndex >= searchMatches.length) return;

            const target = searchMatches[currentMatchIndex];
            if (!target) return;

            const targetId = String(target.MSG_ID || target.msg_id);
            const isAlreadyLoaded = loadedMsgIdsRef.current.has(targetId);

            // 먼저 null로 초기화하여 동일 ID 재설정 시에도 React가 변화를 감지하도록 함
            setScrollToMsgId(null);

            if (isAlreadyLoaded) {
                // setTimeout으로 다음 렌더 사이클에서 설정
                setTimeout(() => {
                    setScrollToMsgId(targetId);
                }, 10);
            } else {
                try {
                    const response = await getMessagesContextApi(roomId, targetId);
                    const newContextMessages = response.data?.data || [];

                    if (overrideMessages) {
                        overrideMessages(newContextMessages);
                    }

                    setTimeout(() => {
                        setScrollToMsgId(targetId);
                    }, 150);

                } catch (err) {
                    console.error("Failed to fetch context:", err);
                }
            }
        };
        moveToMatch();
    }, [currentMatchIndex, searchMatches, roomId, overrideMessages]);

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
