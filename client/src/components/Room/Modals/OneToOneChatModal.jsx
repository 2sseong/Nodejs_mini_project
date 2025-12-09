// src/components/Roompage/Modals/OneToOneChatModal.jsx
import { useState, useEffect } from 'react';
import './Modals.css';
import { createOneToOneChat } from '../../../api/chatApi';
import ConfirmModal from '../../Chatpage/Modals/ConfirmModal'; // ConfirmModal 경로 확인 (Roompage -> Chatpage)

export default function OneToOneChatModal({ isOpen, onClose, userId, targetUser, onCreate }) {

    const defaultName = targetUser ? `${targetUser.userNickname}님과의 대화` : '';
    const [newRoomName, setNewRoomName] = useState(defaultName);
    const [isCreating, setIsCreating] = useState(false);

    // [추가] 알림용 모달 상태 관리
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: ''
    });

    // targetUser가 변경될 때마다 기본 이름 업데이트 (UI 편의성)
    useEffect(() => {
        if (targetUser) {
            setNewRoomName(`${targetUser.userNickname}님과의 대화`);
        }
    }, [targetUser]);

    // 모달이 닫히거나 대상 유저 없으면 랜더링 안 함
    if (!isOpen || !targetUser) return null;

    // [추가] 알림 모달 닫기 핸들러
    const closeAlert = () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
    };

    // [추가] 알림 모달 열기 헬퍼
    const openAlert = (title, message) => {
        setAlertModal({
            isOpen: true,
            title,
            message
        });
    };

    const handleCreate = async () => {
        const trimmedName = newRoomName.trim();
        const targetUserId = targetUser.userId; // 대상 ID 추출

        if (!trimmedName) {

            openAlert(
                '입력 오류',
                '채팅방 이름을 입력해주세요.'
            );
            return;
        }
        if (!userId || !targetUserId) {
            openAlert('오류', '사용자 정보를 불러올 수 없습니다.');
            return;
        }

        setIsCreating(true);
        try {
            // 2. [수정] apiCreateRoom 모듈 함수 사용
            const res = await createOneToOneChat(targetUserId, trimmedName);

            if (res.roomId) { // API 응답 구조를 roomId로 체크 (res.data?.success 대신))
                onClose(); // 성공
                setNewRoomName('');
                // 부모(UserPage)에게 생성된 roomId와 roomName 전달
                onCreate(res.roomId, res.roomName);
            } else {
                openAlert('방 생성 실패', res.data?.message || '알 수 없는 오류');
            }
        } catch (err) {
            console.error('One-to-One Chat creation failed: ', err.response?.data || err.message);

            openAlert('오류 발생', err.response?.data?.message || '서버 오류로 인해 방 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const stop = (e) => e.stopPropagation();

    return (
        <div className="modal-backdrop" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={stop}>
                <h3>{targetUser.userNickname}님과의 대화</h3>
                <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="채팅방 이름 (필수)"
                    disabled={isCreating}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="modal-actions">
                    <button onClick={() => onClose(false)} disabled={isCreating}>취소</button>
                    <button onClick={handleCreate} disabled={isCreating || newRoomName.trim().length === 0}>
                        {isCreating ? '생성 중...' : '생성'}
                    </button>
                </div>
            </div>

            {/* [추가] ConfirmModal 렌더링 (알림창 용도) */}
            <ConfirmModal
                isOpen={alertModal.isOpen}
                onClose={closeAlert}
                onConfirm={closeAlert}
                title={alertModal.title}
                message={alertModal.message}
                confirmText="확인"
                cancelText={null} // 취소 버튼 숨김 (단순 알림)
            />
        </div>
    );
}