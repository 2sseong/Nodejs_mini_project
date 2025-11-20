import React, { useEffect, useState } from 'react';
import NotificationPopup from '../components/Notification/NotificationPopup.jsx';
import '../components/Notification/NotificationPopup.css'; // CSS도 여기서 불러옵니다

export default function NotificationWindowPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // [핵심] Electron 메인 프로세스에서 보내주는 데이터를 수신합니다.
    if (window.electronAPI?.onShowNotification) {
      window.electronAPI.onShowNotification((event, notificationData) => {
        console.log('[NotificationPage] Data received:', notificationData);
        setData(notificationData);
      });
    }
  }, []);

  const handleClose = () => {
    // 닫기 요청 (윈도우 숨김)
    if (window.electronAPI?.closeNotificationWindow) {
      window.electronAPI.closeNotificationWindow();
    }
  };

  const handleClick = (roomId) => {
    // 클릭 시 방 이동 요청
    if (window.electronAPI?.clickNotification) {
      window.electronAPI.clickNotification(roomId);
    }
    handleClose();
  };

  // 데이터가 없으면 렌더링 안 함 (투명)
  if (!data) return null;

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'transparent', 
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'flex-end', 
      justifyContent: 'flex-end',
    }}>
      {/* 여기서 NotificationPopup에 data를 주입합니다 */}
      <NotificationPopup 
        key={data.id} 
        data={data} 
        onClose={handleClose} 
        onClick={handleClick} 
      />
    </div>
  );
}