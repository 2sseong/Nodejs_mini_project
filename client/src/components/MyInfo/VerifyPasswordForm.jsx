import React from 'react';

export default function VerifyPasswordForm({ 
    password, 
    onChange, 
    onVerify, 
    onCancel 
}) {
    // 엔터키 입력 시 확인 버튼 동작
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onVerify();
        }
    };

    // [추가] 공백 입력을 차단하는 핸들러
    const handleInputChange = (e) => {
        const value = e.target.value;
        const noSpaceValue = value.replace(/\s/g, ''); // 공백 제거
        onChange(noSpaceValue);
    };

    return (
        <div className="verify-section">
            <h3>본인 확인</h3>
            <p>정보를 수정하려면 현재 비밀번호를 입력하세요.</p>
            <input 
                type="password" 
                value={password} 
                // [수정] 공백 차단 핸들러 적용
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="현재 비밀번호"
                className="input-field"
            />
            <div className="btn-group">
                <button className="btn-secondary" onClick={onCancel}>취소</button>
                <button className="btn-primary" onClick={onVerify}>확인</button>
            </div>
        </div>
    );
}