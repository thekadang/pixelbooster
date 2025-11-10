// AffiliatePanel.jsx - 어필리에이트 대시보드 컴포넌트
import React, { useState, useEffect } from 'react';
import './AffiliatePanel.css';

const AffiliatePanel = () => {
  const [trackingLink, setTrackingLink] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeSubscriptions: 0,
    thisMonthRevenue: 0,
    totalRevenue: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 컴포넌트 마운트 시 추적 링크 및 통계 조회
   */
  useEffect(() => {
    loadAffiliateData();
  }, []);

  /**
   * 어필리에이트 데이터 조회
   */
  const loadAffiliateData = async () => {
    if (!window.require) return;

    setIsLoading(true);
    setError(null);

    try {
      const { ipcRenderer } = window.require('electron');

      // 추적 링크 생성 (또는 조회)
      const linkResult = await ipcRenderer.invoke('affiliate-create-link');
      if (linkResult.success) {
        setTrackingCode(linkResult.data.trackingCode);
        setTrackingLink(linkResult.data.trackingUrl);
      } else {
        throw new Error(linkResult.error || '추적 링크 생성 실패');
      }

      // 통계 조회
      const statsResult = await ipcRenderer.invoke('affiliate-get-stats');
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      // 추천 내역 조회
      const referralsResult = await ipcRenderer.invoke('affiliate-get-referrals');
      if (referralsResult.success) {
        setReferrals(referralsResult.data);
      }
    } catch (err) {
      console.error('[AffiliatePanel] 데이터 조회 실패:', err);
      setError(err.message || '데이터를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 추적 링크 복사
   */
  const handleCopyLink = () => {
    if (!trackingLink) return;

    navigator.clipboard.writeText(trackingLink);
    alert('추적 링크가 복사되었습니다!');
  };

  /**
   * 링크 공유 (이메일)
   */
  const handleShareLink = () => {
    if (!trackingLink) return;

    const subject = encodeURIComponent('픽셀부스터 - 이미지 최적화 앱 추천');
    const body = encodeURIComponent(
      `안녕하세요!\n\n픽셀부스터는 이미지를 빠르고 쉽게 최적화할 수 있는 데스크톱 앱입니다.\n\n아래 링크로 가입하시면 특별 혜택을 받을 수 있습니다:\n${trackingLink}\n\n감사합니다!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  /**
   * 통계 카드 렌더링
   */
  const renderStatsCards = () => {
    const cards = [
      {
        icon: '👥',
        label: '총 추천 수',
        value: stats.totalReferrals,
        unit: '명',
      },
      {
        icon: '✅',
        label: '활성 구독자',
        value: stats.activeSubscriptions,
        unit: '명',
      },
      {
        icon: '💵',
        label: '이번 달 수익',
        value: `$${stats.thisMonthRevenue.toFixed(2)}`,
        unit: '',
      },
      {
        icon: '💰',
        label: '총 누적 수익',
        value: `$${stats.totalRevenue.toFixed(2)}`,
        unit: '',
      },
    ];

    return (
      <div className="affiliate-stats-grid">
        {cards.map((card, index) => (
          <div key={index} className="affiliate-stat-card">
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-content">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">
                {card.value}
                {card.unit && <span className="stat-unit">{card.unit}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 추천 내역 테이블 렌더링
   */
  const renderReferralsTable = () => {
    if (referrals.length === 0) {
      return (
        <div className="affiliate-empty">
          <p>아직 추천한 사용자가 없습니다.</p>
          <p>위의 추적 링크를 공유하여 첫 추천을 시작해보세요!</p>
        </div>
      );
    }

    return (
      <div className="affiliate-table-container">
        <table className="affiliate-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>사용자 이메일</th>
              <th>구독 상태</th>
              <th>구독 등급</th>
              <th>이번 달 수익</th>
              <th>총 수익</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((referral, index) => (
              <tr key={index}>
                <td>{new Date(referral.created_at).toLocaleDateString('ko-KR')}</td>
                <td>{referral.user_email}</td>
                <td>
                  <span className={`status-badge ${referral.subscription_status}`}>
                    {referral.subscription_status === 'active' ? '활성' :
                     referral.subscription_status === 'expired' ? '만료' : '취소'}
                  </span>
                </td>
                <td>
                  <span className={`tier-badge tier-${referral.subscription_tier}`}>
                    {referral.subscription_tier.toUpperCase()}
                  </span>
                </td>
                <td>${referral.this_month_revenue.toFixed(2)}</td>
                <td>${referral.total_revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="affiliate-panel">
        <div className="affiliate-loading">
          <div className="loading-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="affiliate-panel">
        <div className="affiliate-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button className="retry-button" onClick={loadAffiliateData}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="affiliate-panel">
      {/* 헤더 */}
      <div className="affiliate-header">
        <h2 className="affiliate-title">
          <span className="title-icon">🔗</span>
          어필리에이트 대시보드
        </h2>
        <button className="refresh-button" onClick={loadAffiliateData}>
          🔄 새로고침
        </button>
      </div>

      {/* 추적 링크 섹션 */}
      <div className="affiliate-link-section">
        <label className="link-label">추적 링크</label>
        <div className="link-input-group">
          <input
            type="text"
            className="link-input"
            value={trackingLink}
            readOnly
          />
          <button className="copy-button" onClick={handleCopyLink}>
            📋 복사
          </button>
          <button className="share-button" onClick={handleShareLink}>
            📧 공유
          </button>
        </div>
        <p className="link-hint">
          이 링크를 통해 가입한 사용자가 구독을 유지하는 동안 수수료를 받습니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="affiliate-stats-section">
        <h3 className="section-title">📊 통계</h3>
        {renderStatsCards()}
      </div>

      {/* 추천 내역 */}
      <div className="affiliate-referrals-section">
        <h3 className="section-title">📋 추천 내역</h3>
        {renderReferralsTable()}
      </div>
    </div>
  );
};

export default AffiliatePanel;
