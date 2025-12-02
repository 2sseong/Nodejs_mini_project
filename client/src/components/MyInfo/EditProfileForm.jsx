// client/src/components/MyInfo/EditProfileForm.jsx
import React from 'react';

export default function EditProfileForm({
    nickname,
    onNicknameChange,
    department,          
    onDepartmentChange,  
    position,            
    onPositionChange,    
    newPassword,
    onNewPasswordChange,
    confirmPassword,
    onConfirmPasswordChange,
    onSave,
    onCancel
}) {

    const handlePasswordInput = (e, setter) => {
        const value = e.target.value;
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
            <div className="info-item">
                <label>부서</label>
                <input 
                    type="text" 
                    value={department} 
                    onChange={(e) => onDepartmentChange(e.target.value)}
                    className="input-field"
                    placeholder="부서를 입력하세요"
                />
            </div>
            <div className="info-item">
                <label>직급</label>
                <input 
                    type="text" 
                    value={position} 
                    onChange={(e) => onPositionChange(e.target.value)}
                    className="input-field"
                    placeholder="직급을 입력하세요"
                />
            </div>

            <hr style={{margin: '20px 0', border: '0', borderTop: '1px solid #eee'}} />
            
            <div className="info-item">
                <label>새 비밀번호 (변경 시에만 입력)</label>
                <input 
                    type="password" 
                    value={newPassword} 
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