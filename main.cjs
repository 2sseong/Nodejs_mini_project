// Electron 메인 프로세스

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process'); // 서버 실행을 위한 모듈
// dotenv 모듈 로드
require('dotenv').config({path:path.join(__dirname, '.env')});

let mainWindow;
let backendProcess;

// 1. 백엔드 서버 실행 함수
function startBackendServer() {
  const backendPath = path.join(__dirname, 'src'); // 백엔드 서버의 진입점 폴더

  // Node.js 환경에서 'node server.js'를 직접 실행하는 대신,
  // Node.js 프로세스를 생성
  backendProcess = spawn('node', ['server.js'], {
    cwd: backendPath, 
    shell: true,
    env: process.env // Electron 메인 프로세스의 환경변수를 자식 프로세스에 전달
  }); 
  

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend Log]: ${data}`);
    // 서버가 완전히 준비된 후 창을 띄우기 위해, 실제 서버 로그 메시지를 감지하는 것이 좋음
    // ex)서버가 'Listening on port 8080' 이라는 로그를 출력하면 그 때 createWindow()를 호출
    
    // 3초 대기
    if (!mainWindow) {
        setTimeout(createWindow, 3000); 
    }
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error]: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
  });
}

// 2. Electron 창 생성 함수
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, 
      // preload: path.join(__dirname, 'preload.js') // IPC 통신이 필요하면 추가
    }
  });
  
  // 다음 단계에서 이 주소를 리액트 개발 서버 또는 빌드 파일로 변경합니다.
  mainWindow.loadURL('http://localhost:5173'); 
  
  mainWindow.webContents.openDevTools();
}

// 3. 앱 생명 주기 관리
app.whenReady().then(() => {
  startBackendServer(); 
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // 앱 종료 시 백엔드 서버 프로세스도 종료
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});