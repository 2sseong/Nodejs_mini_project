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