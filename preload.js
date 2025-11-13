// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 'window.electronAPI'라는 객체로 API를 노출시킵니다.
contextBridge.exposeInMainWorld('electronAPI', {
  // 각 기능별로 Main 프로세스에 메시지를 보냅니다.
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});