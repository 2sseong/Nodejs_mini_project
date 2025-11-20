// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 'window.electronAPI'라는 객체로 API를 노출시킵니다.
contextBridge.exposeInMainWorld('electronAPI', {
  // 각 기능별로 Main 프로세스에 메시지를 보냅니다.
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // [추가] 테스트 및 강제 활성화
  showFocusWindow: () => ipcRenderer.send('window-show-focus'),

  // [추가] 알림 관련 기능
  sendCustomNotification: (data) => ipcRenderer.send('req-custom-notification', data),
  closeNotificationWindow: () => ipcRenderer.send('close-notification-window'),
  clickNotification: (roomId) => ipcRenderer.send('notification-clicked', roomId),
  
  // [추가] 이벤트 리스너 (Main -> Renderer)
  onShowNotification: (callback) => ipcRenderer.on('show-notification-data', callback),
  onCmdSelectRoom: (callback) => ipcRenderer.on('cmd-select-room', callback),
});