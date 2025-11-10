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
    // 인증 관련
    AUTH_SIGN_IN: 'auth-sign-in',
    AUTH_SIGN_UP: 'auth-sign-up',
    AUTH_SIGN_OUT: 'auth-sign-out',
    AUTH_RESET_PASSWORD: 'auth-reset-password',
    AUTH_GET_STATE: 'auth-get-state',
    AUTH_STATE_CHANGED: 'auth-state-changed',
    // 구독 관리
    SUBSCRIPTION_GET: 'subscription-get',
    SUBSCRIPTION_REFRESH: 'subscription-refresh',
    SUBSCRIPTION_CHECK_FORMAT: 'subscription-check-format',
    SUBSCRIPTION_VALIDATE_BATCH: 'subscription-validate-batch',
    // 로그 관리 (LogManager)
    LOG_CREATE_FILE: 'log:create-file',
    LOG_APPEND_BATCH: 'log:append-batch',
    LOG_GET_HISTORY: 'log:get-history',
    LOG_EXPORT_EXCEL: 'log:export-excel',
    // 백업 관리 (BackupManager)
    BACKUP_FILE: 'backup:file',
    BACKUP_BATCH: 'backup:batch',
    BACKUP_RESTORE: 'backup:restore',
    BACKUP_RESTORE_BATCH: 'backup:restore-batch',
    BACKUP_LIST: 'backup:list',
    BACKUP_DELETE: 'backup:delete',
    BACKUP_PROGRESS: 'backup-progress',
    // 어필리에이트 관리 (AffiliateManager)
    AFFILIATE_CREATE_LINK: 'affiliate:create-link',
    AFFILIATE_TRACK_REFERRAL: 'affiliate:track-referral',
    AFFILIATE_LINK_TO_USER: 'affiliate:link-to-user',
    AFFILIATE_GET_STATS: 'affiliate:get-stats',
    AFFILIATE_GET_REFERRALS: 'affiliate:get-referrals',
};
//# sourceMappingURL=ipc.js.map