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
  /** 처리 시작 시간 */
  startTime?: number;
  /** 처리 완료 시간 */
  endTime?: number;
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
