// components/DropZone.jsx - 드래그 앤 드롭 영역 컴포넌트

import React, { useState, useCallback } from 'react';
import './DropZone.css';

/**
 * DropZone 컴포넌트
 *
 * 파일 드래그 앤 드롭 및 파일 선택 다이얼로그 제공
 *
 * @param {Function} onFilesSelected - 파일 선택 시 호출되는 콜백
 */
const DropZone = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  /**
   * 드래그 오버 이벤트 처리
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * 드래그 리브 이벤트 처리
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * 드롭 이벤트 처리
   */
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const imagePaths = files
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => file.path);

      if (imagePaths.length > 0) {
        setSelectedFiles(imagePaths);
        if (onFilesSelected) {
          onFilesSelected(imagePaths);
        }
      } else {
        alert('이미지 파일만 선택할 수 있습니다.');
      }
    },
    [onFilesSelected]
  );

  /**
   * 파일 선택 다이얼로그 열기
   */
  const handleFileSelect = async () => {
    if (!window.require) {
      alert('Electron 환경에서만 파일 선택이 가능합니다.');
      return;
    }

    const { ipcRenderer } = window.require('electron');

    try {
      const result = await ipcRenderer.invoke('open-file-dialog');

      if (result.success && result.data.length > 0) {
        setSelectedFiles(result.data);
        if (onFilesSelected) {
          onFilesSelected(result.data);
        }
      }
    } catch (error) {
      console.error('파일 선택 실패:', error);
      alert('파일 선택에 실패했습니다.');
    }
  };

  /**
   * 파일 목록 초기화
   */
  const handleClearFiles = () => {
    setSelectedFiles([]);
    if (onFilesSelected) {
      onFilesSelected([]);
    }
  };

  /**
   * 파일 크기 포맷팅
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="dropzone-container">
      <div
        className={`dropzone-area ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileSelect}
      >
        <div className="dropzone-content">
          <div className="dropzone-icon">
            {selectedFiles.length > 0 ? '✅' : '📁'}
          </div>
          <h3 className="dropzone-title">
            {selectedFiles.length > 0
              ? `${selectedFiles.length}개 파일 선택됨`
              : '파일을 드래그 앤 드롭하거나 클릭하세요'}
          </h3>
          <p className="dropzone-subtitle">
            {selectedFiles.length > 0
              ? '다른 파일을 선택하려면 클릭하세요'
              : 'JPG, PNG, GIF, BMP, TIFF, SVG, WEBP, AVIF 지원'}
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <h4>선택된 파일 ({selectedFiles.length}개)</h4>
            <button className="clear-button" onClick={handleClearFiles}>
              모두 제거
            </button>
          </div>

          <div className="file-items">
            {selectedFiles.map((filePath, index) => {
              const fileName = filePath.split(/[\\/]/).pop();
              return (
                <div key={index} className="file-item">
                  <div className="file-icon">🖼️</div>
                  <div className="file-info">
                    <div className="file-name" title={filePath}>
                      {fileName}
                    </div>
                    <div className="file-path">{filePath}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropZone;
