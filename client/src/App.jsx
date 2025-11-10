// App.jsx - 메인 React 컴포넌트
import React, { useState, useEffect } from 'react';
import DropZone from './components/DropZone';
import SettingsPanel from './components/SettingsPanel';
import ProgressTracker from './components/ProgressTracker';
import './App.css';

const App = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processOptions, setProcessOptions] = useState({
    format: 'webp',
    quality: 80,
    compressionLevel: 6,
    maintainAspectRatio: true,
  });
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');

    // 배치 진행 상태 리스너
    const handleBatchProgress = (event, progressData) => {
      setProgress(progressData);
    };

    // 처리 완료 리스너
    const handleProcessingComplete = (event, finalProgress) => {
      setProgress(finalProgress);
      setIsProcessing(false);
      alert(`처리 완료!\n완료: ${finalProgress.completed}개\n실패: ${finalProgress.failed}개`);
    };

    // 에러 리스너
    const handleProcessingError = (event, error) => {
      alert(`처리 실패: ${error}`);
      setIsProcessing(false);
    };

    ipcRenderer.on('batch-progress', handleBatchProgress);
    ipcRenderer.on('processing-complete', handleProcessingComplete);
    ipcRenderer.on('processing-error', handleProcessingError);

    return () => {
      ipcRenderer.removeAllListeners('batch-progress');
      ipcRenderer.removeAllListeners('processing-complete');
      ipcRenderer.removeAllListeners('processing-error');
    };
  }, []);

  /**
   * 파일 선택 핸들러
   */
  const handleFilesSelected = (files) => {
    setSelectedFiles(files);
    setProgress(null); // 이전 진행 상태 초기화
  };

  /**
   * 설정 변경 핸들러
   */
  const handleOptionsChange = (newOptions) => {
    setProcessOptions(newOptions);
  };

  /**
   * 변환 시작 핸들러
   */
  const handleStartConversion = async () => {
    if (selectedFiles.length === 0) {
      alert('변환할 파일을 선택하세요.');
      return;
    }

    if (!window.require) {
      alert('Electron 환경에서만 변환이 가능합니다.');
      return;
    }

    const { ipcRenderer } = window.require('electron');

    // 출력 폴더 선택
    try {
      const folderResult = await ipcRenderer.invoke('open-folder-dialog');

      if (!folderResult.success) {
        return;
      }

      const outputDir = folderResult.data;

      // 배치 처리 시작
      setIsProcessing(true);
      setProgress({
        total: selectedFiles.length,
        completed: 0,
        failed: 0,
        processing: 0,
        overallProgress: 0,
        items: [],
      });

      await ipcRenderer.invoke('start-batch-process', selectedFiles, {
        ...processOptions,
        outputDir,
      });
    } catch (error) {
      console.error('변환 시작 실패:', error);
      alert('변환을 시작할 수 없습니다.');
      setIsProcessing(false);
    }
  };

  /**
   * 변환 취소 핸들러
   */
  const handleCancelConversion = () => {
    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('cancel-batch-process');
    setIsProcessing(false);
  };

  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className="app-header">
        <h1 className="app-title">
          <span className="emoji">🚀</span>
          픽셀부스터
        </h1>
        <p className="app-subtitle">이미지 최적화 데스크톱 애플리케이션</p>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="app-main">
        {/* 파일 선택 영역 */}
        <section className="section">
          <DropZone onFilesSelected={handleFilesSelected} />
        </section>

        {/* 설정 패널 */}
        {selectedFiles.length > 0 && (
          <section className="section">
            <SettingsPanel
              options={processOptions}
              onOptionsChange={handleOptionsChange}
            />

            <div className="action-buttons">
              <button
                className="start-button"
                onClick={handleStartConversion}
                disabled={isProcessing}
              >
                {isProcessing ? '🔄 변환 중...' : '🚀 변환 시작'}
              </button>
            </div>
          </section>
        )}

        {/* 진행 상태 추적 */}
        {progress && (
          <section className="section">
            <ProgressTracker
              progress={progress}
              onCancel={isProcessing ? handleCancelConversion : null}
            />
          </section>
        )}
      </main>

      {/* 푸터 */}
      <footer className="app-footer">
        <div className="status-badge">
          <span className="status-dot"></span>
          Phase 2 개발 중 - 이미지 처리 기능 구현 완료
        </div>
      </footer>
    </div>
  );
};

export default App;
