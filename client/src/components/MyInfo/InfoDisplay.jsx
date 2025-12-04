// client/src/components/MyInfo/InfoDisplay.jsx
export default function InfoDisplay({ user, onEditClick }) {
    return (
        <div className="info-display">
            <div className="info-item">
                <label>이메일</label>
                <span>{user.USERNAME}</span>
            </div>
            <div className="info-item">
                <label>닉네임</label>
                <span>{user.NICKNAME}</span>
            </div>
            {/* [추가] 부서 표시 */}
            <div className="info-item">
                <label>부서</label>
                <span>{user.DEPARTMENT || '미배정'}</span>
            </div>
            {/* [추가] 직급 표시 */}
            <div className="info-item">
                <label>직급</label>
                <span>{user.POSITION || '직급 미입력'}</span>
            </div>
            <div className="info-item">
                <label>가입일</label>
                <span>{new Date(user.CREATED_AT).toLocaleDateString()}</span>
            </div>
            <button className="btn-primary" onClick={onEditClick}>
                내 정보 수정
            </button>
        </div>
    );
}