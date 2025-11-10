/**
 * Electron Main Process (TypeScript)
 * Electron 앱의 진입점으로 BrowserWindow 생성 및 라이프사이클 관리
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs/promises';
import isDev from 'electron-is-dev';

// 타입 임포트
import {
  IPC_CHANNELS,
  AppInfo,
  FileInfo,
  BatchProcessResponse,
  BatchProcessProgress,
  Result,
  ImageProcessOptions,
} from './src/types/ipc';

// ImageProcessor 임포트
import { imageProcessor } from './src/services/image-processor';

// 개발 환경 판단
const isDevelopment: boolean = isDev;

// 메인 윈도우 참조
let mainWindow: BrowserWindow | null = null;

/**
 * 메인 윈도우 생성
 */
function createMainWindow(): void {
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
      preload: path.join(__dirname, 'preload.js'),
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
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true,
      })
    );
  }

  // 개발자 도구 자동 열기 (개발/프로덕션 모두)
  mainWindow.webContents.openDevTools();

  // 로딩 완료 후 윈도우 표시
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
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
  setupIpcHandlers();

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
 * IPC 핸들러 설정
 */
function setupIpcHandlers(): void {
  // 앱 정보 요청
  ipcMain.on(IPC_CHANNELS.APP_INFO, (event) => {
    const appInfo: AppInfo = {
      version: app.getVersion(),
      name: app.getName(),
      platform: process.platform,
    };
    event.reply(IPC_CHANNELS.APP_INFO_REPLY, appInfo);
  });

  // 파일 선택 다이얼로그
  ipcMain.handle(
    IPC_CHANNELS.OPEN_FILE_DIALOG,
    async (): Promise<Result<string[]>> => {
      if (!mainWindow) {
        return { success: false, error: '윈도우가 초기화되지 않았습니다' };
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: '이미지',
            extensions: [
              'jpg',
              'jpeg',
              'png',
              'gif',
              'bmp',
              'tiff',
              'tif',
              'webp',
              'avif',
              'svg',
              'heif',
              'heic',
            ],
          },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '파일 선택이 취소되었습니다' };
      }

      return { success: true, data: result.filePaths };
    }
  );

  // 폴더 선택 다이얼로그
  ipcMain.handle(
    IPC_CHANNELS.OPEN_FOLDER_DIALOG,
    async (): Promise<Result<string>> => {
      if (!mainWindow) {
        return { success: false, error: '윈도우가 초기화되지 않았습니다' };
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '폴더 선택이 취소되었습니다' };
      }

      return { success: true, data: result.filePaths[0] };
    }
  );

  // 배치 이미지 처리 시작
  ipcMain.handle(
    IPC_CHANNELS.START_BATCH_PROCESS,
    async (
      event: IpcMainInvokeEvent,
      files: string[],
      options: ImageProcessOptions
    ): Promise<BatchProcessResponse> => {
      try {
        console.log('배치 처리 시작:', { files: files.length, options });

        // 출력 디렉토리 검증
        if (!options.outputDir) {
          return {
            success: false,
            message: '출력 디렉토리가 지정되지 않았습니다.',
          };
        }

        // 진행 상태 콜백: Renderer로 실시간 전송
        const onProgress = (progress: BatchProcessProgress) => {
          event.sender.send(IPC_CHANNELS.BATCH_PROGRESS, progress);
        };

        // ImageProcessor를 통한 배치 처리 시작
        const result = await imageProcessor.processBatch(
          files,
          options.outputDir,
          options,
          onProgress
        );

        if (result.success) {
          // 처리 완료 이벤트 전송
          event.sender.send(IPC_CHANNELS.PROCESSING_COMPLETE, result.data);

          return {
            success: true,
            message: `처리 완료: ${result.data.completed}개 성공, ${result.data.failed}개 실패`,
          };
        } else {
          // 에러 이벤트 전송
          event.sender.send(IPC_CHANNELS.PROCESSING_ERROR, result.error);

          return {
            success: false,
            message: result.error,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('배치 처리 실패:', errorMessage);

        // 에러 이벤트 전송
        event.sender.send(IPC_CHANNELS.PROCESSING_ERROR, errorMessage);

        return {
          success: false,
          message: `배치 처리 실패: ${errorMessage}`,
        };
      }
    }
  );

  // 배치 처리 취소
  ipcMain.on(IPC_CHANNELS.CANCEL_BATCH_PROCESS, () => {
    console.log('배치 처리 취소 요청');
    imageProcessor.cancelBatch();
  });

  // 파일 정보 가져오기
  ipcMain.handle(
    IPC_CHANNELS.GET_FILE_INFO,
    async (_event: IpcMainInvokeEvent, filePath: string): Promise<Result<FileInfo>> => {
      try {
        const stats = await fs.stat(filePath);
        const parsedPath = path.parse(filePath);

        const fileInfo: FileInfo = {
          path: filePath,
          name: parsedPath.base,
          extension: parsedPath.ext.slice(1),
          size: stats.size,
        };

        return {
          success: true,
          data: fileInfo,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '알 수 없는 오류';
        return {
          success: false,
          error: `파일 정보를 가져올 수 없습니다: ${errorMessage}`,
        };
      }
    }
  );
}
