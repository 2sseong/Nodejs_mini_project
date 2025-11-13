// electron/main.js (CommonJS 형식)

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
// dotenv를 CommonJS 방식으로 로드
const dotenv = require('dotenv');

let serverProcess = null; // 서버 프로세스 객체 저장

/**
 * 백엔드 서버를 자식 프로세스로 실행합니다.
 */
function startBackendServer() {
    // 💡 1. 개발 환경 경로 설정 (프로젝트 루트 기준)
    // __dirname (electron) -> .. (Mini_project) -> NodejsWebApp1
    const backendRoot = path.join(__dirname, '..', 'NodejsWebApp1');
    const serverPath = path.join(backendRoot, 'src', 'server.js');
    
    // 💡 2. .env 파일 명시적 로드 및 환경 변수 준비
    // .env 파일이 Mini_project 루트에 있다고 가정합니다.
    const projectRoot = path.join(__dirname, '..');
    const envConfig = dotenv.config({ path: path.join(projectRoot, '.env') }).parsed || {};

    // 💡 3. 서버 실행 시 환경 변수 전달 (DB 정보 포함)
    const envVars = { ...process.env, ...envConfig, PORT: '1337' };

    console.log(`Starting server from: ${serverPath}`);

    // node 명령어를 사용하여 서버 실행
    serverProcess = spawn('node', [serverPath], {
        cwd: backendRoot, // NodejsWebApp1 루트를 작업 디렉토리로 지정 (DB 경로 안정화)
        stdio: 'inherit', // 서버 로그를 Electron 콘솔에 출력
        env: envVars      // DB 자격 증명을 env로 전달
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start backend server:', err);
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`Backend server exited with code ${code}, signal ${signal}`);
    });
}

/**
 * Electron 윈도우를 생성하고 React 앱을 로드합니다.
 */
const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        webPreferences: {
            // preload.js도 CommonJS 형식으로 변경되었다고 가정합니다.
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // CSP 설정은 그대로 유지
            contentSecurityPolicy: "default-src 'self'; " +
                                   "script-src 'self' 'unsafe-inline'; " +
                                   "style-src 'self' 'unsafe-inline'; " +
                                   "connect-src 'self' http://localhost:1337 ws://localhost:1337;"
        }
    });

    mainWindow.webContents.openDevTools();

    // 🚨 4. React 앱 로드: 로컬 파일 로드 대신 서버 URL 로드로 변경하여 404 문제 해결
    // 백엔드 서버가 React의 index.html을 서빙할 것입니다.
    mainWindow.loadURL('http://localhost:1337');
};

// 앱이 준비되었을 때 윈도우 생성
app.whenReady().then(() => {
    // 서버를 먼저 실행합니다.
    startBackendServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 모든 윈도우가 닫혔을 때 앱 종료
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 앱 종료 시 서버 프로세스도 종료
app.on('will-quit', () => {
    if (serverProcess) {
        console.log('Killing backend server process...');
        serverProcess.kill();
    }
});