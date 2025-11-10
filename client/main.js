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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const url = __importStar(require("url"));
const fs = __importStar(require("fs/promises"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
// 타입 임포트
const ipc_1 = require("./src/types/ipc");
// 서비스 임포트
const image_processor_1 = require("./src/services/image-processor");
const auth_manager_1 = require("./src/services/auth-manager");
const subscription_manager_1 = require("./src/services/subscription-manager");
const log_manager_1 = require("./src/services/log-manager");
const backup_manager_1 = require("./src/services/backup-manager");
// 개발 환경 판단
const isDevelopment = electron_is_dev_1.default;
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
    }
    else {
        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'dist/index.html'),
            protocol: 'file:',
            slashes: true,
        }));
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
electron_1.app.whenReady().then(() => {
    createMainWindow();
    setupIpcHandlers();
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
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_SIGN_IN, async (_event, email, password) => {
        try {
            const result = await auth_manager_1.authManager.signIn({ email, password });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            return { success: false, error: `로그인 실패: ${errorMessage}` };
        }
    });
    // 회원가입
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.AUTH_SIGN_UP, async (_event, email, password, fullName) => {
        try {
            const result = await auth_manager_1.authManager.signUp({
                email,
                password,
                metadata: { fullName },
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
}
//# sourceMappingURL=main.js.map