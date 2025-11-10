// components/BackupViewer.jsx - 백업 관리 컴포넌트

import React, { useState, useEffect } from 'react';
import './BackupViewer.css';

/**
 * BackupViewer 컴포넌트
 *
 * 백업 파일 목록 조회, 복원, 삭제 기능 제공
 *
 * @param {Object} props
 */
const BackupViewer = () => {
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [statistics, setStatistics] = useState({
    totalBackups: 0,
    totalSize: 0,
    activeBackups: 0,
    restoredBackups: 0,
  });

  /**
   * 백업 목록 조회
   */
  const loadBackups = async () => {
    if (!window.require) {
      alert('Electron 환경에서만 백업을 조회할 수 있습니다.');
      return;
    }

    setIsLoading(true);
    const { ipcRenderer } = window.require('electron');

    try {
      const filters = {};

      // 날짜 범위 필터
      if (dateRange.startDate) {
        filters.startDate = new Date(dateRange.startDate).getTime();
      }
      if (dateRange.endDate) {
        filters.endDate = new Date(dateRange.endDate).getTime();
      }

      // 상태 필터
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }

      const result = await ipcRenderer.invoke('backup:list', filters);

      if (result.success) {
        const backupList = result.data.backups || [];
        setBackups(backupList);
        calculateStatistics(backupList);
      } else {
        alert(`백업 목록 조회 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 목록 조회 실패:', error);
      alert('백업 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 통계 계산
   */
  const calculateStatistics = (backupList) => {
    const totalSize = backupList.reduce((sum, backup) => sum + backup.fileSize, 0);
    const activeBackups = backupList.filter((b) => b.status === 'active').length;
    const restoredBackups = backupList.filter((b) => b.status === 'restored').length;

    setStatistics({
      totalBackups: backupList.length,
      totalSize,
      activeBackups,
      restoredBackups,
    });
  };

  /**
   * 초기 백업 목록 조회
   */
  useEffect(() => {
    loadBackups();
  }, []);

  /**
   * 백업 복원
   */
  const handleRestore = async (backup) => {
    if (!window.confirm(`"${backup.fileName}"을(를) 원본 경로로 복원하시겠습니까?`)) {
      return;
    }

    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');

    try {
      const result = await ipcRenderer.invoke('backup:restore', backup.backupId);

      if (result.success) {
        alert('백업이 성공적으로 복원되었습니다.');
        loadBackups(); // 목록 새로고침
      } else {
        alert(`복원 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 복원 실패:', error);
      alert('백업 복원에 실패했습니다.');
    }
  };

  /**
   * 백업 삭제
   */
  const handleDelete = async (backup) => {
    if (
      !window.confirm(
        `"${backup.fileName}"의 백업을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');

    try {
      const result = await ipcRenderer.invoke('backup:delete', backup.backupId);

      if (result.success) {
        alert('백업이 삭제되었습니다.');
        loadBackups(); // 목록 새로고침
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('백업 삭제 실패:', error);
      alert('백업 삭제에 실패했습니다.');
    }
  };

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
    loadBackups();
  };

  /**
   * 필터 초기화
   */
  const handleResetFilter = () => {
    setDateRange({ startDate: '', endDate: '' });
    setFilterStatus('all');
    setTimeout(() => loadBackups(), 100);
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
    });
  };

  /**
   * 상태 배지 렌더링
   */
  const renderStatusBadge = (status) => {
    const badges = {
      active: { text: '활성', className: 'status-active', icon: '🟢' },
      restored: { text: '복원됨', className: 'status-restored', icon: '🔄' },
      deleted: { text: '삭제됨', className: 'status-deleted', icon: '🗑️' },
    };

    const badge = badges[status] || badges.active;

    return (
      <span className={`status-badge ${badge.className}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  return (
    <div className="backup-viewer-container">
      <div className="backup-viewer-header">
        <h2 className="backup-viewer-title">
          <span className="emoji">💾</span>
          백업 관리
        </h2>
        <p className="backup-viewer-subtitle">원본 파일 백업 및 복원</p>
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
            <label>상태</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="restored">복원됨</option>
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
      <div className="statistics-grid">
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <div className="stat-label">총 백업 수</div>
            <div className="stat-value">{statistics.totalBackups}개</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-label">활성 백업</div>
            <div className="stat-value">{statistics.activeBackups}개</div>
          </div>
        </div>
        <div className="stat-card restored">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-label">복원된 백업</div>
            <div className="stat-value">{statistics.restoredBackups}개</div>
          </div>
        </div>
        <div className="stat-card size">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">사용 공간</div>
            <div className="stat-value">{formatFileSize(statistics.totalSize)}</div>
          </div>
        </div>
      </div>

      {/* 백업 목록 */}
      <div className="backups-section">
        <div className="backups-header">
          <h3>백업 목록 ({backups.length}개)</h3>
          {isLoading && <div className="loading-spinner">🔄 불러오는 중...</div>}
        </div>

        {backups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>백업이 없습니다.</p>
            <p className="empty-hint">
              이미지 변환 시 자동으로 원본 파일이 백업됩니다.
            </p>
          </div>
        ) : (
          <div className="backup-grid">
            {backups.map((backup) => (
              <div key={backup.backupId} className="backup-card">
                <div className="backup-header">
                  <div className="backup-icon">🖼️</div>
                  <div className="backup-info">
                    <div className="backup-filename" title={backup.originalPath}>
                      {backup.fileName}
                    </div>
                    <div className="backup-path">{backup.originalPath}</div>
                  </div>
                  {renderStatusBadge(backup.status)}
                </div>

                <div className="backup-details">
                  <div className="backup-detail-item">
                    <span className="detail-label">크기</span>
                    <span className="detail-value">{formatFileSize(backup.fileSize)}</span>
                  </div>
                  <div className="backup-detail-item">
                    <span className="detail-label">백업일</span>
                    <span className="detail-value">{formatDate(backup.timestamp)}</span>
                  </div>
                  {backup.restoreCount > 0 && (
                    <div className="backup-detail-item">
                      <span className="detail-label">복원 횟수</span>
                      <span className="detail-value">{backup.restoreCount}회</span>
                    </div>
                  )}
                  {backup.lastRestoreDate && (
                    <div className="backup-detail-item">
                      <span className="detail-label">마지막 복원</span>
                      <span className="detail-value">
                        {formatDate(backup.lastRestoreDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="backup-actions">
                  <button
                    className="backup-button restore"
                    onClick={() => handleRestore(backup)}
                    disabled={backup.status === 'deleted'}
                  >
                    🔄 복원
                  </button>
                  <button
                    className="backup-button delete"
                    onClick={() => handleDelete(backup)}
                    disabled={backup.status === 'deleted'}
                  >
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupViewer;
