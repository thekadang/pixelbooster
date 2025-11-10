"use strict";
/**
 * IPC 통신 타입 정의
 * Main Process와 Renderer Process 간 통신에 사용되는 타입
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
/**
 * IPC 채널 이름 정의
 */
exports.IPC_CHANNELS = {
    // 앱 정보
    APP_INFO: 'app-info',
    APP_INFO_REPLY: 'app-info-reply',
    // 파일/폴더 선택
    OPEN_FILE_DIALOG: 'open-file-dialog',
    OPEN_FOLDER_DIALOG: 'open-folder-dialog',
    // 배치 처리
    START_BATCH_PROCESS: 'start-batch-process',
    CANCEL_BATCH_PROCESS: 'cancel-batch-process',
    BATCH_PROGRESS: 'batch-progress',
    PROCESSING_COMPLETE: 'processing-complete',
    PROCESSING_ERROR: 'processing-error',
    // 파일 정보
    GET_FILE_INFO: 'get-file-info',
};
//# sourceMappingURL=ipc.js.map