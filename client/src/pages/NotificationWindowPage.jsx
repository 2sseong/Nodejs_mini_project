import React, { useEffect, useState } from 'react';
import NotificationPopup from '../components/Notification/NotificationPopup.jsx';
// import '../components/Notification/NotificationPopup.css'; // CSS도 여기서 불러옵니다

export default function NotificationWindowPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (window.electronAPI?.onShowNotification) {
      // [수정] 리스너 등록 및 해제 함수 받기
      const removeListener = window.electronAPI.onShowNotification((event, newNotif) => {
        console.log('[NotificationPage] New Data:', newNotif);
        
        const notifItem = { ...newNotif, _internalId: Date.now() + Math.random() };
        
        setNotifications((prev) => {
          // 중복 방지 (혹시 몰라 ID로 한 번 더 체크)
          if (prev.some(n => n.id === newNotif.id && n.roomId === newNotif.roomId)) {
             return prev;
          }
          const updated = [...prev, notifItem];
          if (updated.length > 5) return updated.slice(updated.length - 5);
          return updated;
        });
      });

      // [핵심] 컴포넌트가 사라지거나 다시 그려질 때 리스너 제거
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);

  // 개별 알림 닫기 (목록에서 제거)
  const handleRemove = (id) => {
    setNotifications((prev) => prev.filter((n) => n._internalId !== id));
  };

  // 알림 클릭 시 (방 이동 + 해당 알림 닫기)
  const handleClick = (roomId, id) => {
    if (window.electronAPI?.clickNotification) {
      window.electronAPI.clickNotification(roomId);
    }
    handleRemove(id);
  };

  // [중요] 알림이 하나도 없으면 창 숨김 요청 (Main 프로세스로)
  useEffect(() => {
    if (notifications.length === 0) {
      // 약간의 딜레이 후 닫기 (애니메이션 고려)
      const timer = setTimeout(() => {
        if (window.electronAPI?.closeNotificationWindow) {
             // 배열이 비었을 때만 진짜로 창을 숨김
             // window.electronAPI.closeNotificationWindow(); // 필요시 주석 해제
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  return (
    <div className="notification-stack-container">
      {/* 알림 목록 렌더링 */}
      {notifications.map((data) => (
        <div key={data._internalId} className="notification-wrapper">
          <NotificationPopup 
            data={data} 
            onClose={() => handleRemove(data._internalId)} 
            onClick={() => handleClick(data.roomId, data._internalId)} 
          />
        </div>
      ))}
    </div>
  );
}