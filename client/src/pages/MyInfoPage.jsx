import React, { useEffect, useState, useRef } from 'react';
import { getMyInfo, verifyPassword, updateUserInfo, uploadProfileImage } from '../api/authApi';
import '../styles/MyInfoPage.css';

export default function MyInfoPage() {
    const [user, setUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    
    // 입력값 상태
    const [verifyPwInput, setVerifyPwInput] = useState(''); // 본인 확인용
    const [nicknameInput, setNicknameInput] = useState('');
    
    // [추가] 새 비밀번호 관련 상태
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const fileInputRef = useRef(null);

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
            alert('비밀번호가 일치하지 않습니다.');
        }
    };

    const handleSave = async () => {
        // 유효성 검사
        if (newPassword && newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        try {
            // 변경할 데이터 구성
            const updateData = { 
                nickname: nicknameInput,
                newPassword: newPassword || undefined // 비어있으면 전송 안 함
            };

            await updateUserInfo(updateData);
            alert('정보가 수정되었습니다.');
            setIsEditing(false);
            setIsVerified(false);
            loadUserInfo();
        } catch (err) {
            alert('수정 실패: ' + err.message);
        }
    };

    const handleProfileClick = () => {
        console.log('[Frontend] 사진 변경 버튼 클릭됨'); // 로그 확인용
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        console.log('[Frontend] 파일 선택 이벤트 발생'); // 로그 확인용
        const file = e.target.files[0];
        
        if (!file) {
            console.log('[Frontend] 파일이 선택되지 않음');
            return;
        }

        console.log('[Frontend] 선택된 파일:', file.name, file.size);

        try {
            const res = await uploadProfileImage(file);
            console.log('[Frontend] 서버 응답:', res);
            
            if (res.success) {
                setUser(prev => ({ ...prev, PROFILE_PIC: res.filePath }));
            } else {
                alert('업로드 실패: ' + res.message);
            }
        } catch (err) {
            console.error('[Frontend] 업로드 중 에러:', err);
            alert('이미지 업로드 중 오류가 발생했습니다.');
        } finally {
            // 같은 파일을 다시 선택할 수 있도록 input 초기화
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

                <div className="profile-section">
                    <div className="profile-img-wrapper">
                        <img src={profileSrc} alt="Profile" className="profile-img" />
                    </div>
                    {/* display: none 이지만 ref로 연결됨 */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <button className="btn-upload" onClick={handleProfileClick}>
                        사진 변경
                    </button>
                </div>

                {!isEditing ? (
                    <div className="info-display">
                        <div className="info-item">
                            <label>이메일</label>
                            <span>{user.USERNAME}</span>
                        </div>
                        <div className="info-item">
                            <label>닉네임</label>
                            <span>{user.NICKNAME}</span>
                        </div>
                        <div className="info-item">
                            <label>가입일</label>
                            <span>{new Date(user.CREATED_AT).toLocaleDateString()}</span>
                        </div>
                        <button className="btn-primary" onClick={handleEditClick}>
                            내 정보 수정
                        </button>
                    </div>
                ) : (
                    <div className="edit-form">
                        {!isVerified ? (
                            <div className="verify-section">
                                <h3>본인 확인</h3>
                                <p>정보를 수정하려면 현재 비밀번호를 입력하세요.</p>
                                <input 
                                    type="password" 
                                    value={verifyPwInput} 
                                    onChange={(e) => setVerifyPwInput(e.target.value)}
                                    placeholder="현재 비밀번호"
                                    className="input-field"
                                />
                                <div className="btn-group">
                                    <button className="btn-secondary" onClick={() => setIsEditing(false)}>취소</button>
                                    <button className="btn-primary" onClick={handleVerify}>확인</button>
                                </div>
                            </div>
                        ) : (
                            <div className="update-section">
                                <h3>정보 수정</h3>
                                <div className="info-item">
                                    <label>닉네임</label>
                                    <input 
                                        type="text" 
                                        value={nicknameInput} 
                                        onChange={(e) => setNicknameInput(e.target.value)}
                                        className="input-field"
                                    />
                                </div>
                                <hr style={{margin: '20px 0', border: '0', borderTop: '1px solid #eee'}} />
                                <div className="info-item">
                                    <label>새 비밀번호 (변경 시에만 입력)</label>
                                    <input 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="변경할 비밀번호"
                                        className="input-field"
                                    />
                                </div>
                                <div className="info-item">
                                    <label>새 비밀번호 확인</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword} 
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="비밀번호 확인"
                                        className="input-field"
                                    />
                                </div>
                                <div className="btn-group">
                                    <button className="btn-secondary" onClick={() => setIsEditing(false)}>취소</button>
                                    <button className="btn-primary" onClick={handleSave}>저장</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}