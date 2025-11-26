// Electron 메인 프로세스

const { app, BrowserWindow, ipcMain, screen } = require('electron'); 
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({path:path.join(__dirname, '.env')});

let backendProcess;
let notificationWindow = null;
let notifTimeout = null;
let chatWindows = {};

// 메인 창 관리 배열
let mainWindows = [];

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
        if (mainWindows.length === 0) {
          // 테스트를 위해 두 개의 메인 창을 엽니다.
          createWindow();
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
  let mainWindow = new BrowserWindow({
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

  // 창이 닫힐 때 배열에서 제거
  mainWindow.on('closed', () => {
    mainWindows = mainWindows.filter(win => win !== mainWindow);
    mainWindow = null;
  });

  mainWindows.push(mainWindow);
  return mainWindow;
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
// 각 IPC 메시지를 보낸 웹 콘텐츠가 속한 BrowserWindow를 찾아서 처리
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

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
  // 알림 클릭 시 어떤 창을 활성화할지 결정해야 합니다.
  // 여기서는 편의상 첫 번째 메인 창을 활성화하고 방 이동 명령을 보냅니다.
  const targetWindow = mainWindows[0];
  if (targetWindow) {
    if (targetWindow.isMinimized()) targetWindow.restore(); 
    targetWindow.show(); 
    targetWindow.focus(); 
    targetWindow.webContents.send('cmd-select-room', roomId);
  }
});

// 테스트 및 강제 활성화
ipcMain.on('window-show-focus', (event) => {
  // 요청을 보낸 창을 활성화
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMinimized()) win.restore(); 
    win.show(); 
    win.focus(); 
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


//-------------------------메인창 크기조절-----------------------------//
// 💡 [신규 추가] 마우스 이벤트 무시 설정 핸들러
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // ignore: true면 마우스 무시(통과), false면 마우스 감지
    // options: { forward: true }를 주면 무시하면서 뒤로 전달 (주로 true로 사용)
    win.setIgnoreMouseEvents(ignore, options);
  }
});

// 프론트엔드에서 계산된 새로운 bounds(x, y, width, height)를 받아서 적용합니다.
ipcMain.on('resize-window', (event, bounds) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setBounds(bounds);
  } else {
    console.log('[Main] Window not found or destroyed');
  }
});

// (선택 사항) 현재 창 크기/위치 요청 핸들러
ipcMain.handle('get-window-bounds', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.getBounds() : null;
});