"use strict";
/**
 * Electron Main Process (TypeScript)
 * Electron 앱의 진입점으로 BrowserWindow 생성 및 라이프사이클 관리
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// ⚠️ CRITICAL: dotenv를 가장 먼저 로드 (다른 import보다 먼저!)
// 프로덕션 빌드에서 환경 변수를 process.env에 로드하기 위해 필요
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// 개발 환경: 프로젝트 루트의 .env 파일 로드
// 프로덕션: 실행 파일 위치의 .env 파일 로드
const envPath = process.env.NODE_ENV === 'production'
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });
// 환경 변수 로드 확인 (디버깅용)
console.log('[ENV] Supabase URL:', process.env.SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('[ENV] Supabase Anon Key:', process.env.SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const url = __importStar(require("url"));
const fs = __importStar(require("fs/promises"));
// 타입 임포트
const ipc_1 = require("./src/types/ipc");
// 서비스 임포트
const image_processor_1 = require("./src/services/image-processor");
const auth_manager_1 = require("./src/services/auth-manager");
const subscription_manager_1 = require("./src/services/subscription-manager");
const log_manager_1 = require("./src/services/log-manager");
const backup_manager_1 = require("./src/services/backup-manager");
const affiliate_manager_1 = require("./src/services/affiliate-manager");
// 개발 환경 판단 (Electron 내장 API 사용)
// app.isPackaged: true = 프로덕션 빌드, false = 개발 모드
const isDevelopment = !electron_1.app.isPackaged;
// 메인 윈도우 참조
let mainWindow = null;
/**
 * 메인 윈도우 생성
 */
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            // Node.js 통합 활성화
            nodeIntegration: true,
            // 컨텍스트 격리 비활성화 (보안상 프로덕션에서는 활성화 권장)
            contextIsolation: false,
            // preload 스크립트 경로 (개발/프로덕션 환경 분리)
            preload: isDevelopment
                ? path.join(__dirname, 'preload.js')
                : path.join(__dirname, '..', 'dist-electron', 'preload.js'),
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
    }
    else {
        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'dist/index.html'),
            protocol: 'file:',
            slashes: true,
        }));
    }
    // 개발자 도구 자동 열기 (디버깅을 위해 임시로 항상 활성화)
    // TODO: 프로덕션 배포 시 isDevelopment 조건으로 변경
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
 * Deep Link 핸들러 설정
 * 이메일 인증 링크 처리: pixelbooster://email-confirmed?token=xxx
 */
function setupDeepLinkHandler() {
    // Windows & Linux: 두 번째 인스턴스 실행 시 첫 번째 인스턴스로 포커스 이동
    const gotTheLock = electron_1.app.requestSingleInstanceLock();
    if (!gotTheLock) {
        // 이미 실행 중인 인스턴스가 있으면 종료
        electron_1.app.quit();
    }
    else {
        // 두 번째 인스턴스 실행 시 처리
        electron_1.app.on('second-instance', (_event, commandLine, _workingDirectory) => {
            // 윈도우 포커스
            if (mainWindow) {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                mainWindow.focus();
                // Deep Link URL 처리
                const url = commandLine.find((arg) => arg.startsWith('pixelbooster://'));
                if (url) {
                    handleDeepLink(url);
                }
            }
        });
    }
    // macOS: 앱이 이미 실행 중일 때 Deep Link 처리
    electron_1.app.on('open-url', (event, url) => {
        event.preventDefault();
        handleDeepLink(url);
    });
}
/**
 * Deep Link URL 파싱 및 처리
 * @param url - pixelbooster://email-confirmed?token=xxx
 */
function handleDeepLink(url) {
    console.log('[DeepLink] Received URL:', url);
    try {
        const parsedUrl = new URL(url);
        const action = parsedUrl.hostname; // 'email-confirmed', 'reset-password' 등
        if (action === 'email-confirmed') {
            // 이메일 인증 완료
            const token = parsedUrl.searchParams.get('token');
            const type = parsedUrl.searchParams.get('type');
            console.log('[DeepLink] Email confirmed:', { token, type });
            // Renderer 프로세스로 이벤트 전송
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('email-confirmed', { token, type });
                // 성공 메시지 다이얼로그 표시
                electron_1.dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '이메일 인증 완료',
                    message: '이메일 인증이 완료되었습니다!',
                    detail: '이제 로그인하여 픽셀부스터를 사용할 수 있습니다.',
                    buttons: ['확인'],
                });
            }
        }
        else if (action === 'reset-password') {
            // 비밀번호 재설정
            const token = parsedUrl.searchParams.get('token');
            console.log('[DeepLink] Reset password:', { token });
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('reset-password', { token });
            }
        }
    }
    catch (error) {
        console.error('[DeepLink] URL parsing error:', error);
    }
}
/**
 * Electron 앱 초기화
 */
