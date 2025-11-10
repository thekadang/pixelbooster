// types/index.ts - 전체 타입 정의

/**
 * 지원하는 이미지 포맷 타입
 */
export type ImageFormat = 'webp' | 'avif' | 'jpg' | 'png' | 'gif' | 'bmp' | 'tiff';

/**
 * 입력 가능한 이미지 포맷 (더 많은 포맷 지원)
 */
export type InputImageFormat = ImageFormat | 'svg' | 'heif' | 'heic';

/**
 * 구독 등급
 */
export type SubscriptionTier = 'free' | 'basic' | 'pro';

/**
 * 이미지 처리 결과 타입
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 이미지 처리 옵션
 */
export interface ImageProcessOptions {
  /** 출력 포맷 */
  format: ImageFormat;
  /** 품질 (0-100) */
  quality: number;
  /** 출력 디렉토리 (배치 처리 시 필요) */
  outputDir?: string;
  /** 리사이즈 너비 (선택사항) */
  width?: number;
  /** 리사이즈 높이 (선택사항) */
  height?: number;
  /** 종횡비 유지 여부 */
  maintainAspectRatio?: boolean;
  /** 압축 레벨 (0-9, 높을수록 느리지만 작은 파일) */
  compressionLevel?: number;
}

/**
 * 배치 처리 작업 항목
 */
export interface BatchProcessItem {
  /** 고유 ID */
  id: string;
  /** 입력 파일 경로 */
  inputPath: string;
  /** 출력 파일 경로 */
  outputPath: string;
  /** 처리 상태 */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** 진행률 (0-100) */
  progress: number;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 원본 파일 크기 (bytes) */
  originalSize?: number;
  /** 변환된 파일 크기 (bytes) */
  convertedSize?: number;
  /** 압축률 (0-100%) */
  compressionRatio?: number;
  /** 처리 시작 시간 */
  startTime?: number;
  /** 처리 완료 시간 */
  endTime?: number;
  /** 처리 시간 (밀리초) */
  processingTime?: number;
}

/**
 * 배치 처리 진행 상태
 */
export interface BatchProcessProgress {
  /** 전체 작업 수 */
  total: number;
  /** 완료된 작업 수 */
  completed: number;
  /** 실패한 작업 수 */
  failed: number;
  /** 처리 중인 작업 수 */
  processing: number;
  /** 전체 진행률 (0-100) */
  overallProgress: number;
  /** 작업 항목 목록 */
  items: BatchProcessItem[];
}

/**
 * 파일 정보
 */
export interface FileInfo {
  /** 파일 경로 */
  path: string;
  /** 파일명 */
  name: string;
  /** 파일 확장자 */
  extension: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** 이미지 너비 */
  width?: number;
  /** 이미지 높이 */
  height?: number;
}

/**
 * IPC 이벤트 타입
 */
export interface IPCEvents {
  // Main → Renderer
  'batch-progress': (progress: BatchProcessProgress) => void;
  'item-progress': (item: BatchProcessItem) => void;
  'processing-complete': (progress: BatchProcessProgress) => void;
  'processing-error': (error: string) => void;

  // Renderer → Main
  'start-batch-process': (files: string[], options: ImageProcessOptions) => void;
  'cancel-batch-process': () => void;
  'open-file-dialog': () => void;
  'get-file-info': (path: string) => void;
}

// ============================================================
// 로그 시스템 타입 정의 (LogManager)
// ============================================================

/**
 * 백업 상태
 */
export type BackupStatus = 'active' | 'restored' | 'deleted';

/**
 * 로그 엔트리 (작업 기록 하나)
 */
export interface LogEntry {
  /** 순번 */
  id: number;
  /** 작업 일시 */
  timestamp: Date;
  /** 파일명 */
  filename: string;
  /** 원본 경로 */
  inputPath: string;
  /** 출력 경로 */
  outputPath: string;
  /** 원본 크기 (bytes) */
  inputSize: number;
  /** 출력 크기 (bytes) */
  outputSize: number;
  /** 압축률 (0-100%) */
  compressionRatio: number;
  /** 출력 포맷 */
  format: ImageFormat;
  /** 압축 품질 */
  quality: number;
  /** 처리 상태 */
  status: 'success' | 'failed';
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 처리 시간 (밀리초) */
  processingTime: number;
}

