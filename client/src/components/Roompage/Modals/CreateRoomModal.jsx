// src/components/Chatpage/Modals/CreateRoomModal.jsx
import { useState } from 'react';
import './Modals.css';
import { apiCreateRoom } from '../../../api/roomApi';

export default function CreateRoomModal({ isOpen, onClose, userId }) {
    const [newRoomName, setNewRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        const trimmedName = newRoomName.trim();
        if (!trimmedName || !userId) {
            alert(trimmedName ? '사용자 정보를 불러올 수 없습니다.' : '채팅방 이름을 입력해주세요.');
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
                alert(`방 생성 실패: ${res.data?.message || '알 수 없는 오류'}`);
            }
        } catch (err) {
            console.error('Chatroom creation failed via HTTP:', err.response?.data || err.message);
            alert(err.response?.data?.message || '서버 오류로 인해 방 생성에 실패했습니다.');
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
        </div>
    );
}