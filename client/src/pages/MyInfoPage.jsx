import React, { useEffect, useState } from 'react';
import { getMyInfo, verifyPassword, updateUserInfo, uploadProfileImage } from '../api/authApi';
import ConfirmModal from '../components/Chatpage/Modals/ConfirmModal';
import '../styles/MyInfoPage.css';

// 모듈화된 컴포넌트 import
import ProfileImageSection from '../components/MyInfo/ProfileImageSection';
import InfoDisplay from '../components/MyInfo/InfoDisplay';
import VerifyPasswordForm from '../components/MyInfo/VerifyPasswordForm';
import EditProfileForm from '../components/MyInfo/EditProfileForm';

export default function MyInfoPage() {
    const [user, setUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    
    // 상태 값
    const [verifyPwInput, setVerifyPwInput] = useState('');
    const [nicknameInput, setNicknameInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // 모달 설정
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        isDanger: false,
        onConfirm: null
    });

    useEffect(() => {
        loadUserInfo();
    }, []);

    const loadUserInfo = async () => {
        try {
            const res = await getMyInfo();
            if (res.success) {
                setUser(res.data);
                setNicknameInput(res.data.NICKNAME);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- 모달 관련 핸들러 ---
    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const handleModalConfirm = () => {
        if (modalConfig.onConfirm) modalConfig.onConfirm();
        closeModal();
    };

    const openModal = (title, message, isDanger = false, onConfirm = null) => {
        setModalConfig({ isOpen: true, title, message, isDanger, onConfirm });
    };

    // --- 이벤트 핸들러 ---
    const handleEditClick = () => {
        setIsEditing(true);
        setIsVerified(false);
        setVerifyPwInput('');
        setNewPassword('');
        setConfirmPassword('');
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
        // 비밀번호 변경 시 유효성 검사
        if (newPassword) {
            // 1. 일치 여부 확인
            if (newPassword !== confirmPassword) {
                openModal('입력 오류', '새 비밀번호가 일치하지 않습니다.', true);
                return;
            }

            // 2. 길이 확인 (4자리 이상)
            // (공백 입력은 EditProfileForm에서 원천 차단되므로 별도 정규식 검사 제거)
            if (newPassword.length < 4) {
                 openModal('입력 오류', '비밀번호는 4자 이상이어야 합니다.', true);
                 return;
            }
        }

        try {
            const updateData = { 
                nickname: nicknameInput,
                newPassword: newPassword || undefined
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

        console.log('[Frontend] 선택된 파일:', file.name, file.size);

        try {
            const res = await uploadProfileImage(file);
            if (res.success) {
                setUser(prev => ({ ...prev, PROFILE_PIC: res.filePath }));
            } else {
                openModal('업로드 실패', res.message, true);
            }
        } catch (err) {
            console.error('[Frontend] 업로드 중 에러:', err);
            openModal('오류', '이미지 업로드 중 오류가 발생했습니다.', true);
        } finally {
            e.target.value = ''; 
        }
    };

    if (!user) return <div>Loading...</div>;

    const profileSrc = user.PROFILE_PIC 
        ? `http://localhost:1337${user.PROFILE_PIC}` 
        : 'https://via.placeholder.com/150';

    return (
        <div className="my-info-container">
            <div className="info-card">
                <h2 className="page-title">내 정보</h2>

                {/* 1. 프로필 이미지 섹션 */}
                <ProfileImageSection 
                    profileSrc={profileSrc}
                    onFileChange={handleFileChange}
                />

                {/* 2. 정보 표시 및 수정 폼 영역 */}
                {!isEditing ? (
                    <InfoDisplay 
                        user={user} 
                        onEditClick={handleEditClick} 
                    />
                ) : (
                    <div className="edit-form">
                        {!isVerified ? (
                            <VerifyPasswordForm
                                password={verifyPwInput}
                                onChange={setVerifyPwInput}
                                onVerify={handleVerify}
                                onCancel={() => setIsEditing(false)}
                            />
                        ) : (
                            <EditProfileForm
                                nickname={nicknameInput}
                                onNicknameChange={setNicknameInput}
                                newPassword={newPassword}
                                onNewPasswordChange={setNewPassword}
                                confirmPassword={confirmPassword}
                                onConfirmPasswordChange={setConfirmPassword}
                                onSave={handleSave}
                                onCancel={() => setIsEditing(false)}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* 3. 공통 알림 모달 */}
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
        </div>
    );
}