import * as messageService from './message.service.js'; // 서비스를 import

// 검색 API 핸들러
export async function searchRoomMessages(req, res, next) {
    try {
        const { roomId } = req.params;
        const { keyword } = req.query;

        // 서비스 함수 호출
        const results = await messageService.searchMessages({ roomId, keyword });

        res.json({ success: true, data: results });
    } catch (e) {
        next(e);
    }
}

// 문맥 이동 API 핸들러
export async function getMessageContext(req, res, next) {
    try {
        const { roomId, msgId } = req.params; // URL 파라미터 확인 필요 (:roomId, :msgId)

        // 서비스 함수 호출
        const messages = await messageService.getMessagesContext({ roomId, msgId });

        // 디버깅: 첫 번째 메시지의 unreadCount 확인
        if (messages && messages.length > 0) {
            console.log('[getMessageContext] First message sample:', {
                MSG_ID: messages[0].MSG_ID,
                unreadCount: messages[0].unreadCount
            });
        }

        res.json({ success: true, data: messages });
    } catch (e) {
        next(e);
    }
}

// 메시지 아래로 스크롤
export async function getNewerMessages(req, res, next) {
    try {
        const { roomId, msgId } = req.params;
        const messages = await messageService.getNewerMessages({ roomId, msgId });

        // 디버깅: 첫 번째와 마지막 메시지의 unreadCount 확인
        if (messages && messages.length > 0) {
            console.log('[getNewerMessages] First msg:', { MSG_ID: messages[0].MSG_ID, unreadCount: messages[0].unreadCount });
            console.log('[getNewerMessages] Last msg:', { MSG_ID: messages[messages.length - 1].MSG_ID, unreadCount: messages[messages.length - 1].unreadCount });
        }

        res.json({ success: true, data: messages });
    } catch (e) {
        next(e);
    }
}

// 채팅방 파일 목록 조회 API 핸들러
export async function getRoomFiles(req, res, next) {
    try {
        const { roomId } = req.params;
        const files = await messageService.getRoomFiles({ roomId });
        res.json({ success: true, data: files });
    } catch (e) {
        next(e);
    }
}