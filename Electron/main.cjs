// Electron 메인 프로세스

const { app, BrowserWindow, ipcMain, screen, dialog, shell, Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', 'Server', '.env') });

// [수정 1] 윈도우 투명 창 버그 방지를 위해 하드웨어 가속 끄기 (필수 권장)
app.disableHardwareAcceleration();

let backendProcess;
let notificationWindow = null;
let notifTimeout = null;
let chatWindows = {}; // 채팅창 관리 객체
let tray = null; // 시스템 트레이

// 메인 창 관리 배열
let mainWindows = [];

// 배지 아이콘 동적 생성 함수 (숫자 표시)
function createBadgeIcon(count) {
  const size = 16;
  const canvas = require('canvas');
  // canvas 모듈이 없으면 간단한 nativeImage 사용
  // 숫자 배지는 nativeImage.createFromDataURL로 생성
  const text = count > 99 ? '99+' : String(count);

  // 간단한 빨간 원 SVG 생성
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FF3B30"/>
      <text x="${size / 2}" y="${size / 2 + 4}" font-size="10" font-family="Arial" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
    </svg>
  `;

  const base64 = Buffer.from(svg).toString('base64');
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
}

// Overlay 배지 아이콘 (빨간 점) - Buffer로 직접 생성
function createOverlayIcon() {
  // 16x16 이미지, 12px 빨간 원 (중앙에 작은 원)
  const size = 16;
  const channels = 4; // BGRA (Windows)
  const buffer = Buffer.alloc(size * size * channels);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 5; // 더 작은 원 (5px 반지름)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * channels;
      const distance = Math.sqrt((x - centerX + 0.5) ** 2 + (y - centerY + 0.5) ** 2);

      if (distance <= radius) {
        // 빨간색 - BGRA 순서 (Windows)
        buffer[index] = 48;      // B
        buffer[index + 1] = 59;  // G
        buffer[index + 2] = 255; // R
        buffer[index + 3] = 255; // A
      } else {
        // 투명
        buffer[index] = 0;
        buffer[index + 1] = 0;
        buffer[index + 2] = 0;
        buffer[index + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

// 트레이 생성 함수
function createTray() {
  // 회사 로고 사용
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  const trayIcon = nativeImage.createFromPath(logoPath).resize({ width: 20, height: 20 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Chat App');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기', click: () => {
        if (mainWindows.length > 0) {
          const win = mainWindows[0];
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '종료', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindows.length > 0) {
      const win = mainWindows[0];
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  console.log('[Main] Tray created');
}

function startBackendServer() {
  const backendPath = path.join(__dirname, '..', 'Server', 'src');

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
  // 회사 로고 아이콘
  const logoPath = path.join(__dirname, 'assets', 'logo.png');

  let mainWindow = new BrowserWindow({
    icon: logoPath,
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

  // webContents ID를 미리 저장 (closed 이벤트 시점에는 webContents가 destroyed됨)
  const mainWindowWebContentsId = mainWindow.webContents.id;

  mainWindow.on('closed', () => {
    // 이 메인 창에서 열린 채팅 창들을 모두 닫기
    Object.keys(chatWindows).forEach(key => {
      if (key.startsWith(`${mainWindowWebContentsId}:`)) {
        const chatWin = chatWindows[key];
        if (chatWin && !chatWin.isDestroyed()) {
          chatWin.close();
        }
        delete chatWindows[key];
      }
    });

    mainWindows = mainWindows.filter(win => win !== mainWindow);
    mainWindow = null;

    // 모든 메인 창이 닫히면 앱 종료 (Windows/Linux)
    if (mainWindows.length === 0 && process.platform !== 'darwin') {
      app.quit();
    }
  });

  // [추가] window.open으로 열리는 새 창(채팅방 등)에 대한 설정
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        frame: false,
        transparent: false,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
          partition: partition
        }
      }
    };
  });

  mainWindows.push(mainWindow);
  return mainWindow;
}

app.whenReady().then(() => {
  createTray(); // 시스템 트레이 생성
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

// [추가] 배지 업데이트 핸들러 - 각 창에 개별 적용
ipcMain.on('update-badge', (event, count) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  if (count > 0) {
    const icon = createOverlayIcon();
    win.setOverlayIcon(icon, `안 읽은 메시지 ${count}개`);
  } else {
    win.setOverlayIcon(null, '');
  }

  // 트레이 툴팁은 최대 count로 업데이트
  if (tray && !tray.isDestroyed()) {
    if (count > 0) {
      tray.setToolTip(`Chat App - 안 읽은 메시지 ${count}개`);
    } else {
      tray.setToolTip('Chat App');
    }
  }
});

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

// [추가] 알림 활성화 상태 (기본값: true)
let isNotificationEnabled = true;

ipcMain.on('set-notification-enabled', (event, enabled) => {
  isNotificationEnabled = enabled;
  console.log(`[Main] Notification ${enabled ? 'enabled' : 'disabled'}`);
});

ipcMain.on('req-custom-notification', (event, data) => {
  // 알림이 비활성화된 경우 알림 표시하지 않음
  if (!isNotificationEnabled) {
    console.log('[Main] Skipping notification - notifications disabled');
    return;
  }
  // SYSTEM 메시지는 알림 표시하지 않음
  if (data.nickname === 'SYSTEM') {
    console.log('[Main] Skipping notification for SYSTEM message');
    return;
  }
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
    width: 400,
    height: 600,
    minWidth: 400,
    minHeight: 600,
    title: '채팅방',
    frame: false,
    transparent: false,
    show: false, // [최적화] 로드 완료 전까지 숨김 (흰 화면 깜빡임 방지)
    webPreferences: {
      session: parentSession,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // [최적화] 로드 완료 시 창 표시 (체감 속도 개선)
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
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
    : `file://${path.join(__dirname, '..', 'Client', 'dist', 'index.html')}#/popup/${roomId}`;

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