// App.jsx - 메인 React 컴포넌트
import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    // Electron IPC를 통해 앱 정보 가져오기
    if (window.require) {
      const { ipcRenderer } = window.require('electron');

      ipcRenderer.send('app-info');
      ipcRenderer.on('app-info-reply', (event, info) => {
        setAppInfo(info);
      });

      return () => {
        ipcRenderer.removeAllListeners('app-info-reply');
      };
    }
  }, []);

  return (
    <div className="app-container">
      <div className="hero-section">
        <h1 className="title">
          <span className="emoji">🚀</span>
          픽셀부스터
        </h1>
        <p className="subtitle">이미지 최적화 데스크톱 애플리케이션</p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🖼️</div>
            <h3>이미지 변환</h3>
            <p>WebP, AVIF 포맷으로 빠르게 변환</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>배치 처리</h3>
            <p>대량의 이미지를 한 번에 처리</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>품질 최적화</h3>
            <p>파일 크기와 품질의 완벽한 균형</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💾</div>
            <h3>백업 시스템</h3>
            <p>원본 파일 자동 백업 및 복원</p>
          </div>
        </div>

        {appInfo && (
          <div className="app-info">
            <p><strong>앱 이름:</strong> {appInfo.name}</p>
            <p><strong>버전:</strong> {appInfo.version}</p>
            <p><strong>플랫폼:</strong> {appInfo.platform}</p>
          </div>
        )}

        <div className="status-badge">
          <span className="status-dot"></span>
          개발 중 - Phase 1 완료
        </div>
      </div>
    </div>
  );
};

export default App;