/**
 * 로그 통계
 */
export interface LogStatistics {
  /** 총 파일 수 */
  totalFiles: number;
  /** 성공 수 */
  successCount: number;
  /** 실패 수 */
  failedCount: number;
  /** 성공률 (%) */
  successRate: number;
  /** 평균 압축률 (%) */
  averageCompressionRatio: number;
  /** 절약 용량 (bytes) */
  totalSavedSize: number;
  /** 총 처리 시간 (밀리초) */
  totalProcessingTime: number;
  /** 포맷별 통계 */
  formatStats: {
    [format: string]: {
      count: number;
      averageCompressionRatio: number;
    };
  };
  /** 일자별 통계 */
  dateStats: {
    [date: string]: {
      count: number;
      averageCompressionRatio: number;
    };
  };
}

/**
 * 로그 인덱스 (전체 로그 파일 목록)
 */
export interface LogIndex {
  /** 버전 */
  version: string;
  /** 마지막 업데이트 일시 */
  lastUpdated: Date;
  /** 총 로그 수 */
  totalLogs: number;
  /** 로그 엔트리 목록 */
  logs: LogEntry[];
}

// ============================================================
// 백업 시스템 타입 정의 (BackupManager)
// ============================================================

/**
 * 백업 정보
 */
export interface BackupInfo {
  /** 백업 고유 ID */
  backupId: string;
  /** 원본 파일 경로 */
  originalPath: string;
  /** 백업 파일 경로 */
  backupPath: string;
  /** 파일명 */
  filename: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** 읽기 쉬운 파일 크기 (예: "5.00 MB") */
  fileSizeReadable: string;
  /** 백업 일시 */
  backupDate: Date;
  /** SHA-256 해시 */
  hash: string;
  /** 백업 상태 */
  status: BackupStatus;
  /** 복원 일시 (옵션) */
  restoredAt?: Date;
}

/**
 * 백업 필터 옵션
 */
export interface BackupFilters {
  /** 시작 일자 (옵션) */
  startDate?: Date;
  /** 종료 일자 (옵션) */
  endDate?: Date;
  /** 파일명 (부분 일치) (옵션) */
  filename?: string;
  /** 백업 상태 (옵션) */
  status?: BackupStatus;
  /** 정렬 기준 (옵션) */
  sortBy?: 'date' | 'size' | 'filename';
  /** 정렬 순서 (옵션) */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 백업 진행 상태
 */
export interface BackupProgress {
  /** 전체 파일 수 */
  total: number;
  /** 완료된 파일 수 */
  completed: number;
  /** 실패한 파일 수 */
  failed: number;
  /** 처리 중인 파일 수 */
  processing: number;
  /** 전체 진행률 (0-100%) */
  overallProgress: number;
  /** 현재 처리 중인 파일명 (옵션) */
  currentFile?: string;
}

/**
 * 백업 배치 결과
 */
export interface BackupBatchResult {
  /** 성공한 파일 수 */
  successCount: number;
  /** 실패한 파일 수 */
  failedCount: number;
  /** 성공한 백업 목록 */
  successBackups: BackupInfo[];
  /** 실패한 파일 목록 */
  failedFiles: {
    filePath: string;
    error: string;
  }[];
}

/**
 * 백업 인덱스 (전체 백업 파일 목록)
 */
export interface BackupIndex {
  /** 버전 */
  version: string;
  /** 마지막 업데이트 일시 */
  lastUpdated: Date;
  /** 총 백업 수 */
  totalBackups: number;
  /** 총 백업 크기 (bytes) */
  totalSize: number;
  /** 백업 목록 */
  backups: BackupInfo[];
}