electron_1.app.whenReady().then(() => {
    // Deep Link 핸들러 설정 (Windows/Linux)
    setupDeepLinkHandler();
    createMainWindow();
    setupIpcHandlers();
    setupAutoUpdater();
    // 프로덕션 환경에서만 자동 업데이트 확인 (5초 후)
    if (!isDevelopment) {
        setTimeout(() => {
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        }, 5000);
    }
    // macOS: 독에서 클릭 시 윈도우 재생성
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});
/**
 * 모든 윈도우가 닫힐 때
 * macOS를 제외한 플랫폼에서는 앱 종료
 */
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
/**
 * IPC 핸들러 설정
 */
function setupIpcHandlers() {
    // 앱 정보 요청
    electron_1.ipcMain.on(ipc_1.IPC_CHANNELS.APP_INFO, (event) => {
        const appInfo = {
            version: electron_1.app.getVersion(),
            name: electron_1.app.getName(),
            platform: process.platform,
        };
        event.reply(ipc_1.IPC_CHANNELS.APP_INFO_REPLY, appInfo);
    });
    // 파일 선택 다이얼로그
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.OPEN_FILE_DIALOG, async () => {
        if (!mainWindow) {
            return { success: false, error: '윈도우가 초기화되지 않았습니다' };
        }
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
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
    });
    // 폴더 선택 다이얼로그
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.OPEN_FOLDER_DIALOG, async () => {
        if (!mainWindow) {
            return { success: false, error: '윈도우가 초기화되지 않았습니다' };
        }
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: '폴더 선택이 취소되었습니다' };
        }
        return { success: true, data: result.filePaths[0] };
    });
    // 배치 이미지 처리 시작 (백업 + 변환 + 로그 통합)
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.START_BATCH_PROCESS, async (event, files, options) => {
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
            const backupManager = new backup_manager_1.BackupManager();
            const backupResult = await backupManager.backupBatch(files, (progress) => {
                // 백업 진행 상태를 Renderer로 전송 (선택적)
                console.log(`백업 진행: ${progress.completed}/${progress.total}`);
            });
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
            const onProgress = (progress) => {
                event.sender.send(ipc_1.IPC_CHANNELS.BATCH_PROGRESS, progress);
            };
            const processResult = await image_processor_1.imageProcessor.processBatch(files, options.outputDir, options, onProgress);
            if (!processResult.success) {
                console.error('이미지 변환 실패:', processResult.error);
                event.sender.send(ipc_1.IPC_CHANNELS.PROCESSING_ERROR, processResult.error);
                return {
                    success: false,
                    message: processResult.error,
                };
            }
            const batchProgress = processResult.data;
            console.log(`변환 완료: ${batchProgress.completed} 성공, ${batchProgress.failed} 실패`);
            // 3단계: 작업 로그 기록 (LogManager)
            console.log('3단계: 작업 로그 기록 시작');
            const logManager = new log_manager_1.LogManager();
            const logResult = await logManager.appendBatchLog(batchProgress);
            if (!logResult.success) {
                console.warn('로그 기록 실패 (처리는 성공):', logResult.error);
                // 로그 실패는 경고만 표시하고 계속 진행
            }
            else {
                console.log('로그 기록 완료');
            }
            // 처리 완료 이벤트 전송
            event.sender.send(ipc_1.IPC_CHANNELS.PROCESSING_COMPLETE, batchProgress);
            return {
                success: true,
                message: `처리 완료: ${batchProgress.completed}개 성공, ${batchProgress.failed}개 실패`,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            console.error('배치 처리 실패:', errorMessage);
            // 에러 이벤트 전송
            event.sender.send(ipc_1.IPC_CHANNELS.PROCESSING_ERROR, errorMessage);
            return {
                success: false,
                message: `배치 처리 실패: ${errorMessage}`,
            };
        }
    });
    // 배치 처리 취소
    electron_1.ipcMain.on(ipc_1.IPC_CHANNELS.CANCEL_BATCH_PROCESS, () => {
        console.log('배치 처리 취소 요청');
        image_processor_1.imageProcessor.cancelBatch();
    });
    // 파일 정보 가져오기
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.GET_FILE_INFO, async (_event, filePath) => {
        try {
            const stats = await fs.stat(filePath);
            const parsedPath = path.parse(filePath);
            const fileInfo = {
                path: filePath,
                name: parsedPath.base,
                extension: parsedPath.ext.slice(1),
                size: stats.size,
            };
            return {
                success: true,
                data: fileInfo,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return {
                success: false,
                error: `파일 정보를 가져올 수 없습니다: ${errorMessage}`,
            };
        }
    });
    // ===== 인증 관련 IPC 핸들러 =====
    // 로그인
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_SIGN_IN, async (_event, loginData) => {
        try {
            const result = await auth_manager_1.authManager.signIn({ email: loginData.email, password: loginData.password });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그인 실패: ${errorMessage}` };
        }
    });
    // 회원가입
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_SIGN_UP, async (_event, signUpData) => {
        try {
            const result = await auth_manager_1.authManager.signUp({
                email: signUpData.email,
                password: signUpData.password,
                metadata: signUpData.fullName ? { fullName: signUpData.fullName } : undefined,
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `회원가입 실패: ${errorMessage}` };
        }
    });
    // 로그아웃
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
        try {
            const result = await auth_manager_1.authManager.signOut();
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그아웃 실패: ${errorMessage}` };
        }
    });
    // 비밀번호 재설정
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_RESET_PASSWORD, async (_event, email) => {
        try {
            const result = await auth_manager_1.authManager.resetPassword(email);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `비밀번호 재설정 실패: ${errorMessage}` };
        }
    });
    // 인증 상태 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_GET_STATE, () => {
        try {
            const state = auth_manager_1.authManager.getAuthState();
            return { success: true, data: state };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `인증 상태 조회 실패: ${errorMessage}` };
        }
    });
    // 인증 상태 변경 리스너 등록
    auth_manager_1.authManager.onAuthStateChange((state) => {
        // 모든 윈도우에 인증 상태 변경 알림
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(ipc_1.IPC_CHANNELS.AUTH_STATE_CHANGED, {
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
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.SUBSCRIPTION_GET, async (_event, userId) => {
        try {
            const result = await subscription_manager_1.subscriptionManager.getSubscription(userId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `구독 조회 실패: ${errorMessage}` };
        }
    });
    // 구독 정보 강제 갱신
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.SUBSCRIPTION_REFRESH, async (_event, userId) => {
        try {
            const result = await subscription_manager_1.subscriptionManager.getSubscription(userId, true);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `구독 갱신 실패: ${errorMessage}` };
        }
    });
    // 포맷 지원 여부 확인
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.SUBSCRIPTION_CHECK_FORMAT, async (_event, format, userId) => {
        try {
            const result = await subscription_manager_1.subscriptionManager.isFormatSupported(format, userId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `포맷 확인 실패: ${errorMessage}` };
        }
    });
    // 배치 크기 검증
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.SUBSCRIPTION_VALIDATE_BATCH, async (_event, batchSize, userId) => {
        try {
            const result = await subscription_manager_1.subscriptionManager.validateBatchSize(batchSize, userId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `배치 크기 검증 실패: ${errorMessage}` };
        }
    });
    // ===== 로그 관리 IPC 핸들러 =====
    // LogManager 인스턴스 생성
    const logManager = new log_manager_1.LogManager();
    // 로그 파일 생성
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.LOG_CREATE_FILE, async (_event, date) => {
        try {
            const dateObj = date ? new Date(date) : undefined;
            const result = await logManager.createLogFile(dateObj);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그 파일 생성 실패: ${errorMessage}` };
        }
    });
    // 배치 로그 추가
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.LOG_APPEND_BATCH, async (_event, batchProgress, logFilePath) => {
        try {
            const result = await logManager.appendBatchLog(batchProgress, logFilePath);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그 추가 실패: ${errorMessage}` };
        }
    });
    // 로그 이력 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.LOG_GET_HISTORY, async (_event, startDate, endDate) => {
        try {
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;
            const result = await logManager.getLogHistory(start, end);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그 조회 실패: ${errorMessage}` };
        }
    });
    // Excel 파일 내보내기
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.LOG_EXPORT_EXCEL, async (_event, startDate, endDate, outputPath) => {
        try {
            const result = await logManager.exportToExcel(new Date(startDate), new Date(endDate), outputPath);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `Excel 내보내기 실패: ${errorMessage}` };
        }
    });
    // ===== 백업 관리 IPC 핸들러 =====
    // BackupManager 인스턴스 생성
    const backupManager = new backup_manager_1.BackupManager();
    // 단일 파일 백업
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_FILE, async (_event, filePath) => {
        try {
            const result = await backupManager.backupFile(filePath);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `파일 백업 실패: ${errorMessage}` };
        }
    });
    // 배치 파일 백업
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_BATCH, async (_event, files) => {
        try {
            const result = await backupManager.backupBatch(files, (progress) => {
                // 진행 상태를 Renderer로 전송
                _event.sender.send('backup-progress', progress);
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `배치 백업 실패: ${errorMessage}` };
        }
    });
    // 파일 복원
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_RESTORE, async (_event, backupId, targetPath) => {
        try {
            const result = await backupManager.restoreFile(backupId, targetPath);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `파일 복원 실패: ${errorMessage}` };
        }
    });
    // 배치 파일 복원
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_RESTORE_BATCH, async (_event, backupIds) => {
        try {
            const result = await backupManager.restoreBatch(backupIds, (progress) => {
                // 진행 상태를 Renderer로 전송
                _event.sender.send('backup-restore-progress', progress);
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `배치 복원 실패: ${errorMessage}` };
        }
    });
    // 백업 목록 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_LIST, async (_event, filters) => {
        try {
            const result = await backupManager.listBackups(filters);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `백업 목록 조회 실패: ${errorMessage}` };
        }
    });
    // 백업 삭제
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.BACKUP_DELETE, async (_event, backupId) => {
        try {
            const result = await backupManager.deleteBackup(backupId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `백업 삭제 실패: ${errorMessage}` };
        }
    });
    // ============================
    // 어필리에이트 관리 IPC 핸들러
    // ============================
    const affiliateManager = new affiliate_manager_1.AffiliateManager();
    // 추적 링크 생성 (또는 조회)
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AFFILIATE_CREATE_LINK, async (_event) => {
        try {
            // 현재 로그인한 사용자 ID 조회
            const authResult = await auth_manager_1.authManager.getAuthState();
            if (!authResult.isAuthenticated || !authResult.user) {
                return { success: false, error: '로그인이 필요합니다.' };
            }
            const userId = authResult.user.id;
            const result = await affiliateManager.createTrackingLink(userId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `추적 링크 생성 실패: ${errorMessage}` };
        }
    });
    // 추적 링크 클릭 추적 (쿠키 저장)
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AFFILIATE_TRACK_REFERRAL, async (_event, trackingCode) => {
        try {
            await affiliateManager.trackReferral(trackingCode);
            return { success: true, message: '추천 코드가 저장되었습니다.' };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `추천 추적 실패: ${errorMessage}` };
        }
    });
    // 회원가입 시 추천 연결
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AFFILIATE_LINK_TO_USER, async (_event, userId, subscriptionId) => {
        try {
            await affiliateManager.linkReferralToUser(userId, subscriptionId);
            return { success: true, message: '추천이 연결되었습니다.' };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            console.error('[Main] 추천 연결 실패:', errorMessage);
            // 추천 연결 실패는 치명적이지 않으므로 경고만 표시
            return { success: true, message: '추천 연결 선택적 실패 (계속 진행)' };
        }
    });
    // 어필리에이트 통계 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AFFILIATE_GET_STATS, async (_event) => {
        try {
            // 현재 로그인한 사용자 ID 조회
            const authResult = await auth_manager_1.authManager.getAuthState();
            if (!authResult.isAuthenticated || !authResult.user) {
                return { success: false, error: '로그인이 필요합니다.' };
            }
            const userId = authResult.user.id;
            const result = await affiliateManager.getReferralStats(userId);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `통계 조회 실패: ${errorMessage}` };
        }
    });
    // 추천 내역 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AFFILIATE_GET_REFERRALS, async (_event) => {
        try {
            // 현재 로그인한 사용자 ID 조회
            const authResult = await auth_manager_1.authManager.getAuthState();
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
            if (error)
                throw error;
            // 데이터 포맷 변환 (MVP: 실제 수익 계산은 추후 구현)
            const referrals = (data || []).map((ref) => ({
                created_at: ref.created_at,
                user_email: ref.referred_user?.email || '알 수 없음',
                subscription_status: ref.subscription?.status || 'unknown',
                subscription_tier: ref.subscription?.tier || 'free',
                this_month_revenue: 0, // MVP: 추후 revenue_logs 테이블에서 계산
                total_revenue: 0, // MVP: 추후 revenue_logs 테이블에서 계산
            }));
            return { success: true, data: referrals };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `추천 내역 조회 실패: ${errorMessage}` };
        }
    });
    // ============================
    // 자동 업데이트 관리 IPC 핸들러
    // ============================
    // 업데이트 확인
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.UPDATE_CHECK, async () => {
        if (isDevelopment) {
            return { success: false, message: '개발 환경에서는 업데이트를 확인할 수 없습니다.' };
        }
        try {
            const result = await electron_updater_1.autoUpdater.checkForUpdates();
            return {
                success: true,
                available: result !== null,
                updateInfo: result?.updateInfo
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `업데이트 확인 실패: ${errorMessage}` };
        }
    });
    // 업데이트 다운로드
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
            return { success: true, message: '업데이트 다운로드 시작' };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `업데이트 다운로드 실패: ${errorMessage}` };
        }
    });
    // 업데이트 설치 및 재시작
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.UPDATE_INSTALL, () => {
        // 앱 종료 후 업데이트 설치
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
        return { success: true, message: '앱을 재시작하여 업데이트를 설치합니다.' };
    });
    // 현재 버전 조회
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.UPDATE_GET_VERSION, () => {
        return { success: true, version: electron_1.app.getVersion() };
    });
}
/**
 * 자동 업데이트 시스템 설정
 */
function setupAutoUpdater() {
    // 개발 환경에서는 자동 업데이트 비활성화
    if (isDevelopment) {
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
        console.log('[AutoUpdater] 개발 환경: 자동 업데이트 비활성화');
        return;
    }
    // 자동 다운로드 활성화
    electron_updater_1.autoUpdater.autoDownload = false; // 사용자 확인 후 다운로드
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true; // 앱 종료 시 자동 설치
    // 업데이트 확인 시작
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] 업데이트 확인 중...');
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_CHECKING);
    });
    // 업데이트 발견
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] 업데이트 발견:', info.version);
        const updateInfo = {
            version: info.version,
            releaseNotes: typeof info.releaseNotes === 'string'
                ? info.releaseNotes
                : Array.isArray(info.releaseNotes)
                    ? info.releaseNotes.map(note => typeof note === 'string' ? note : note.note).join('\n')
                    : undefined,
            releaseDate: info.releaseDate,
        };
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_AVAILABLE, updateInfo);
    });
    // 업데이트 없음
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        console.log('[AutoUpdater] 최신 버전 사용 중:', info.version);
        const updateInfo = {
            version: info.version,
        };
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_NOT_AVAILABLE, updateInfo);
    });
    // 업데이트 오류
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] 업데이트 오류:', err);
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_ERROR, {
            message: err.message,
        });
    });
    // 다운로드 진행률
    electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
        console.log(`[AutoUpdater] 다운로드 진행: ${progressObj.percent.toFixed(2)}% (${progressObj.bytesPerSecond} bytes/s)`);
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, {
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total,
            bytesPerSecond: progressObj.bytesPerSecond,
        });
    });
    // 다운로드 완료
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] 업데이트 다운로드 완료:', info.version);
        const updateInfo = {
            version: info.version,
            releaseNotes: typeof info.releaseNotes === 'string'
                ? info.releaseNotes
                : Array.isArray(info.releaseNotes)
                    ? info.releaseNotes.map(note => typeof note === 'string' ? note : note.note).join('\n')
                    : undefined,
            releaseDate: info.releaseDate,
        };
        mainWindow?.webContents.send(ipc_1.IPC_CHANNELS.UPDATE_DOWNLOADED, updateInfo);
    });
    console.log('[AutoUpdater] 자동 업데이트 시스템 초기화 완료');
}
//# sourceMappingURL=main.js.map