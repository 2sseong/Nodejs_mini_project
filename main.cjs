// Electron 메인 프로세스

const { app, BrowserWindow, ipcMain, screen } = require('electron'); 
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({path:path.join(__dirname, '.env')});

let mainWindow;
let backendProcess;

let notificationWindow = null;
let notifTimeout = null;

let chatWindows = {};

function startBackendServer() {
  const backendPath = path.join(__dirname, 'src');

  backendProcess = spawn('node', ['server.js'], {
    cwd: backendPath, 
    shell: true,
    env: process.env 
  }); 
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend Log]: ${data}`);
    setTimeout(() => {
        if (!mainWindow) {
          createWindow();
          createNotificationWindow(); // 알림창 미리 생성
        }
    }, 3000);
  });

  backendProcess.stderr.on('data', (data) => console.error(`[Backend Error]: ${data}`));
  backendProcess.on('close', (code) => console.log(`[Backend] Process exited with code ${code}`));
}

if (process.platform === 'win32') {
    app.setAppUserModelId('com.nodejs-mini-project.chat-app');
}

function createNotificationWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  
  const notifWidth = 340;
  // [수정] 알림이 쌓일 수 있도록 높이를 충분히 늘립니다 (예: 500px)
  const notifHeight = 480; 

  notificationWindow = new BrowserWindow({
    width: notifWidth,
    height: notifHeight,
    x: width - notifWidth - 20,
    y: height - notifHeight - 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = 'http://localhost:5173/notification'; 
  notificationWindow.loadURL(startUrl);

  notificationWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      notificationWindow.hide();
    }
  });
  
  console.log('[Main] Notification window created & hidden');
}

function showCustomNotification(data) {
  // 창이 없거나 파괴되었다면 재생성
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    console.log('[Main] Notification window missing, recreating...');
    createNotificationWindow();
  }

  // 데이터 전송 및 표시
  console.log('[Main] Showing notification with data:', data);
  notificationWindow.webContents.send('show-notification-data', data);
  notificationWindow.showInactive(); 

  if (notifTimeout) clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.hide();
    }
  }, 5500);
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: false,
    transparent: true, 
    hasShadow: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadURL('http://localhost:5173'); 
}

app.whenReady().then(() => {
  startBackendServer(); 
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (backendProcess) backendProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// === IPC 핸들러 ===
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.close());

// 알림 요청 수신
ipcMain.on('req-custom-notification', (event, data) => {
  showCustomNotification(data);
});

// 알림 닫기 수신
ipcMain.on('close-notification-window', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide(); 
  }
});

// 알림 클릭 수신
ipcMain.on('notification-clicked', (event, roomId) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore(); 
    mainWindow.show(); 
    mainWindow.focus(); 
    mainWindow.webContents.send('cmd-select-room', roomId);
  }
});

// 테스트 및 강제 활성화
ipcMain.on('window-show-focus', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore(); 
    mainWindow.show(); 
    mainWindow.focus(); 
  }
});

// [추가] 채팅방 창 열기 핸들러
ipcMain.on('open-chat-window', (event, roomId) => {
  // 1. 이미 열려있는 방이면 그 창을 앞으로 가져옴 (Focus)
  if (chatWindows[roomId]) {
    if (chatWindows[roomId].isMinimized()) chatWindows[roomId].restore();
    chatWindows[roomId].focus();
    return;
  }

  // 2. 새 창 생성
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 300,
    minHeight: 400,
    title: '채팅방', // 나중에 동적으로 변경 가능
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // preload 공유
    }
  });

  // 3. React 라우팅 주소로 로드 (예: /popup/roomId)
  // 개발 모드 vs 배포 모드 주소 분기
  const startUrl = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'
    ? `http://localhost:5173/#/popup/${roomId}`
    : `file://${path.join(__dirname, '../client/dist/index.html')}#/popup/${roomId}`; // HashRouter 사용 시

  win.loadURL(startUrl);

  win.webContents.openDevTools({ mode: 'detach' });

  // 4. 관리 객체에 저장
  chatWindows[roomId] = win;

  // 5. 닫힐 때 관리 객체에서 제거
  win.on('closed', () => {
    delete chatWindows[roomId];
  });
  
  // (옵션) 메뉴바 없애기
  win.setMenu(null);
});