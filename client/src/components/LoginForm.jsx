// LoginForm.jsx - 로그인 폼 컴포넌트
import React, { useState } from 'react';
import DeviceLimitModal from './DeviceLimitModal';
import './LoginForm.css';

const LoginForm = ({ onSuccess, onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceLimitError, setDeviceLimitError] = useState(null);

  /**
   * 로그인 제출 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!window.require) {
      setError('Electron 환경에서만 로그인이 가능합니다.');
      setIsLoading(false);
      return;
    }

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth-sign-in', {
        email,
        password,
      });

      if (result.success) {
        // 로그인 성공
        onSuccess && onSuccess(result.data);
      } else {
        // 로그인 실패 - 기기 한도 초과 확인
        if (result.error && result.error.includes('기기 한도')) {
          // 기기 한도 초과 모달 표시
          setDeviceLimitError({
            tier: result.tier || 'free',
            maxDevices: result.maxDevices || 1,
            currentDevices: result.currentDevices || 1,
          });
        } else {
          // 기타 에러
          setError(result.error || '로그인에 실패했습니다.');
        }
      }
    } catch (err) {
      console.error('로그인 오류:', err);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="login-form-container">
        <h2 className="form-title">로그인</h2>

        <form className="login-form" onSubmit={handleSubmit}>
        {/* 이메일 입력 */}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            이메일
          </label>
          <input
            type="email"
            id="email"
            className="form-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        {/* 비밀번호 입력 */}
        <div className="form-group">
          <label htmlFor="password" className="form-label">
            비밀번호
          </label>
          <input
            type="password"
            id="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        {/* 에러 메시지 */}
        {error && <div className="error-message">{error}</div>}

        {/* 제출 버튼 */}
        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>

        {/* 회원가입 전환 */}
        <div className="form-footer">
          <p className="form-footer-text">
            계정이 없으신가요?{' '}
            <button
              type="button"
              className="link-button"
            onClick={onSwitchToSignUp}
            disabled={isLoading}
          >
            회원가입
          </button>
        </p>
        </div>
      </div>

      {/* 기기 한도 초과 모달 */}
      {deviceLimitError && (
        <DeviceLimitModal
          tier={deviceLimitError.tier}
          maxDevices={deviceLimitError.maxDevices}
          currentDevices={deviceLimitError.currentDevices}
          onClose={() => setDeviceLimitError(null)}
          onUpgrade={() => {
            // 업그레이드 페이지로 이동
            window.open('https://pixelbooster.com/upgrade', '_blank');
            setDeviceLimitError(null);
          }}
        />
      )}
    </>
  );
};

export default LoginForm;
