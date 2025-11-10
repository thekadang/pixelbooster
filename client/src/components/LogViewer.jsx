// components/LogViewer.jsx - 로그 조회 컴포넌트

import React, { useState, useEffect } from 'react';
import './LogViewer.css';

/**
 * LogViewer 컴포넌트
 *
 * 작업 로그 조회 및 통계 표시
 *
 * @param {Object} props
 */
const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [filterFormat, setFilterFormat] = useState('all');

  /**
   * 로그 조회
   */
  const loadLogs = async () => {
    if (!window.require) {
      alert('Electron 환경에서만 로그를 조회할 수 있습니다.');
      return;
    }

    setIsLoading(true);
    const { ipcRenderer } = window.require('electron');

    try {
      // 날짜 범위 설정
      const startTimestamp = dateRange.startDate
        ? new Date(dateRange.startDate).getTime()
        : undefined;
      const endTimestamp = dateRange.endDate
        ? new Date(dateRange.endDate).getTime()
        : undefined;

      const result = await ipcRenderer.invoke('log:get-history', {
        startDate: startTimestamp,
        endDate: endTimestamp,
      });

      if (result.success) {
        let filteredLogs = result.data.logs || [];

        // 포맷 필터링
        if (filterFormat !== 'all') {
          filteredLogs = filteredLogs.filter((log) => log.format === filterFormat);
        }

        setLogs(filteredLogs);
        setStatistics(calculateStatistics(filteredLogs));
      } else {
        alert(`로그 조회 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('로그 조회 실패:', error);
      alert('로그를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 통계 계산
   */
  const calculateStatistics = (logList) => {
    if (logList.length === 0) {
      return {
        totalFiles: 0,
        successCount: 0,
        failureCount: 0,
        averageCompressionRatio: 0,
        spaceSaved: 0,
        totalProcessingTime: 0,
      };
    }

    const successLogs = logList.filter((log) => log.success);
    const totalInputSize = logList.reduce((sum, log) => sum + (log.inputSize || 0), 0);
    const totalOutputSize = successLogs.reduce((sum, log) => sum + (log.outputSize || 0), 0);
    const totalCompressionRatio = successLogs.reduce((sum, log) => sum + (log.compressionRatio || 0), 0);
    const totalProcessingTime = logList.reduce((sum, log) => sum + (log.processingTime || 0), 0);

    return {
      totalFiles: logList.length,
      successCount: successLogs.length,
      failureCount: logList.length - successLogs.length,
      averageCompressionRatio:
        successLogs.length > 0 ? totalCompressionRatio / successLogs.length : 0,
      spaceSaved: totalInputSize - totalOutputSize,
      totalProcessingTime,
    };
  };

  /**
   * 초기 로그 조회
   */
  useEffect(() => {
    loadLogs();
  }, []);

  /**
   * 날짜 범위 변경 핸들러
   */
  const handleDateChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * 필터 적용
   */
  const handleApplyFilter = () => {
    loadLogs();
  };

  /**
   * 필터 초기화
   */
  const handleResetFilter = () => {
    setDateRange({ startDate: '', endDate: '' });
    setFilterFormat('all');
    setTimeout(() => loadLogs(), 100);
  };

  /**
   * 파일 크기 포맷팅
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * 날짜 포맷팅
   */
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  /**
   * 압축률 포맷팅
   */
  const formatCompressionRatio = (ratio) => {
    return `${ratio.toFixed(2)}%`;
  };

  /**
   * 처리 시간 포맷팅
   */
  const formatProcessingTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="log-viewer-container">
      <div className="log-viewer-header">
        <h2 className="log-viewer-title">
          <span className="emoji">📊</span>
          작업 로그
        </h2>
        <p className="log-viewer-subtitle">이미지 변환 작업 기록 및 통계</p>
      </div>

      {/* 필터 영역 */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-item">
            <label>시작일</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label>종료일</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label>포맷</label>
            <select
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button className="filter-button apply" onClick={handleApplyFilter}>
            🔍 필터 적용
          </button>
          <button className="filter-button reset" onClick={handleResetFilter}>
            ↺ 초기화
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {statistics && (
        <div className="statistics-grid">
          <div className="stat-card">
            <div className="stat-icon">📁</div>
            <div className="stat-content">
              <div className="stat-label">총 파일 수</div>
              <div className="stat-value">{statistics.totalFiles}개</div>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-label">성공률</div>
              <div className="stat-value">
                {statistics.totalFiles > 0
                  ? ((statistics.successCount / statistics.totalFiles) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>
          </div>
          <div className="stat-card compression">
            <div className="stat-icon">📉</div>
            <div className="stat-content">
              <div className="stat-label">평균 압축률</div>
              <div className="stat-value">
                {formatCompressionRatio(statistics.averageCompressionRatio)}
              </div>
            </div>
          </div>
          <div className="stat-card savings">
            <div className="stat-icon">💾</div>
            <div className="stat-content">
              <div className="stat-label">절약 용량</div>
              <div className="stat-value">{formatFileSize(statistics.spaceSaved)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 로그 목록 */}
      <div className="logs-section">
        <div className="logs-header">
          <h3>로그 목록 ({logs.length}개)</h3>
          {isLoading && <div className="loading-spinner">🔄 불러오는 중...</div>}
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>로그가 없습니다.</p>
            <p className="empty-hint">이미지 변환을 시작하면 로그가 기록됩니다.</p>
          </div>
        ) : (
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>파일명</th>
                  <th>포맷</th>
                  <th>입력 크기</th>
                  <th>출력 크기</th>
                  <th>압축률</th>
                  <th>처리 시간</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={log.success ? 'success' : 'failed'}>
                    <td className="log-date">{formatDate(log.timestamp)}</td>
                    <td className="log-filename" title={log.filePath}>
                      {log.fileName}
                    </td>
                    <td className="log-format">
                      <span className="format-badge">{log.format.toUpperCase()}</span>
                    </td>
                    <td className="log-size">{formatFileSize(log.inputSize)}</td>
                    <td className="log-size">
                      {log.success ? formatFileSize(log.outputSize) : '-'}
                    </td>
                    <td className="log-compression">
                      {log.success ? formatCompressionRatio(log.compressionRatio) : '-'}
                    </td>
                    <td className="log-time">{formatProcessingTime(log.processingTime)}</td>
                    <td className="log-status">
                      {log.success ? (
                        <span className="status-success">✅ 성공</span>
                      ) : (
                        <span className="status-failed" title={log.error}>
                          ❌ 실패
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
