import React from 'react';
import './Titlebar.css';

// 아이콘 컴포넌트들
const MinimizeIcon = () => (
  <svg x="0px" y="0px" viewBox="0 0 10.2 1"><rect x="0" y="0" width="10.2" height="1"></rect></svg>
);
const MaximizeIcon = () => (
  <svg viewBox="0 0 10 10"><path d="M0,0v10h10V0H0z M9,9H1V1h8V9z"></path></svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 10 10"><polygon points="10,1.01 8.99,0 5,3.99 1.01,0 0,1.01 3.99,5 0,8.99 1.01,10 5,6.01 8.99,10 10,8.99 6.01,5"></polygon></svg>
);

// [중요] { title } props를 받아야 각 창마다 다른 제목을 띄울 수 있습니다.
function Titlebar({ title = "엠아이토크" }) {
  const handleMinimize = () => {
    if (window.electronAPI) window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    if (window.electronAPI) window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    if (window.electronAPI) window.electronAPI.closeWindow();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region">
        <div className="titlebar-title">{title}</div>
      </div>

      <div className="titlebar-controls">
        <button className="titlebar-button" onClick={handleMinimize}>
          <MinimizeIcon />
        </button>
        <button className="titlebar-button" onClick={handleMaximize}>
          <MaximizeIcon />
        </button>
        <button className="titlebar-button" id="close-btn" onClick={handleClose}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

export default Titlebar;