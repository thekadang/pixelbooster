/**
 * Electron Main Process (TypeScript)
 * Electron 앱의 진입점으로 BrowserWindow 생성 및 라이프사이클 관리
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs/promises';

// 타입 임포트
import {
  IPC_CHANNELS,
  AppInfo,
  FileInfo,
  BatchProcessResponse,
  BatchProcessProgress,
  Result,
  ImageProcessOptions,
  UpdateInfo,
} from './src/types/ipc';

// 서비스 임포트
import { imageProcessor } from './src/services/image-processor';
import { authManager } from './src/services/auth-manager';
import { subscriptionManager } from './src/services/subscription-manager';
import { LogManager } from './src/services/log-manager';
import { BackupManager } from './src/services/backup-manager';
import { AffiliateManager } from './src/services/affiliate-manager';

// 개발 환경 판단 (Electron 내장 API 사용)
// app.isPackaged: true = 프로덕션 빌드, false = 개발 모드
const isDevelopment: boolean = !app.isPackaged;

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
  setupAutoUpdater();

  // 프로덕션 환경에서만 자동 업데이트 확인 (5초 후)
  if (!isDevelopment) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }

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

  // 배치 이미지 처리 시작 (백업 + 변환 + 로그 통합)
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

        // 1단계: 원본 파일 백업 (BackupManager)
        console.log('1단계: 원본 파일 백업 시작');
        const backupManager = new BackupManager();
        const backupResult = await backupManager.backupBatch(
          files,
          (progress) => {
            // 백업 진행 상태를 Renderer로 전송 (선택적)
            console.log(`백업 진행: ${progress.completed}/${progress.total}`);
          }
        );

        if (!backupResult.success) {
          console.error('백업 실패:', backupResult.error);
          return {
            success: false,
            message: `백업 실패: ${backupResult.error}`,
          };
        }

        console.log(`백업 완료: ${backupResult.data.successCount} 성공, ${backupResult.data.failedCount} 실패`);

        // 2단계: 이미지 변환 (ImageProcessor)
        console.log('2단계: 이미지 변환 시작');
        const onProgress = (progress: BatchProcessProgress) => {
          event.sender.send(IPC_CHANNELS.BATCH_PROGRESS, progress);
        };

        const processResult = await imageProcessor.processBatch(
          files,
          options.outputDir,
          options,
          onProgress
        );

        if (!processResult.success) {
          console.error('이미지 변환 실패:', processResult.error);
          event.sender.send(IPC_CHANNELS.PROCESSING_ERROR, processResult.error);

          return {
            success: false,
            message: processResult.error,
          };
        }

        const batchProgress = processResult.data;
        console.log(`변환 완료: ${batchProgress.completed} 성공, ${batchProgress.failed} 실패`);

        // 3단계: 작업 로그 기록 (LogManager)
        console.log('3단계: 작업 로그 기록 시작');
        const logManager = new LogManager();
        const logResult = await logManager.appendBatchLog(batchProgress);

        if (!logResult.success) {
          console.warn('로그 기록 실패 (처리는 성공):', logResult.error);
          // 로그 실패는 경고만 표시하고 계속 진행
        } else {
          console.log('로그 기록 완료');
        }

        // 처리 완료 이벤트 전송
        event.sender.send(IPC_CHANNELS.PROCESSING_COMPLETE, batchProgress);

        return {
          success: true,
          message: `처리 완료: ${batchProgress.completed}개 성공, ${batchProgress.failed}개 실패`,
        };
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

  // ============================
  // 어필리에이트 관리 IPC 핸들러
  // ============================
  const affiliateManager = new AffiliateManager();

  // 추적 링크 생성 (또는 조회)
  ipcMain.handle(IPC_CHANNELS.AFFILIATE_CREATE_LINK, async (_event: IpcMainInvokeEvent) => {
    try {
      // 현재 로그인한 사용자 ID 조회
      const authResult = await authManager.getAuthState();
      if (!authResult.isAuthenticated || !authResult.user) {
        return { success: false, error: '로그인이 필요합니다.' };
      }

      const userId = authResult.user.id;
      const result = await affiliateManager.createTrackingLink(userId);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `추적 링크 생성 실패: ${errorMessage}` };
    }
  });

  // 추적 링크 클릭 추적 (쿠키 저장)
  ipcMain.handle(
    IPC_CHANNELS.AFFILIATE_TRACK_REFERRAL,
    async (_event: IpcMainInvokeEvent, trackingCode: string) => {
      try {
        await affiliateManager.trackReferral(trackingCode);
        return { success: true, message: '추천 코드가 저장되었습니다.' };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return { success: false, error: `추천 추적 실패: ${errorMessage}` };
      }
    }
  );

  // 회원가입 시 추천 연결
  ipcMain.handle(
    IPC_CHANNELS.AFFILIATE_LINK_TO_USER,
    async (_event: IpcMainInvokeEvent, userId: string, subscriptionId: string) => {
      try {
        await affiliateManager.linkReferralToUser(userId, subscriptionId);
        return { success: true, message: '추천이 연결되었습니다.' };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('[Main] 추천 연결 실패:', errorMessage);
        // 추천 연결 실패는 치명적이지 않으므로 경고만 표시
        return { success: true, message: '추천 연결 선택적 실패 (계속 진행)' };
      }
    }
  );

  // 어필리에이트 통계 조회
  ipcMain.handle(IPC_CHANNELS.AFFILIATE_GET_STATS, async (_event: IpcMainInvokeEvent) => {
    try {
      // 현재 로그인한 사용자 ID 조회
      const authResult = await authManager.getAuthState();
      if (!authResult.isAuthenticated || !authResult.user) {
        return { success: false, error: '로그인이 필요합니다.' };
      }

      const userId = authResult.user.id;
      const result = await affiliateManager.getReferralStats(userId);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `통계 조회 실패: ${errorMessage}` };
    }
  });

  // 추천 내역 조회
  ipcMain.handle(IPC_CHANNELS.AFFILIATE_GET_REFERRALS, async (_event: IpcMainInvokeEvent) => {
    try {
      // 현재 로그인한 사용자 ID 조회
      const authResult = await authManager.getAuthState();
      if (!authResult.isAuthenticated || !authResult.user) {
        return { success: false, error: '로그인이 필요합니다.' };
      }

      const userId = authResult.user.id;

      // Supabase에서 추천 내역 조회
      const { data, error } = await affiliateManager['supabase']
        .from('affiliate_referrals')
        .select(`
          id,
          created_at,
          referred_user:auth.users!referred_user_id(email),
          subscription:subscriptions!subscription_id(tier, status)
        `)
        .eq('affiliate_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 데이터 포맷 변환 (MVP: 실제 수익 계산은 추후 구현)
      const referrals = (data || []).map((ref: any) => ({
        created_at: ref.created_at,
        user_email: ref.referred_user?.email || '알 수 없음',
        subscription_status: ref.subscription?.status || 'unknown',
        subscription_tier: ref.subscription?.tier || 'free',
        this_month_revenue: 0, // MVP: 추후 revenue_logs 테이블에서 계산
        total_revenue: 0, // MVP: 추후 revenue_logs 테이블에서 계산
      }));

      return { success: true, data: referrals };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `추천 내역 조회 실패: ${errorMessage}` };
    }
  });

  // ============================
  // 자동 업데이트 관리 IPC 핸들러
  // ============================

  // 업데이트 확인
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    if (isDevelopment) {
      return { success: false, message: '개발 환경에서는 업데이트를 확인할 수 없습니다.' };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        available: result !== null,
        updateInfo: result?.updateInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `업데이트 확인 실패: ${errorMessage}` };
    }
  });

  // 업데이트 다운로드
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true, message: '업데이트 다운로드 시작' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, error: `업데이트 다운로드 실패: ${errorMessage}` };
    }
  });

  // 업데이트 설치 및 재시작
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    // 앱 종료 후 업데이트 설치
    autoUpdater.quitAndInstall(false, true);
    return { success: true, message: '앱을 재시작하여 업데이트를 설치합니다.' };
  });

  // 현재 버전 조회
  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_VERSION, () => {
    return { success: true, version: app.getVersion() };
  });
}

/**
 * 자동 업데이트 시스템 설정
 */
