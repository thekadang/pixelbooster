// Electron Main Process
// Electron 앱의 진입점으로 BrowserWindow 생성 및 라이프사이클 관리

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const isDev = require('electron-is-dev');

// 개발 환경 판단
const isDevelopment = isDev;

// 메인 윈도우 참조
let mainWindow;

/**
 * 메인 윈도우 생성
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Node.js 통합 활성화
      nodeIntegration: true,
      // 컨텍스트 격리 비활성화 (보안상 프로덕션에서는 활성화 권장)
      contextIsolation: false,
      // preload 스크립트 경로 (향후 보안 강화 시 사용)
      preload: path.join(__dirname, 'preload.js')
    },
    // 초기에는 윈도우 숨기기 (로딩 완료 후 표시)
    show: false,
    // 타이틀바 설정
    title: '픽셀부스터',
    // 아이콘 설정 (향후 추가)
    // icon: path.join(__dirname, 'assets/icon.png')
  });

  // 개발 환경: webpack-dev-server에서 로드
  // 프로덕션: 빌드된 HTML 파일 로드
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:3000');
    // 개발자 도구 자동 열기
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  // 로딩 완료 후 윈도우 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 윈도우가 닫힐 때 참조 해제
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Electron 앱 초기화
 */
app.whenReady().then(() => {
  createMainWindow();

  // macOS: 독에서 클릭 시 윈도우 재생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * 모든 윈도우가 닫힐 때
 * macOS를 제외한 플랫폼에서는 앱 종료
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC 통신 예시
 * Renderer Process에서 보낸 메시지 처리
 */
ipcMain.on('app-info', (event) => {
  event.reply('app-info-reply', {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform
  });
});

/**
 * IPC 핸들러: 파일 선택 다이얼로그
 */
ipcMain.handle('open-file-dialog', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: '이미지',
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'avif', 'svg', 'heif', 'heic']
      }
    ]
  });

  if (result.canceled) {
    return { success: false, error: '파일 선택이 취소되었습니다' };
  }

  return { success: true, data: result.filePaths };
});

/**
 * IPC 핸들러: 폴더 선택 다이얼로그
 */
ipcMain.handle('open-folder-dialog', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return { success: false, error: '폴더 선택이 취소되었습니다' };
  }

  return { success: true, data: result.filePaths[0] };
});

/**
 * IPC 핸들러: 배치 이미지 처리 시작
 */
ipcMain.handle('start-batch-process', async (event, files, options) => {
  // ImageProcessor는 나중에 TypeScript로 변환 후 import
  // 현재는 기본 응답만 반환
  console.log('배치 처리 시작:', { files: files.length, options });

  // 진행 상태 업데이트 예시
  event.sender.send('batch-progress', {
    total: files.length,
    completed: 0,
    failed: 0,
    processing: 1,
    overallProgress: 0,
    items: []
  });

  // 실제 구현은 TypeScript 마이그레이션 후 추가
  return {
    success: true,
    message: 'ImageProcessor 구현 대기 중'
  };
});

/**
 * IPC 핸들러: 배치 처리 취소
 */
ipcMain.on('cancel-batch-process', () => {
  console.log('배치 처리 취소 요청');
  // ImageProcessor.cancelBatch() 호출 예정
});

/**
 * IPC 핸들러: 파일 정보 가져오기
 */
ipcMain.handle('get-file-info', async (event, filePath) => {
  const fs = require('fs').promises;
  const pathModule = require('path');

  try {
    const stats = await fs.stat(filePath);
    const parsedPath = pathModule.parse(filePath);

    return {
      success: true,
      data: {
        path: filePath,
        name: parsedPath.base,
        extension: parsedPath.ext.slice(1),
        size: stats.size
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `파일 정보를 가져올 수 없습니다: ${error.message}`
    };
  }
});
