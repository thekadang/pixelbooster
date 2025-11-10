// client/src/components/DeviceLimitModal.jsx
import React from 'react';
import './DeviceLimitModal.css';

/**
 * DeviceLimitModal - 기기 한도 초과 모달
 *
 * Props:
 * - tier: 현재 구독 등급
 * - maxDevices: 최대 기기 수
 * - currentDevices: 현재 등록된 기기 수
 * - onClose: 모달 닫기 콜백
 * - onUpgrade: 업그레이드 버튼 클백
 */
const DeviceLimitModal = ({
  tier = 'free',
  maxDevices = 1,
  currentDevices = 1,
  onClose,
  onUpgrade,
}) => {
  // 등급별 추천 업그레이드
  const getUpgradeRecommendation = () => {
    if (tier === 'free') {
      return {
        nextTier: 'Basic',
        nextMaxDevices: 2,
        price: '$9.99/월',
      };
    }
    if (tier === 'basic') {
      return {
        nextTier: 'Pro',
        nextMaxDevices: 5,
        price: '$19.99/월',
      };
    }
    return null;
  };

  const upgrade = getUpgradeRecommendation();

  return (
    <div className="device-limit-modal-overlay" onClick={onClose}>
      <div className="device-limit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="device-limit-header">
          <h2>🚫 기기 한도 초과</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="device-limit-content">
          <p className="limit-message">
            현재 <strong>{tier.toUpperCase()}</strong> 플랜은 최대{' '}
            <strong>{maxDevices}대</strong>의 기기까지 등록할 수 있습니다.
          </p>

          <div className="device-info">
            <div className="info-item">
              <span className="label">현재 등록된 기기:</span>
              <span className="value">{currentDevices}대</span>
            </div>
            <div className="info-item">
              <span className="label">최대 허용 기기:</span>
              <span className="value">{maxDevices}대</span>
            </div>
          </div>

          <div className="solutions">
            <h3>해결 방법</h3>

            <div className="solution-option">
              <h4>1. 기존 기기 제거</h4>
              <p>
                웹사이트의 계정 설정에서 사용하지 않는 기기를 제거할 수 있습니다.
              </p>
              <a
                href="https://pixelbooster.com/settings/devices"
                target="_blank"
                rel="noopener noreferrer"
                className="link-btn"
              >
                기기 관리 페이지 열기 →
              </a>
            </div>

            {upgrade && (
              <div className="solution-option upgrade-option">
                <h4>2. 플랜 업그레이드</h4>
                <p>
                  <strong>{upgrade.nextTier}</strong> 플랜으로 업그레이드하면{' '}
                  <strong>{upgrade.nextMaxDevices}대</strong>까지 등록할 수 있습니다.
                </p>
                <button className="upgrade-btn" onClick={onUpgrade}>
                  {upgrade.nextTier} 플랜으로 업그레이드 ({upgrade.price})
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="device-limit-footer">
          <button className="secondary-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceLimitModal;
