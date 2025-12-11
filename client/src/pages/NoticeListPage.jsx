import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import Titlebar from '../components/Titlebar/Titlebar.jsx';
import ConfirmModal from '../components/Chatpage/Modals/ConfirmModal';
import '../styles/NoticeListPage.css';

export default function NoticeListPage() {
    const { roomId } = useParams();
    const { userId, userNickname } = useAuth();
    const { socket, connected } = useChatSocket({ userId, userNickname, roomId });

    const [notices, setNotices] = useState([]);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    // 소켓 연결 시 room 채널에 join
    useEffect(() => {
        if (!socket || !connected || !roomId) return;

        socket.emit('room:join', { roomId });

        return () => {
            socket.emit('room:leave', { roomId });
        };
    }, [socket, connected, roomId]);

    // 공지 목록 요청
    useEffect(() => {
        if (!socket || !connected || !roomId) return;

        socket.emit('room:get_all_notices', { roomId });
    }, [socket, connected, roomId]);

    // 공지 목록 수신
    useEffect(() => {
        if (!socket) return;

        const handleAllNotices = ({ roomId: rid, notices: list }) => {
            if (String(rid) === String(roomId)) {
                setNotices(list || []);
            }
        };

        socket.on('room:all_notices', handleAllNotices);

        return () => {
            socket.off('room:all_notices', handleAllNotices);
        };
    }, [socket, roomId]);

    const handleNoticeClick = (notice) => {
        setSelectedNotice(selectedNotice?.NOTICE_ID === notice.NOTICE_ID ? null : notice);
    };

    const handleDeleteClick = (e, noticeId) => {
        e.stopPropagation();
        setDeleteTargetId(noticeId);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (socket && deleteTargetId) {
            socket.emit('room:delete_notice', { roomId, noticeId: deleteTargetId });
        }
        setIsDeleteModalOpen(false);
        setDeleteTargetId(null);
        setSelectedNotice(null);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="notice-list-container">
            <Titlebar title="공지 목록" showBack={true} />

            <div className="notice-list-content">
                {notices.length === 0 ? (
                    <div className="no-notices">등록된 공지가 없습니다.</div>
                ) : (
                    <ul className="notice-list">
                        {notices.map((notice) => (
                            <li
                                key={notice.NOTICE_ID}
                                className={`notice-item ${notice.IS_ACTIVE ? 'active' : ''} ${selectedNotice?.NOTICE_ID === notice.NOTICE_ID ? 'expanded' : ''}`}
                                onClick={() => handleNoticeClick(notice)}
                            >
                                <div className="notice-item-header">
                                    <div className="notice-item-info">
                                        {notice.IS_ACTIVE ? <span className="active-badge">현재 공지</span> : null}
                                        <span className="notice-author">{notice.CREATED_BY_NICKNAME || '알 수 없음'}</span>
                                        <span className="notice-date">{formatDate(notice.CREATED_AT)}</span>
                                    </div>
                                    <button
                                        className="notice-delete-btn"
                                        onClick={(e) => handleDeleteClick(e, notice.NOTICE_ID)}
                                        title="삭제"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div className={`notice-item-content ${selectedNotice?.NOTICE_ID === notice.NOTICE_ID ? '' : 'truncated'}`}>
                                    {notice.CONTENT}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="공지 삭제"
                message="이 공지를 삭제하시겠습니까?"
                confirmText="삭제"
                isDanger={true}
            />
        </div>
    );
}