function setupAutoUpdater(): void {
  // 개발 환경에서는 자동 업데이트 비활성화
  if (isDevelopment) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    console.log('[AutoUpdater] 개발 환경: 자동 업데이트 비활성화');
    return;
  }

  // 자동 다운로드 활성화
  autoUpdater.autoDownload = false; // 사용자 확인 후 다운로드
  autoUpdater.autoInstallOnAppQuit = true; // 앱 종료 시 자동 설치

  // 업데이트 확인 시작
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] 업데이트 확인 중...');
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_CHECKING);
  });

  // 업데이트 발견
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] 업데이트 발견:', info.version);
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(note => typeof note === 'string' ? note : note.note).join('\n')
          : undefined,
      releaseDate: info.releaseDate,
    };
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_AVAILABLE, updateInfo);
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] 최신 버전 사용 중:', info.version);
    const updateInfo: UpdateInfo = {
      version: info.version,
    };
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, updateInfo);
  });

  // 업데이트 오류
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] 업데이트 오류:', err);
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_ERROR, {
      message: err.message,
    });
  });

  // 다운로드 진행률
  autoUpdater.on('download-progress', (progressObj) => {
    console.log(
      `[AutoUpdater] 다운로드 진행: ${progressObj.percent.toFixed(2)}% (${progressObj.bytesPerSecond} bytes/s)`
    );
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    });
  });

  // 다운로드 완료
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] 업데이트 다운로드 완료:', info.version);
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(note => typeof note === 'string' ? note : note.note).join('\n')
          : undefined,
      releaseDate: info.releaseDate,
    };
    mainWindow?.webContents.send(IPC_CHANNELS.UPDATE_DOWNLOADED, updateInfo);
  });

  console.log('[AutoUpdater] 자동 업데이트 시스템 초기화 완료');
}
