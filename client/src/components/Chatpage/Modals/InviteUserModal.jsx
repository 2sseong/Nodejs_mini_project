// src/components/Chatpage/Modals/InviteUserModal.jsx
import { useEffect, useState } from 'react';
import './Modals.css';
import { apiInviteUsers } from '../../../api/roomApi';
import { searchAllUsers } from '../../../api/usersApi';
import ConfirmModal from './ConfirmModal';

export default function InviteUserModal({
    isOpen,
    onClose,
    currentRoomId,
    userId,
    userNickname,
}) {
    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [expandedDepts, setExpandedDepts] = useState({});

    const [confirmModalState, setConfirmModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        isSuccess: false,
    });

    // 모달 열릴 때 전체 사용자 로드
    useEffect(() => {
        if (isOpen) {
            loadAllUsers();
        } else {
            // 모달 닫힐 때 초기화
            setAllUsers([]);
            setSearchQuery('');
            setSelectedIds(new Set());
            setExpandedDepts({});
            setConfirmModalState({ isOpen: false, title: '', message: '', isSuccess: false });
        }
    }, [isOpen]);

    const loadAllUsers = async () => {
        setIsLoading(true);
        try {
            const data = await searchAllUsers('', userId);
            // 본인 제외 + 부서/직급 정보 포함
            const filtered = data.filter(u => String(u.userId) !== String(userId));
            setAllUsers(filtered);

            // 모든 부서 펼침 상태로 초기화
            const depts = {};
            filtered.forEach(u => {
                const dept = u.DEPARTMENT || u.department || '미배정';
                depts[dept] = true;
            });
            setExpandedDepts(depts);
        } catch (err) {
            console.error('사용자 목록 로드 실패:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !currentRoomId) return null;

    // 검색 필터링
    const filteredUsers = allUsers.filter(user => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const nickname = (user.userNickname || user.NICKNAME || '').toLowerCase();
        const username = (user.username || user.USERNAME || '').toLowerCase();
        return nickname.includes(q) || username.includes(q);
    });

    // 부서별 그룹화
    const groupedByDept = {};
    filteredUsers.forEach(user => {
        const dept = user.DEPARTMENT || user.department || '미배정';
        if (!groupedByDept[dept]) {
            groupedByDept[dept] = [];
        }
        groupedByDept[dept].push(user);
    });

    const sortedDepts = Object.keys(groupedByDept).sort((a, b) =>
        a.localeCompare(b, 'ko', { sensitivity: 'base' })
    );

    // 개별 선택 토글
    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // 부서 전체 선택 토글
    const toggleDeptAll = (dept) => {
        const deptUsers = groupedByDept[dept] || [];
        const deptIds = deptUsers.map(u => u.userId);
        const allSelected = deptIds.every(id => selectedIds.has(id));

        const newSet = new Set(selectedIds);
        if (allSelected) {
            // 모두 해제
            deptIds.forEach(id => newSet.delete(id));
        } else {
            // 모두 선택
            deptIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    // 부서 펼침/접힘 토글
    const toggleDeptExpand = (dept) => {
        setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
    };

    // 부서 전체 선택 여부 체크
    const isDeptAllSelected = (dept) => {
        const deptUsers = groupedByDept[dept] || [];
        if (deptUsers.length === 0) return false;
        return deptUsers.every(u => selectedIds.has(u.userId));
    };

    // 초대 실행
    const handleInvite = async () => {
        if (selectedIds.size === 0) {
            setConfirmModalState({
                isOpen: true,
                title: '알림',
                message: '초대할 사용자를 선택해주세요.',
                isSuccess: false
            });
            return;
        }

        setIsInviting(true);
        try {
            const res = await apiInviteUsers(
                String(currentRoomId),
                Array.from(selectedIds),
                userNickname
            );

            if (res.data?.success) {
                setConfirmModalState({
                    isOpen: true,
                    title: '초대 완료',
                    message: res.data.message || `${res.data.successCount}명을 초대했습니다.`,
                    isSuccess: true
                });
            } else {
                setConfirmModalState({
                    isOpen: true,
                    title: '초대 실패',
                    message: res.data?.message || '알 수 없는 오류',
                    isSuccess: false
                });
            }
        } catch (err) {
            setConfirmModalState({
                isOpen: true,
                title: '오류 발생',
                message: err.response?.data?.message || '초대 중 오류가 발생했습니다.',
                isSuccess: false
            });
        } finally {
            setIsInviting(false);
        }
    };

    const closeConfirmModal = () => {
        if (confirmModalState.isSuccess) {
            onClose(true);
        }
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
    };

    const stop = (e) => e.stopPropagation();

    return (
        <>
            <div className="modal-backdrop" onClick={() => onClose(false)}>
                <div className="invite-modal-content" onClick={stop}>
                    <h3>대화 상대 초대</h3>

                    {/* 검색창 */}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="이름 또는 아이디로 검색"
                        disabled={isInviting}
                        className="invite-search-input"
                    />

                    {/* 선택된 인원 표시 */}
                    {selectedIds.size > 0 && (
                        <div className="selected-count">
                            {selectedIds.size}명 선택됨
                        </div>
                    )}

                    {/* 사용자 목록 */}
                    <div className="invite-user-list">
                        {isLoading ? (
                            <div className="invite-loading">불러오는 중...</div>
                        ) : sortedDepts.length === 0 ? (
                            <div className="invite-empty">초대할 수 있는 사용자가 없습니다.</div>
                        ) : (
                            sortedDepts.map(dept => (
                                <div key={dept} className="invite-dept-section">
                                    <div className="invite-dept-header">
                                        <div className="invite-dept-left" onClick={() => toggleDeptExpand(dept)}>
                                            <i className={`bi bi-chevron-${expandedDepts[dept] ? 'down' : 'right'}`}></i>
                                            <span className="invite-dept-name">{dept}</span>
                                            <span className="invite-dept-count">({groupedByDept[dept].length})</span>
                                        </div>
                                        <button
                                            className={`invite-dept-select-all ${isDeptAllSelected(dept) ? 'active' : ''}`}
                                            onClick={() => toggleDeptAll(dept)}
                                        >
                                            {isDeptAllSelected(dept) ? '전체 해제' : '전체 선택'}
                                        </button>
                                    </div>
                                    {expandedDepts[dept] && (
                                        <ul className="invite-user-items">
                                            {groupedByDept[dept].map(user => (
                                                <li
                                                    key={user.userId}
                                                    className={`invite-user-item ${selectedIds.has(user.userId) ? 'selected' : ''}`}
                                                    onClick={() => toggleSelect(user.userId)}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(user.userId)}
                                                        onChange={() => { }}
                                                    />
                                                    <span className="invite-user-nickname">
                                                        {user.userNickname || user.NICKNAME}
                                                    </span>
                                                    <span className="invite-user-username">
                                                        ({user.username || user.USERNAME})
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* 버튼 영역 */}
                    <div className="modal-actions">
                        <button onClick={() => onClose(false)} disabled={isInviting}>
                            취소
                        </button>
                        <button
                            onClick={handleInvite}
                            disabled={isInviting || selectedIds.size === 0}
                            className="invite-btn-primary"
                        >
                            {isInviting ? '초대 중...' : `초대하기 (${selectedIds.size}명)`}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModalState.isOpen}
                onClose={closeConfirmModal}
                onConfirm={closeConfirmModal}
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText="확인"
                cancelText={null}
            />
        </>
    );
}