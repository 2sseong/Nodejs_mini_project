// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 'window.electronAPI'라는 객체로 API를 노출시킵니다.
contextBridge.exposeInMainWorld('electronAPI', {
  // 각 기능별로 Main 프로세스에 메시지를 보냅니다.
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  resizeWindow: (bounds) => ipcRenderer.send('resize-window', bounds),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),

  // [추가] 테스트 및 강제 활성화
  showFocusWindow: () => ipcRenderer.send('window-show-focus'),

  // [추가] 알림 관련 기능
  sendCustomNotification: (data) => ipcRenderer.send('req-custom-notification', data),
  closeNotificationWindow: () => ipcRenderer.send('close-notification-window'),
  clickNotification: (roomId) => ipcRenderer.send('notification-clicked', roomId),

  // [수정] 리스너 등록 시 '제거 함수(cleanup)'를 반환하도록 변경
  onShowNotification: (callback) => {
    const subscription = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('show-notification-data', subscription);
    // 리스너 제거 함수 반환
    return () => {
      ipcRenderer.removeListener('show-notification-data', subscription);
    };
  },

  onCmdSelectRoom: (callback) => {
    const subscription = (event, ...args) => callback(event, ...args);
    ipcRenderer.on('cmd-select-room', subscription);
    return () => {
      ipcRenderer.removeListener('cmd-select-room', subscription);
    };
  },

  openChatWindow: (roomId) => ipcRenderer.send('open-chat-window', roomId),

  // [추가] 이미지 미리보기 창 열기
  openImagePreview: (imageUrl, fileName) => ipcRenderer.send('open-image-preview', { imageUrl, fileName }),

  // [추가] 파일 다운로드 (저장 대화상자)
  downloadFile: (url, fileName) => ipcRenderer.invoke('download-file', { url, fileName }),

  // [추가] 외부 URL 열기 (기본 브라우저)
  openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),
});