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
// ImageProcessor 임포트
const image_processor_1 = require("./src/services/image-processor");
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
    // 배치 이미지 처리 시작
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
            // 진행 상태 콜백: Renderer로 실시간 전송
            const onProgress = (progress) => {
                event.sender.send(ipc_1.IPC_CHANNELS.BATCH_PROGRESS, progress);
            };
            // ImageProcessor를 통한 배치 처리 시작
            const result = await image_processor_1.imageProcessor.processBatch(files, options.outputDir, options, onProgress);
            if (result.success) {
                // 처리 완료 이벤트 전송
                event.sender.send(ipc_1.IPC_CHANNELS.PROCESSING_COMPLETE, result.data);
                return {
                    success: true,
                    message: `처리 완료: ${result.data.completed}개 성공, ${result.data.failed}개 실패`,
                };
            }
            else {
                // 에러 이벤트 전송
                event.sender.send(ipc_1.IPC_CHANNELS.PROCESSING_ERROR, result.error);
                return {
                    success: false,
                    message: result.error,
                };
            }
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
}
//# sourceMappingURL=main.js.map