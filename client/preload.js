// Preload Script
// Renderer Process가 로드되기 전에 실행되는 스크립트
// contextBridge를 통해 안전하게 Node.js API를 Renderer에 노출 (향후 보안 강화 시 사용)

const { contextBridge, ipcRenderer } = require('electron');

// 향후 contextIsolation: true로 전환 시 사용
// contextBridge.exposeInMainWorld('electronAPI', {
//   // 앱 정보 가져오기
//   getAppInfo: () => ipcRenderer.invoke('get-app-info'),
//
//   // 이미지 처리 요청
//   processImages: (files, options) => ipcRenderer.invoke('process-images', files, options),
//
//   // 구독 등급 확인
//   checkSubscription: () => ipcRenderer.invoke('check-subscription'),
// });

console.log('Preload script loaded');
