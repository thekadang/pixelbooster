// App.jsx - 메인 React 컴포넌트
import React, { useState, useEffect } from 'react';
import DropZone from './components/DropZone';
import SettingsPanel from './components/SettingsPanel';
import ProgressTracker from './components/ProgressTracker';
import AuthModal from './components/AuthModal';
import LogViewer from './components/LogViewer';
import BackupViewer from './components/BackupViewer';
import './App.css';

const App = () => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState('converter');

  // 파일 및 처리 상태
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processOptions, setProcessOptions] = useState({
    format: 'webp',
    quality: 80,
    compressionLevel: 6,
    maintainAspectRatio: true,
  });
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 인증 상태
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
  });
  const [subscription, setSubscription] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  /**
   * 인증 상태 초기화 및 리스너 등록
   */
  useEffect(() => {
    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');

    // 초기 인증 상태 조회
    const loadAuthState = async () => {
      try {
        const result = await ipcRenderer.invoke('auth-get-state');
        if (result.success && result.data) {
          setAuthState({
            isAuthenticated: result.data.isAuthenticated,
            user: result.data.user,
          });

          // 구독 정보 조회
          if (result.data.isAuthenticated) {
            loadSubscription();
          }
        }
      } catch (error) {
        console.error('인증 상태 조회 실패:', error);
      }
    };

    loadAuthState();

    // 인증 상태 변경 리스너
    const handleAuthStateChanged = (event, newAuthState) => {
      setAuthState({
        isAuthenticated: newAuthState.isAuthenticated,
        user: newAuthState.user,
      });

      if (newAuthState.isAuthenticated) {
        loadSubscription();
      } else {
        setSubscription(null);
      }
    };

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

    ipcRenderer.on('auth-state-changed', handleAuthStateChanged);
    ipcRenderer.on('batch-progress', handleBatchProgress);
    ipcRenderer.on('processing-complete', handleProcessingComplete);
    ipcRenderer.on('processing-error', handleProcessingError);

    return () => {
      ipcRenderer.removeAllListeners('auth-state-changed');
      ipcRenderer.removeAllListeners('batch-progress');
      ipcRenderer.removeAllListeners('processing-complete');
      ipcRenderer.removeAllListeners('processing-error');
    };
  }, []);

  /**
   * 구독 정보 조회
   */
  const loadSubscription = async () => {
    if (!window.require) return;

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('subscription-get');
      if (result.success) {
        setSubscription(result.data);
      }
    } catch (error) {
      console.error('구독 정보 조회 실패:', error);
    }
  };

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
   * 로그인 모달 열기
   */
  const handleOpenAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  /**
   * 로그인 모달 닫기
   */
  const handleCloseAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  /**
   * 로그인 성공 핸들러
   */
  const handleAuthSuccess = (authData) => {
    setAuthState({
      isAuthenticated: true,
      user: authData.user,
    });
    loadSubscription();
  };

  /**
   * 로그아웃 핸들러
   */
  const handleLogout = async () => {
    if (!window.require) return;

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth-sign-out');
      if (result.success) {
        setAuthState({
          isAuthenticated: false,
          user: null,
        });
        setSubscription(null);
        alert('로그아웃되었습니다.');
      }
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  /**
   * 변환 시작 핸들러
   */
  const handleStartConversion = async () => {
    // 인증 확인
    if (!authState.isAuthenticated) {
      alert('로그인이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }

    if (selectedFiles.length === 0) {
      alert('변환할 파일을 선택하세요.');
      return;
    }

    if (!window.require) {
      alert('Electron 환경에서만 변환이 가능합니다.');
      return;
    }

    // 구독 등급별 배치 크기 제한 확인
    if (subscription) {
      const maxBatchSize = subscription.limits.maxBatchSize;
      if (maxBatchSize > 0 && selectedFiles.length > maxBatchSize) {
        alert(
          `${subscription.tier.toUpperCase()} 등급은 최대 ${maxBatchSize}개까지 변환 가능합니다.\n` +
          `업그레이드 하면 보다 많은 동시 변환이 가능합니다.`
        );
        return;
      }
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
        <div className="header-left">
          <h1 className="app-title">
            <span className="emoji">🚀</span>
            픽셀부스터
          </h1>
          <p className="app-subtitle">이미지 최적화 데스크톱 애플리케이션</p>
        </div>
        <div className="header-right">
          {authState.isAuthenticated ? (
            <div className="user-info">
              <span className="user-email">{authState.user?.email}</span>
              {subscription && (
                <span className="subscription-badge">
                  {subscription.tier.toUpperCase()}
                </span>
              )}
              <button className="logout-button" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          ) : (
            <button className="login-button" onClick={handleOpenAuthModal}>
              로그인
            </button>
          )}
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'converter' ? 'active' : ''}`}
          onClick={() => setActiveTab('converter')}
        >
          <span className="tab-icon">🚀</span>
          변환
        </button>
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <span className="tab-icon">📊</span>
          로그
        </button>
        <button
          className={`tab-button ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          <span className="tab-icon">💾</span>
          백업
        </button>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="app-main">
        {/* 변환 탭 */}
        {activeTab === 'converter' && (
          <>
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
                  subscription={subscription}
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
          </>
        )}

        {/* 로그 탭 */}
        {activeTab === 'logs' && (
          <section className="section">
            <LogViewer />
          </section>
        )}

        {/* 백업 탭 */}
        {activeTab === 'backups' && (
          <section className="section">
            <BackupViewer />
          </section>
        )}
      </main>

      {/* 푸터 */}
      <footer className="app-footer">
        <div className="status-badge">
          <span className="status-dot"></span>
          Phase 3-2 개발 중 - 인증 시스템 UI 구현 완료
        </div>
      </footer>

      {/* 인증 모달 */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default App;
