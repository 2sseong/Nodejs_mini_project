// Electron 메인 프로세스

const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// [수정 1] 윈도우 투명 창 버그 방지를 위해 하드웨어 가속 끄기 (필수 권장)
app.disableHardwareAcceleration();

let backendProcess;
let notificationWindow = null;
let notifTimeout = null;
let chatWindows = {}; // 채팅창 관리 객체

// 메인 창 관리 배열
let mainWindows = [];

function startBackendServer() {
  const backendPath = path.join(__dirname, 'src');

  // 윈도우에서는 shell: true가 필요한 경우가 많음
  backendProcess = spawn('node', ['server.js'], {
    cwd: backendPath,
    shell: true,
    env: process.env
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend Log]: ${data}`);
    setTimeout(() => {
      if (mainWindows.length === 0) {
        // [수정 핵심] 테스트를 위해 서로 다른 파티션(세션)을 가진 두 개의 창을 엽니다.
        // persist: 접두어를 붙이면 앱을 껐다 켜도 로그인 정보가 유지됩니다.
        createWindow('persist:user1');
        createWindow('persist:user2');
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
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = 'http://localhost:5173/#/notification';
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
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    console.log('[Main] Notification window missing, recreating...');
    createNotificationWindow();
  }

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

function createWindow(partition = 'persist:user1') {
  let mainWindow = new BrowserWindow({
    action: 'auto',
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 640,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // [핵심] 파티션을 지정하여 세션(localStorage, 쿠키 등)을 분리합니다.
      partition: partition
    }
  });

  mainWindow.loadURL('http://localhost:5173');

  // 창 제목에 유저 구분 표시 (개발 편의용)
  mainWindow.setTitle(`Chat App - ${partition.split(':')[1]}`);

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

ipcMain.on('req-custom-notification', (event, data) => {
  showCustomNotification(data);
});

ipcMain.on('close-notification-window', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide();
  }
});

ipcMain.on('notification-clicked', (event, roomId) => {
  const targetWindow = mainWindows[0];
  if (targetWindow) {
    if (targetWindow.isMinimized()) targetWindow.restore();
    targetWindow.show();
    targetWindow.focus();
    targetWindow.webContents.send('cmd-select-room', roomId);
  }
});

ipcMain.on('window-show-focus', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

// [수정] 채팅방 창 열기 핸들러 (세션 및 멀티 윈도우 지원 + DevTools)
ipcMain.on('open-chat-window', (event, roomId) => {
  const parentId = event.sender.id;
  const windowKey = `${parentId}:${roomId}`;

  if (chatWindows[windowKey]) {
    if (chatWindows[windowKey].isMinimized()) chatWindows[windowKey].restore();
    chatWindows[windowKey].focus();
    return;
  }

  const parentSession = event.sender.session;

  const win = new BrowserWindow({
    width: 450,
    height: 600,
    minWidth: 450,
    minHeight: 600,
    title: '채팅방',
    frame: false,
    transparent: false,
    webPreferences: {
      session: parentSession,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        frame: false,
        transparent: false,
        autoHideMenuBar: true,
        webPreferences: {
          session: parentSession,
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      }
    };
  });

  const startUrl = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'
    ? `http://localhost:5173/#/popup/${roomId}`
    : `file://${path.join(__dirname, '../client/dist/index.html')}#/popup/${roomId}`;

  win.loadURL(startUrl);

  // [수정] 채팅방 팝업이 열릴 때 개발자 도구(F12)도 같이 열리도록 설정
  // mode: 'detach'는 별도 창으로 띄우는 옵션입니다.
  win.webContents.openDevTools({ mode: 'detach' });

  chatWindows[windowKey] = win;

  win.on('closed', () => {
    delete chatWindows[windowKey];
  });

  win.setMenu(null);
});

//-------------------------메인창 크기조절-----------------------------//
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('resize-window', (event, bounds) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setBounds(bounds);
  } else {
    console.log('[Main] Window not found or destroyed');
  }
});

ipcMain.handle('get-window-bounds', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.getBounds() : null;
});

//-------------------------파일 다운로드 및 이미지 미리보기-----------------------------//

// [추가] 이미지 미리보기 창 열기
ipcMain.on('open-image-preview', (event, { imageUrl, fileName }) => {
  const parentSession = event.sender.session;

  const previewWin = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    title: fileName || '이미지 미리보기',
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      session: parentSession,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 이미지 미리보기용 HTML 생성
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${fileName || '이미지 미리보기'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          cursor: zoom-in;
        }
        img.zoomed {
          max-width: none;
          max-height: none;
          cursor: zoom-out;
        }
      </style>
    </head>
    <body>
      <img src="${imageUrl}" alt="${fileName}" onclick="this.classList.toggle('zoomed')">
    </body>
    </html>
  `;

  previewWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  previewWin.setMenu(null);
});

// [추가] 파일 다운로드 (저장 대화상자 사용)
ipcMain.handle('download-file', async (event, { url, fileName }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);

    // 저장 다이얼로그 표시
    const result = await dialog.showSaveDialog(win, {
      defaultPath: fileName,
      title: '파일 저장',
      buttonLabel: '저장'
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: '취소됨' };
    }

    // HTTP(S) 요청으로 파일 다운로드
    const protocol = url.startsWith('https') ? https : http;

    return new Promise((resolve) => {
      const fileStream = fs.createWriteStream(result.filePath);

      protocol.get(url, (response) => {
        // 리다이렉트 처리
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectProtocol = response.headers.location.startsWith('https') ? https : http;
          redirectProtocol.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              resolve({ success: true, filePath: result.filePath });
            });
          }).on('error', (err) => {
            fs.unlink(result.filePath, () => { });
            resolve({ success: false, message: err.message });
          });
          return;
        }

        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ success: true, filePath: result.filePath });
        });
      }).on('error', (err) => {
        fs.unlink(result.filePath, () => { });
        resolve({ success: false, message: err.message });
      });
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// [추가] 외부 URL 열기 (브라우저에서)
ipcMain.on('open-external-url', (event, url) => {
  shell.openExternal(url);
});