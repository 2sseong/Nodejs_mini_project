// electron/preload.js (CommonJS 방식으로 복구)
const { contextBridge, ipcRenderer } = require('electron');

// 이 API는 React (Renderer) 코드에 window.api 객체로 노출됩니다.
const api = {
    /**
     * @description 렌더러에서 메인 프로세스로 비동기 요청을 보내고 응답을 받습니다. (invoke/handle 패턴)
     * @param {string} channel - 통신 채널 이름
     * @param {any} data - 메인 프로세스로 전송할 데이터
     */
    invokeMain: (channel, data) => ipcRenderer.invoke(channel, data), 
    
    /**
     * @description 메인 프로세스에서 발생하는 이벤트를 수신합니다. (on/send 패턴)
     * @param {function} callback - 이벤트를 수신했을 때 실행할 콜백 함수
     */
    onUpdate: (callback) => {
        // 메인 프로세스에서 'main-to-renderer-update' 채널로 메시지를 보낼 때 호출됩니다.
        ipcRenderer.on('main-to-renderer-update', (event, ...args) => callback(...args));
    },

    // 예시: 윈도우 최소화 요청
    minimizeWindow: () => ipcRenderer.send('window-control', 'minimize')
};

// React 코드에서 'window.api'로 접근 가능하도록 전역 객체에 노출
contextBridge.exposeInMainWorld('api', api);