import React from 'react';
import './Titlebar.css'; // 3-2. CSS 파일을 임포트합니다.

// 3-3. 버튼 아이콘 (SVG나 아이콘 라이브러리 사용을 권장합니다)
const MinimizeIcon = () => (
  <svg x="0px" y="0px" viewBox="0 0 10.2 1"><rect x="0" y="0" width="10.2" height="1"></rect></svg>
);
const MaximizeIcon = () => (
  <svg viewBox="0 0 10 10"><path d="M0,0v10h10V0H0z M9,9H1V1h8V9z"></path></svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 10 10"><polygon points="10,1.01 8.99,0 5,3.99 1.01,0 0,1.01 3.99,5 0,8.99 1.01,10 5,6.01 8.99,10 10,8.99 6.01,5"></polygon></svg>
);

function Titlebar() {
  // 3-4. Preload.js에서 노출한 API 사용
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI.closeWindow();
  };

  return (
    // 3-1. HTML 구조 및 드래그 영역 설정
    <div className="titlebar">
      {/* 이 부분이 창을 드래그할 수 있는 영역이 됩니다. */}
      <div className="titlebar-drag-region">
        <div className="titlebar-title">test</div>
      </div>

      {/* 창 제어 버튼 */}
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