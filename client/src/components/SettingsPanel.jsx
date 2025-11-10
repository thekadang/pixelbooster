// components/SettingsPanel.jsx - 설정 패널 컴포넌트

import React, { useState } from 'react';
import './SettingsPanel.css';

/**
 * SettingsPanel 컴포넌트
 *
 * 이미지 변환 옵션 설정 (포맷, 품질, 압축 레벨 등)
 *
 * @param {Object} options - 현재 설정 옵션
 * @param {Function} onOptionsChange - 옵션 변경 시 호출되는 콜백
 */
const SettingsPanel = ({ options, onOptionsChange }) => {
  const [localOptions, setLocalOptions] = useState(
    options || {
      format: 'webp',
      quality: 80,
      compressionLevel: 6,
      maintainAspectRatio: true,
      width: undefined,
      height: undefined,
    }
  );

  /**
   * 옵션 변경 핸들러
   */
  const handleChange = (key, value) => {
    const newOptions = { ...localOptions, [key]: value };
    setLocalOptions(newOptions);

    if (onOptionsChange) {
      onOptionsChange(newOptions);
    }
  };

  /**
   * 숫자 입력 처리
   */
  const handleNumberChange = (key, value) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    handleChange(key, numValue);
  };

  return (
    <div className="settings-panel">
      <h3 className="settings-title">⚙️ 변환 옵션</h3>

      {/* 출력 포맷 */}
      <div className="setting-group">
        <label className="setting-label">출력 포맷</label>
        <select
          className="setting-select"
          value={localOptions.format}
          onChange={(e) => handleChange('format', e.target.value)}
        >
          <option value="webp">WebP (권장)</option>
          <option value="avif">AVIF (최고 압축률)</option>
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="gif">GIF</option>
          <option value="bmp">BMP</option>
          <option value="tiff">TIFF</option>
        </select>
        <p className="setting-description">
          {localOptions.format === 'webp' &&
            'WebP는 빠른 속도와 좋은 압축률을 제공합니다.'}
          {localOptions.format === 'avif' &&
            'AVIF는 최고의 압축률을 제공하지만 처리 시간이 더 걸립니다.'}
          {localOptions.format === 'jpg' && 'JPG는 사진에 적합한 포맷입니다.'}
          {localOptions.format === 'png' &&
            'PNG는 투명도가 필요한 이미지에 적합합니다.'}
        </p>
      </div>

      {/* 품질 설정 */}
      <div className="setting-group">
        <label className="setting-label">
          품질: {localOptions.quality}%
        </label>
        <input
          type="range"
          className="setting-slider"
          min="1"
          max="100"
          value={localOptions.quality}
          onChange={(e) => handleChange('quality', parseInt(e.target.value))}
        />
        <div className="slider-labels">
          <span>낮음 (작은 파일)</span>
          <span>높음 (큰 파일)</span>
        </div>
        <p className="setting-description">
          품질이 높을수록 파일 크기가 커집니다. 80~90%가 권장됩니다.
        </p>
      </div>

      {/* 압축 레벨 */}
      <div className="setting-group">
        <label className="setting-label">
          압축 레벨: {localOptions.compressionLevel}
        </label>
        <input
          type="range"
          className="setting-slider"
          min="0"
          max="9"
          value={localOptions.compressionLevel}
          onChange={(e) => handleChange('compressionLevel', parseInt(e.target.value))}
        />
        <div className="slider-labels">
          <span>빠름 (0)</span>
          <span>느림 but 작음 (9)</span>
        </div>
        <p className="setting-description">
          압축 레벨이 높을수록 처리 시간이 늘어나지만 파일 크기가 작아집니다.
        </p>
      </div>

      {/* 리사이즈 옵션 */}
      <div className="setting-group">
        <label className="setting-label">리사이즈 (선택사항)</label>
        <div className="resize-inputs">
          <div className="resize-input-group">
            <label>너비 (px)</label>
            <input
              type="number"
              className="setting-input"
              placeholder="자동"
              value={localOptions.width || ''}
              onChange={(e) => handleNumberChange('width', e.target.value)}
            />
          </div>
          <div className="resize-input-group">
            <label>높이 (px)</label>
            <input
              type="number"
              className="setting-input"
              placeholder="자동"
              value={localOptions.height || ''}
              onChange={(e) => handleNumberChange('height', e.target.value)}
            />
          </div>
        </div>
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={localOptions.maintainAspectRatio}
            onChange={(e) => handleChange('maintainAspectRatio', e.target.checked)}
          />
          <span>종횡비 유지</span>
        </label>
        <p className="setting-description">
          리사이즈를 원하지 않으면 비워두세요. 종횡비 유지를 활성화하면 이미지 비율이
          유지됩니다.
        </p>
      </div>

      {/* 프리셋 버튼 */}
      <div className="setting-group">
        <label className="setting-label">빠른 프리셋</label>
        <div className="preset-buttons">
          <button
            className="preset-button"
            onClick={() => {
              const newOptions = {
                ...localOptions,
                format: 'webp',
                quality: 75,
                compressionLevel: 4,
              };
              setLocalOptions(newOptions);
              onOptionsChange(newOptions);
            }}
          >
            🚀 빠른 변환
          </button>
          <button
            className="preset-button"
            onClick={() => {
              const newOptions = {
                ...localOptions,
                format: 'webp',
                quality: 85,
                compressionLevel: 6,
              };
              setLocalOptions(newOptions);
              onOptionsChange(newOptions);
            }}
          >
            ⚖️ 균형잡힌
          </button>
          <button
            className="preset-button"
            onClick={() => {
              const newOptions = {
                ...localOptions,
                format: 'avif',
                quality: 90,
                compressionLevel: 9,
              };
              setLocalOptions(newOptions);
              onOptionsChange(newOptions);
            }}
          >
            💎 최고 품질
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
