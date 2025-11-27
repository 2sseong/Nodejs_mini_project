import * as messageService from './message.service.js'; // 서비스를 import

// [추가] 검색 API 핸들러
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

// [추가] 문맥 이동 API 핸들러
export async function getMessageContext(req, res, next) {
    try {
        const { roomId, msgId } = req.params; // URL 파라미터 확인 필요 (:roomId, :msgId)
        
        // 서비스 함수 호출
        const messages = await messageService.getMessagesContext({ roomId, msgId });
        
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
        res.json({ success: true, data: messages });
    } catch (e) {
        next(e);
    }
}