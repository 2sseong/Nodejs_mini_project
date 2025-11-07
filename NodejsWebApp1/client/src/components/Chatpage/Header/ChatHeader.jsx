import './ChatHeader.css';

export default function ChatHeader({ title, onOpenInvite, disabled, onLeaveRoom }) {

    return (
        <div className="chat-header">
            <h2>{title || '채팅방'}</h2>

            {/* 2. 버튼들을 래퍼로 묶어 정렬합니다. */}
            <div className="chat-header-buttons">
                <button
                    className="invite-user-btn"
                    onClick={onOpenInvite}
                    title="인원 초대"
                    disabled={disabled}
                >
                    + 초대
                </button>

                {/* 3. '나가기' 버튼을 추가합니다. */}
                <button
                    className="leave-room-btn" 
                    onClick={onLeaveRoom}
                    title="방 나가기"
                >
                    나가기
                </button>
            </div>
        </div>
    );
}