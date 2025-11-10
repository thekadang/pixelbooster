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

// 서비스 임포트
import { imageProcessor } from './src/services/image-processor';
import { authManager } from './src/services/auth-manager';
import { subscriptionManager } from './src/services/subscription-manager';
import { LogManager } from './src/services/log-manager';
import { BackupManager } from './src/services/backup-manager';

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

  // ===== 인증 관련 IPC 핸들러 =====

  // 로그인
  ipcMain.handle(
    IPC_CHANNELS.AUTH_SIGN_IN,
    async (_event: IpcMainInvokeEvent, email: string, password: string) => {
      try {
        const result = await authManager.signIn({ email, password });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `로그인 실패: ${errorMessage}` };
      }
    }
  );

  // 회원가입
  ipcMain.handle(
    IPC_CHANNELS.AUTH_SIGN_UP,
    async (_event: IpcMainInvokeEvent, email: string, password: string, fullName?: string) => {
      try {
        const result = await authManager.signUp({
          email,
          password,
          metadata: { fullName },
        });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `회원가입 실패: ${errorMessage}` };
      }
    }
  );

  // 로그아웃
  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    try {
      const result = await authManager.signOut();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `로그아웃 실패: ${errorMessage}` };
    }
  });

  // 비밀번호 재설정
  ipcMain.handle(
    IPC_CHANNELS.AUTH_RESET_PASSWORD,
    async (_event: IpcMainInvokeEvent, email: string) => {
      try {
        const result = await authManager.resetPassword(email);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `비밀번호 재설정 실패: ${errorMessage}` };
      }
    }
  );

  // 인증 상태 조회
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_STATE, () => {
    try {
      const state = authManager.getAuthState();
      return { success: true, data: state };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `인증 상태 조회 실패: ${errorMessage}` };
    }
  });

  // 인증 상태 변경 리스너 등록
  authManager.onAuthStateChange((state) => {
    // 모든 윈도우에 인증 상태 변경 알림
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        isAuthenticated: state.isAuthenticated,
        user: state.user
          ? {
              id: state.user.id,
              email: state.user.email || '',
              emailConfirmedAt: state.user.email_confirmed_at,
            }
          : null,
      });
    }
  });

  // ===== 구독 관리 IPC 핸들러 =====

  // 구독 정보 조회
  ipcMain.handle(
    IPC_CHANNELS.SUBSCRIPTION_GET,
    async (_event: IpcMainInvokeEvent, userId: string) => {
      try {
        const result = await subscriptionManager.getSubscription(userId);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `구독 조회 실패: ${errorMessage}` };
      }
    }
  );

  // 구독 정보 강제 갱신
  ipcMain.handle(
    IPC_CHANNELS.SUBSCRIPTION_REFRESH,
    async (_event: IpcMainInvokeEvent, userId: string) => {
      try {
        const result = await subscriptionManager.getSubscription(userId, true);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `구독 갱신 실패: ${errorMessage}` };
      }
    }
  );

  // 포맷 지원 여부 확인
  ipcMain.handle(
    IPC_CHANNELS.SUBSCRIPTION_CHECK_FORMAT,
    async (_event: IpcMainInvokeEvent, format: string, userId: string) => {
      try {
        const result = await subscriptionManager.isFormatSupported(format as any, userId);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `포맷 확인 실패: ${errorMessage}` };
      }
    }
  );

  // 배치 크기 검증
  ipcMain.handle(
    IPC_CHANNELS.SUBSCRIPTION_VALIDATE_BATCH,
    async (_event: IpcMainInvokeEvent, batchSize: number, userId: string) => {
      try {
        const result = await subscriptionManager.validateBatchSize(batchSize, userId);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `배치 크기 검증 실패: ${errorMessage}` };
      }
    }
  );

  // ===== 로그 관리 IPC 핸들러 =====

  // LogManager 인스턴스 생성
  const logManager = new LogManager();

  // 로그 파일 생성
  ipcMain.handle(
    IPC_CHANNELS.LOG_CREATE_FILE,
    async (_event: IpcMainInvokeEvent, date?: string) => {
      try {
        const dateObj = date ? new Date(date) : undefined;
        const result = await logManager.createLogFile(dateObj);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `로그 파일 생성 실패: ${errorMessage}` };
      }
    }
  );

  // 배치 로그 추가
  ipcMain.handle(
    IPC_CHANNELS.LOG_APPEND_BATCH,
    async (_event: IpcMainInvokeEvent, batchProgress: any, logFilePath?: string) => {
      try {
        const result = await logManager.appendBatchLog(batchProgress, logFilePath);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `로그 추가 실패: ${errorMessage}` };
      }
    }
  );

  // 로그 이력 조회
  ipcMain.handle(
    IPC_CHANNELS.LOG_GET_HISTORY,
    async (_event: IpcMainInvokeEvent, startDate?: string, endDate?: string) => {
      try {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const result = await logManager.getLogHistory(start, end);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `로그 조회 실패: ${errorMessage}` };
      }
    }
  );

  // Excel 파일 내보내기
  ipcMain.handle(
    IPC_CHANNELS.LOG_EXPORT_EXCEL,
    async (
      _event: IpcMainInvokeEvent,
      startDate: string,
      endDate: string,
      outputPath: string
    ) => {
      try {
        const result = await logManager.exportToExcel(
          new Date(startDate),
          new Date(endDate),
          outputPath
        );
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `Excel 내보내기 실패: ${errorMessage}` };
      }
    }
  );

  // ===== 백업 관리 IPC 핸들러 =====

  // BackupManager 인스턴스 생성
  const backupManager = new BackupManager();

  // 단일 파일 백업
  ipcMain.handle(IPC_CHANNELS.BACKUP_FILE, async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const result = await backupManager.backupFile(filePath);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `파일 백업 실패: ${errorMessage}` };
    }
  });

  // 배치 파일 백업
  ipcMain.handle(IPC_CHANNELS.BACKUP_BATCH, async (_event: IpcMainInvokeEvent, files: string[]) => {
    try {
      const result = await backupManager.backupBatch(files, (progress) => {
        // 진행 상태를 Renderer로 전송
        _event.sender.send('backup-progress', progress);
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `배치 백업 실패: ${errorMessage}` };
    }
  });

  // 파일 복원
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_RESTORE,
    async (_event: IpcMainInvokeEvent, backupId: string, targetPath?: string) => {
      try {
        const result = await backupManager.restoreFile(backupId, targetPath);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `파일 복원 실패: ${errorMessage}` };
      }
    }
  );

  // 배치 파일 복원
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_RESTORE_BATCH,
    async (_event: IpcMainInvokeEvent, backupIds: string[]) => {
      try {
        const result = await backupManager.restoreBatch(backupIds, (progress) => {
          // 진행 상태를 Renderer로 전송
          _event.sender.send('backup-restore-progress', progress);
        });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `배치 복원 실패: ${errorMessage}` };
      }
    }
  );

  // 백업 목록 조회
  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async (_event: IpcMainInvokeEvent, filters?: any) => {
    try {
      const result = await backupManager.listBackups(filters);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `백업 목록 조회 실패: ${errorMessage}` };
    }
  });

  // 백업 삭제
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_DELETE,
    async (_event: IpcMainInvokeEvent, backupId: string) => {
      try {
        const result = await backupManager.deleteBackup(backupId);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `백업 삭제 실패: ${errorMessage}` };
      }
    }
  );
}
