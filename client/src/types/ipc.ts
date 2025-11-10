/**
 * IPC 통신 타입 정의
 * Main Process와 Renderer Process 간 통신에 사용되는 타입
 */

import { ImageProcessOptions, BatchProcessProgress, Result } from './index';

// Re-export for convenience
export type { ImageProcessOptions, BatchProcessProgress, Result } from './index';

/**
 * IPC 채널 이름 정의
 */
export const IPC_CHANNELS = {
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
} as const;

/**
 * 앱 정보 응답 타입
 */
export interface AppInfo {
  version: string;
  name: string;
  platform: NodeJS.Platform;
}

/**
 * 파일 선택 다이얼로그 결과
 */
export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * 폴더 선택 다이얼로그 결과
 */
export interface FolderDialogResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * 파일 정보
 */
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
}

/**
 * 배치 처리 요청 파라미터
 */
export interface BatchProcessRequest {
  files: string[];
  options: ImageProcessOptions;
}

/**
 * 배치 처리 응답
 */
export interface BatchProcessResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * IPC 핸들러 타입 정의
 */
export interface IpcHandlers {
  [IPC_CHANNELS.OPEN_FILE_DIALOG]: () => Promise<Result<string[]>>;
  [IPC_CHANNELS.OPEN_FOLDER_DIALOG]: () => Promise<Result<string>>;
  [IPC_CHANNELS.START_BATCH_PROCESS]: (
    files: string[],
    options: ImageProcessOptions
  ) => Promise<BatchProcessResponse>;
  [IPC_CHANNELS.GET_FILE_INFO]: (filePath: string) => Promise<Result<FileInfo>>;
}

/**
 * IPC 이벤트 타입 정의
 */
export interface IpcEvents {
  [IPC_CHANNELS.APP_INFO]: void;
  [IPC_CHANNELS.CANCEL_BATCH_PROCESS]: void;
}

/**
 * 인증 요청 타입
 */
export interface AuthSignInRequest {
  email: string;
  password: string;
}

export interface AuthSignUpRequest {
  email: string;
  password: string;
  fullName?: string;
}

/**
 * 인증 상태 타입
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    emailConfirmedAt: string | null;
  } | null;
}

/**
 * 구독 정보 타입
 */
export interface SubscriptionInfo {
  tier: 'free' | 'basic' | 'pro';
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  expiresAt: string | null;
  features: {
    formats: string[];
    maxBatchSize: number;
    maxDevices: number;
    backupEnabled: boolean;
    logEnabled: boolean;
  };
}

/**
 * IPC 리스너 타입 정의
 */
export interface IpcListeners {
  [IPC_CHANNELS.APP_INFO_REPLY]: (info: AppInfo) => void;
  [IPC_CHANNELS.BATCH_PROGRESS]: (progress: BatchProcessProgress) => void;
  [IPC_CHANNELS.PROCESSING_COMPLETE]: (finalProgress: BatchProcessProgress) => void;
  [IPC_CHANNELS.PROCESSING_ERROR]: (error: string) => void;
  [IPC_CHANNELS.AUTH_STATE_CHANGED]: (state: AuthState) => void;
}
