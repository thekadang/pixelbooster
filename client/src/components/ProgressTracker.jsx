// components/ProgressTracker.jsx - 진행 상태 추적 컴포넌트

import React from 'react';
import './ProgressTracker.css';

/**
 * ProgressTracker 컴포넌트
 *
 * 배치 처리 진행 상태 표시
 *
 * @param {Object} progress - 진행 상태 객체
 * @param {Function} onCancel - 취소 버튼 클릭 콜백
 */
const ProgressTracker = ({ progress, onCancel }) => {
  if (!progress) {
    return null;
  }

  const {
    total,
    completed,
    failed,
    processing,
    overallProgress,
    items = [],
  } = progress;

  /**
   * 파일 크기 포맷팅
   */
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * 처리 시간 계산
   */
  const calculateDuration = (startTime, endTime) => {
    if (!startTime) return '-';
    const duration = (endTime || Date.now()) - startTime;
    return (duration / 1000).toFixed(2) + 's';
  };

  /**
   * 압축률 계산
   */
  const calculateCompressionRatio = (original, converted) => {
    if (!original || !converted) return '-';
    const ratio = ((1 - converted / original) * 100).toFixed(1);
    return ratio > 0 ? `-${ratio}%` : `+${Math.abs(ratio)}%`;
  };

  return (
    <div className="progress-tracker">
      {/* 전체 진행 상태 */}
      <div className="overall-progress">
        <div className="progress-header">
          <h3 className="progress-title">변환 진행 상태</h3>
          {onCancel && processing > 0 && (
            <button className="cancel-button" onClick={onCancel}>
              ❌ 취소
            </button>
          )}
        </div>

        <div className="progress-stats">
          <div className="stat-item">
            <span className="stat-label">전체</span>
            <span className="stat-value">{total}</span>
          </div>
          <div className="stat-item success">
            <span className="stat-label">완료</span>
            <span className="stat-value">{completed}</span>
          </div>
          <div className="stat-item processing">
            <span className="stat-label">처리 중</span>
            <span className="stat-value">{processing}</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-label">실패</span>
            <span className="stat-value">{failed}</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${overallProgress}%` }}
            >
              <span className="progress-bar-text">{overallProgress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 개별 파일 진행 상태 */}
      <div className="items-progress">
        <h4 className="items-title">파일별 진행 상태 ({items.length}개)</h4>
        <div className="items-list">
          {items.map((item) => {
            const fileName = item.inputPath.split(/[\\/]/).pop();
            const statusIcon = {
              pending: '⏳',
              processing: '🔄',
              completed: '✅',
              failed: '❌',
            }[item.status];

            return (
              <div key={item.id} className={`item-card ${item.status}`}>
                <div className="item-header">
                  <span className="item-status-icon">{statusIcon}</span>
                  <span className="item-filename" title={item.inputPath}>
                    {fileName}
                  </span>
                </div>

                {item.status === 'processing' && (
                  <div className="item-progress-bar">
                    <div
                      className="item-progress-fill"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.status === 'completed' && (
                  <div className="item-details">
                    <span className="detail-item">
                      {formatFileSize(item.originalSize)} →{' '}
                      {formatFileSize(item.convertedSize)}
                    </span>
                    <span className="detail-item compression">
                      {calculateCompressionRatio(
                        item.originalSize,
                        item.convertedSize
                      )}
                    </span>
                    <span className="detail-item">
                      {calculateDuration(item.startTime, item.endTime)}
                    </span>
                  </div>
                )}

                {item.status === 'failed' && (
                  <div className="item-error">
                    <span className="error-message">{item.error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
