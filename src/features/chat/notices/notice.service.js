import * as noticeRepo from './notice.repository.js';

// 공지 설정
export async function setNotice({ roomId, msgId, content, userId }) {
    await noticeRepo.createNotice(roomId, msgId, content, userId);
    return await noticeRepo.getActiveNotice(roomId);
}

// 공지 조회
export async function getNotice({ roomId }) {
    return await noticeRepo.getActiveNotice(roomId);
}

// 공지 해제
export async function clearNotice({ roomId }) {
    await noticeRepo.deactivateNotice(roomId);
    return true;
}

// 전체 공지 목록 조회
export async function getAllNotices({ roomId }) {
    return await noticeRepo.getAllNotices(roomId);
}

// 개별 공지 삭제
export async function deleteNotice({ noticeId }) {
    await noticeRepo.deleteNotice(noticeId);
    return true;
}
