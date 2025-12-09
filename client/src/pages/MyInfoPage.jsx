import React, { useEffect, useState } from 'react';
import DaumPostcode from 'react-daum-postcode';
import { getMyInfo, verifyPassword, updateUserInfo, uploadProfileImage, getDepartments, getPositions } from '../api/authApi';
import ConfirmModal from '../components/Chatpage/Modals/ConfirmModal';
import '../styles/MyInfoPage.css';

export default function MyInfoPage() {
    const [user, setUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const [verifyPwInput, setVerifyPwInput] = useState('');
    const [nicknameInput, setNicknameInput] = useState('');
    const [deptId, setDeptId] = useState('');
    const [posId, setPosId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [addressDetail, setAddressDetail] = useState('');
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    // 부서/직급 목록
    const [deptList, setDeptList] = useState([]);
    const [posList, setPosList] = useState([]);

    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        isDanger: false,
        onConfirm: null
    });

    useEffect(() => {
        loadUserInfo();
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const depts = await getDepartments();
            const positions = await getPositions();
            setDeptList(depts);
            setPosList(positions);
        } catch (err) {
            console.error('부서/직급 목록 로드 실패:', err);
        }
    };

    const loadUserInfo = async () => {
        try {
            const res = await getMyInfo();
            if (res.success) {
                setUser(res.data);
                setNicknameInput(res.data.NICKNAME);
                // DEPT_ID, POS_ID로 설정 (서버에서 전달되는 필드명 확인 필요)
                setDeptId(res.data.DEPT_ID?.toString() || '');
                setPosId(res.data.POS_ID?.toString() || '');
                setPhone(res.data.PHONE || '');
                setAddress(res.data.ADDRESS || '');
                setAddressDetail(res.data.ADDRESS_DETAIL || '');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const handleModalConfirm = () => {
        if (modalConfig.onConfirm) modalConfig.onConfirm();
        closeModal();
    };

    const openModal = (title, message, isDanger = false, onConfirm = null) => {
        setModalConfig({ isOpen: true, title, message, isDanger, onConfirm });
    };

    const handleEditClick = () => {
        setIsEditing(true);
        setIsVerified(false);
        setVerifyPwInput('');
        setNewPassword('');
        setConfirmPassword('');
        if (user) {
            setNicknameInput(user.NICKNAME);
            setDeptId(user.DEPT_ID?.toString() || '');
            setPosId(user.POS_ID?.toString() || '');
        }
    };

    const handleVerify = async () => {
        try {
            await verifyPassword(verifyPwInput);
            setIsVerified(true);
        } catch (err) {
            console.error(err);
            openModal('인증 실패', '비밀번호가 일치하지 않습니다.', true);
        }
    };

    const handleSave = async () => {
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                openModal('입력 오류', '새 비밀번호가 일치하지 않습니다.', true);
                return;
            }
            if (newPassword.length < 4) {
                openModal('입력 오류', '비밀번호는 4자 이상이어야 합니다.', true);
                return;
            }
        }

        // 전화번호/주소 필수 검증
        if (!phone || !address) {
            openModal('입력 오류', '전화번호와 주소는 필수 입력입니다.', true);
            return;
        }

        // 전화번호 포맷팅 (01012345678 -> 010-1234-5678)
        const formatPhone = (rawPhone) => {
            const digits = rawPhone.replace(/\D/g, '');
            if (digits.length === 11) {
                return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
            } else if (digits.length === 10) {
                return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            return digits;
        };

        try {
            const updateData = {
                nickname: nicknameInput,
                deptId: deptId ? Number(deptId) : undefined,
                posId: posId ? Number(posId) : undefined,
                newPassword: newPassword || undefined,
                phone: formatPhone(phone),
                address: address,
                addressDetail: addressDetail || undefined
            };

            await updateUserInfo(updateData);

            openModal('성공', '정보가 수정되었습니다.', false, () => {
                setIsEditing(false);
                setIsVerified(false);
                loadUserInfo();
            });
        } catch (err) {
            openModal('수정 실패', err.message, true);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await uploadProfileImage(file);
            if (res.success) {
                setUser(prev => ({ ...prev, PROFILE_PIC: res.filePath }));
            } else {
                openModal('업로드 실패', res.message, true);
            }
        } catch (err) {
            console.error(err);
            openModal('오류', '이미지 업로드 중 오류가 발생했습니다.', true);
        } finally {
            e.target.value = '';
        }
    };

    if (!user) return <div className="my-info-page"><p className="loading-text">로딩 중...</p></div>;

    const profileSrc = user.PROFILE_PIC
        ? `http://localhost:1337${user.PROFILE_PIC}`
        : null;

    const getInitials = (nickname) => {
        return nickname ? nickname.charAt(0).toUpperCase() : '?';
    };

    return (
        <div className="my-info-page">
            {/* 프로필 헤더 */}
            <div className="profile-header">
                <div className="profile-avatar-wrap">
                    {profileSrc ? (
                        <img src={profileSrc} alt="프로필" className="profile-avatar" />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {getInitials(user.NICKNAME)}
                        </div>
                    )}
                    <label className="avatar-edit-btn">
                        <i className="bi bi-camera-fill"></i>
                        <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                    </label>
                </div>
                <h2 className="profile-name">{user.NICKNAME}</h2>
                <p className="profile-username">{user.USERNAME}</p>
            </div>

            {/* 정보 카드 */}
            <div className="info-section">
                {!isEditing ? (
                    <>
                        <div className="info-row">
                            <span className="info-label">부서</span>
                            <span className="info-value">{user.DEPARTMENT || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">직급</span>
                            <span className="info-value">{user.POSITION || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">전화번호</span>
                            <span className="info-value">{user.PHONE || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">주소</span>
                            <span className="info-value">
                                {user.ADDRESS ? `${user.ADDRESS}${user.ADDRESS_DETAIL ? ' ' + user.ADDRESS_DETAIL : ''}` : '-'}
                            </span>
                        </div>
                        <button className="btn-edit" onClick={handleEditClick}>
                            <i className="bi bi-pencil"></i> 정보 수정
                        </button>
                    </>
                ) : !isVerified ? (
                    <div className="verify-section">
                        <p className="verify-desc">정보 수정을 위해 현재 비밀번호를 입력하세요.</p>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="현재 비밀번호"
                            value={verifyPwInput}
                            onChange={e => setVerifyPwInput(e.target.value)}
                        />
                        <div className="btn-row">
                            <button className="btn-secondary" onClick={() => setIsEditing(false)}>취소</button>
                            <button className="btn-primary" onClick={handleVerify}>확인</button>
                        </div>
                    </div>
                ) : (
                    <div className="edit-section">
                        <div className="field-group">
                            <label>닉네임</label>
                            <input
                                type="text"
                                className="input-field"
                                value={nicknameInput}
                                onChange={e => setNicknameInput(e.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label>부서</label>
                            <select
                                className="input-field"
                                value={deptId}
                                onChange={e => setDeptId(e.target.value)}
                            >
                                {deptList.map((dept) => (
                                    <option key={dept.deptId} value={dept.deptId.toString()}>
                                        {dept.deptName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field-group">
                            <label>직급</label>
                            <select
                                className="input-field"
                                value={posId}
                                onChange={e => setPosId(e.target.value)}
                            >
                                {posList.map((pos) => (
                                    <option key={pos.posId} value={pos.posId.toString()}>
                                        {pos.posName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field-group">
                            <label>전화번호 <span className="required">*</span></label>
                            <input
                                type="tel"
                                className="input-field"
                                placeholder="01012345678 (- 없이 입력)"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label>주소 <span className="required">*</span></label>
                            <div className="address-input-row">
                                <input
                                    type="text"
                                    className="input-field address-field"
                                    placeholder="주소 검색을 클릭하세요"
                                    value={address}
                                    readOnly
                                />
                                <button
                                    type="button"
                                    className="btn-address-search"
                                    onClick={() => setIsAddressModalOpen(true)}
                                >
                                    <i className="bi bi-search"></i> 검색
                                </button>
                            </div>
                        </div>
                        <div className="field-group">
                            <label>상세주소</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="상세주소 입력"
                                value={addressDetail}
                                onChange={e => setAddressDetail(e.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label>새 비밀번호 (선택)</label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="변경 시 입력"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>
                        {newPassword && (
                            <div className="field-group">
                                <label>비밀번호 확인</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="다시 입력"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="btn-row">
                            <button className="btn-secondary" onClick={() => setIsEditing(false)}>취소</button>
                            <button className="btn-primary" onClick={handleSave}>저장</button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={handleModalConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                isDanger={modalConfig.isDanger}
                confirmText="확인"
                cancelText={null}
            />

            {/* 주소 검색 모달 */}
            {isAddressModalOpen && (
                <div className="address-modal-backdrop" onClick={() => setIsAddressModalOpen(false)}>
                    <div className="address-modal-content" onClick={e => e.stopPropagation()}>
                        <DaumPostcode
                            onComplete={(data) => {
                                setAddress(data.address);
                                setIsAddressModalOpen(false);
                            }}
                            autoClose={false}
                            style={{ width: '100%', height: '400px' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}