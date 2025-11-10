/**
 * Preload Script (TypeScript)
 * Renderer Process가 로드되기 전에 실행되는 스크립트
 * contextBridge를 통해 안전하게 Node.js API를 Renderer에 노출
 */

// import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AppInfo,
  FileInfo,
  BatchProcessProgress,
  Result,
  ImageProcessOptions,
} from './src/types/ipc';

/**
 * Electron API를 Renderer Process에 안전하게 노출
 * 향후 contextIsolation: true로 전환 시 사용
 */

// 현재는 contextIsolation: false이므로 직접 노출은 불필요
// 하지만 향후 보안 강화를 위해 contextBridge 패턴을 준비

interface ElectronAPI {
  // 앱 정보
  getAppInfo: () => void;
  onAppInfo: (callback: (info: AppInfo) => void) => () => void;

  // 파일/폴더 선택
  openFileDialog: () => Promise<Result<string[]>>;
  openFolderDialog: () => Promise<Result<string>>;

  // 배치 처리
  startBatchProcess: (
    files: string[],
    options: ImageProcessOptions
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  cancelBatchProcess: () => void;
  onBatchProgress: (callback: (progress: BatchProcessProgress) => void) => () => void;

  // 파일 정보
  getFileInfo: (filePath: string) => Promise<Result<FileInfo>>;
}

// contextBridge를 통해 안전하게 API 노출 (향후 contextIsolation: true 시 활성화)
/*
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보 가져오기
  getAppInfo: () => {
    ipcRenderer.send(IPC_CHANNELS.APP_INFO);
  },

  // 앱 정보 응답 리스너
  onAppInfo: (callback: (info: AppInfo) => void) => {
    const listener = (_event: IpcRendererEvent, info: AppInfo) => callback(info);
    ipcRenderer.on(IPC_CHANNELS.APP_INFO_REPLY, listener);

    // 리스너 제거 함수 반환
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.APP_INFO_REPLY, listener);
    };
  },

  // 파일 선택 다이얼로그
  openFileDialog: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_DIALOG);
  },

  // 폴더 선택 다이얼로그
  openFolderDialog: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER_DIALOG);
  },

  // 배치 처리 시작
  startBatchProcess: (files: string[], options: ImageProcessOptions) => {
    return ipcRenderer.invoke(IPC_CHANNELS.START_BATCH_PROCESS, files, options);
  },

  // 배치 처리 취소
  cancelBatchProcess: () => {
    ipcRenderer.send(IPC_CHANNELS.CANCEL_BATCH_PROCESS);
  },

  // 배치 진행 상태 리스너
  onBatchProgress: (callback: (progress: BatchProcessProgress) => void) => {
    const listener = (_event: IpcRendererEvent, progress: BatchProcessProgress) =>
      callback(progress);
    ipcRenderer.on(IPC_CHANNELS.BATCH_PROGRESS, listener);

    // 리스너 제거 함수 반환
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.BATCH_PROGRESS, listener);
    };
  },

  // 파일 정보 가져오기
  getFileInfo: (filePath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_INFO, filePath);
  },
} as ElectronAPI);
*/

console.log('Preload script loaded (TypeScript)');

// 타입 선언을 위한 글로벌 확장
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
