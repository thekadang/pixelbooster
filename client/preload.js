"use strict";
/**
 * Preload Script (TypeScript)
 * Renderer Process가 로드되기 전에 실행되는 스크립트
 * contextBridge를 통해 안전하게 Node.js API를 Renderer에 노출
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
// contextIsolation: false이므로 window 객체에 직접 autoUpdate API 노출
const { ipcRenderer } = require('electron');
// window 객체에 직접 autoUpdate API 추가
window.autoUpdate = {
    // 업데이트 확인
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    // 업데이트 다운로드
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    // 업데이트 설치
    installUpdate: () => ipcRenderer.invoke('update:install'),
    // 현재 버전 조회
    getCurrentVersion: () => ipcRenderer.invoke('update:get-version'),
    // 이벤트 리스너
    onUpdateChecking: (callback) => {
        ipcRenderer.on('update:checking', callback);
    },
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update:available', (_event, info) => callback(info));
    },
    onUpdateNotAvailable: (callback) => {
        ipcRenderer.on('update:not-available', (_event, info) => callback(info));
    },
    onDownloadProgress: (callback) => {
        ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update:downloaded', (_event, info) => callback(info));
    },
    onUpdateError: (callback) => {
        ipcRenderer.on('update:error', (_event, error) => callback(error));
    }
};
console.log('[Preload] autoUpdate API 노출 완료');
//# sourceMappingURL=preload.js.map