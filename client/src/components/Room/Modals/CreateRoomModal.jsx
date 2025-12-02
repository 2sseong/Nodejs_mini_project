// src/components/Roompage/Modals/CreateRoomModal.jsx
import { useState } from 'react';
import './Modals.css';
import { apiCreateRoom } from '../../../api/roomApi';
import ConfirmModal from '../../Chatpage/Modals/ConfirmModal'; // ConfirmModal 경로 확인 (Roompage -> Chatpage)

export default function CreateRoomModal({ isOpen, onClose, userId }) {
    const [newRoomName, setNewRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // [추가] 알림용 모달 상태 관리
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: ''
    });

    if (!isOpen) return null;

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
        if (!trimmedName || !userId) {
            
            openAlert(
                '입력 오류', 
                trimmedName ? '사용자 정보를 불러올 수 없습니다.' : '채팅방 이름을 입력해주세요.'
            );
            return;
        }

        setIsCreating(true);
        try {
            // 2. [수정] apiCreateRoom 모듈 함수 사용
            const res = await apiCreateRoom(trimmedName, userId);

            if (res.data?.success) {
                onClose(true); // 성공
                setNewRoomName('');
            } else {
                
                openAlert('방 생성 실패', res.data?.message || '알 수 없는 오류');
            }
        } catch (err) {
            console.error('Chatroom creation failed via HTTP:', err.response?.data || err.message);
            
            openAlert('오류 발생', err.response?.data?.message || '서버 오류로 인해 방 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const stop = (e) => e.stopPropagation();

    return (
        <div className="modal-backdrop" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={stop}>
                <h3>새 그룹 채팅방 만들기</h3>
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