import React, { useEffect, useState } from 'react';
import './NotificationPopup.css'; // 스타일 파일 import

const NotificationPopup = ({ data, onClose, onClick }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // 5초 뒤 자동으로 닫힘 (사라지는 애니메이션 시작)
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [data]);

  const handleClose = (e) => {
    if (e) e.stopPropagation(); // 부모 클릭 이벤트 전파 방지
    setIsClosing(true);
    // 0.5초(애니메이션 시간) 뒤에 실제로 데이터 삭제 및 윈도우 숨김 요청
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleClick = () => {
    // 알림 본문 클릭 시: 해당 방으로 이동 (부모에서 윈도우 숨김 처리까지 수행함)
    onClick(data.roomId);
  };

  if (!data) return null;

  return (
    <div 
      className={`notification-popup ${isClosing ? 'fade-out' : 'slide-in'}`}
      onClick={handleClick}
    >
      <div className="notification-header">
        {/* 방 이름이 너무 길면 ... 처리 */}
        <span className="notification-room-name">💬 {data.roomName}</span>
        <button className="notification-close-btn" onClick={handleClose}>&times;</button>
      </div>
      <div className="notification-body">
        <div className="notification-sender">{data.nickname}</div>
        <div className="notification-content">
            {data.type === 'FILE' ? `📄 ${data.content}` : data.content}
        </div>
      </div>
    </div>
  );
};

export default NotificationPopup;