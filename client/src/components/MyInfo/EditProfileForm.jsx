import React from 'react';

export default function EditProfileForm({
    nickname,
    onNicknameChange,
    newPassword,
    onNewPasswordChange,
    confirmPassword,
    onConfirmPasswordChange,
    onSave,
    onCancel
}) {
    // [추가] 공백 입력을 실시간으로 차단하는 핸들러
    const handlePasswordInput = (e, setter) => {
        const value = e.target.value;
        // 공백(스페이스, 탭 등)을 모두 제거
        const noSpaceValue = value.replace(/\s/g, '');
        setter(noSpaceValue);
    };

    return (
        <div className="update-section">
            <h3>정보 수정</h3>
            <div className="info-item">
                <label>닉네임</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => onNicknameChange(e.target.value)}
                    className="input-field"
                />
            </div>
            <hr style={{margin: '20px 0', border: '0', borderTop: '1px solid #eee'}} />
            <div className="info-item">
                <label>새 비밀번호 (변경 시에만 입력)</label>
                <input 
                    type="password" 
                    value={newPassword} 
                    // [수정] 공백 차단 핸들러 적용
                    onChange={(e) => handlePasswordInput(e, onNewPasswordChange)}
                    placeholder="변경할 비밀번호 (4자 이상)"
                    className="input-field"
                />
            </div>
            <div className="info-item">
                <label>새 비밀번호 확인</label>
                <input 
                    type="password" 
                    value={confirmPassword} 
                    // [수정] 공백 차단 핸들러 적용
                    onChange={(e) => handlePasswordInput(e, onConfirmPasswordChange)}
                    placeholder="비밀번호 확인"
                    className="input-field"
                />
            </div>
            <div className="btn-group">
                <button className="btn-secondary" onClick={onCancel}>취소</button>
                <button className="btn-primary" onClick={onSave}>저장</button>
            </div>
        </div>
    );
}