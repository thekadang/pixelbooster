// SignUpForm.jsx - 회원가입 폼 컴포넌트
import React, { useState } from 'react';
import './SignUpForm.css';

const SignUpForm = ({ onSuccess, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * 비밀번호 유효성 검사
   */
  const validatePassword = () => {
    if (password.length < 6) {
      return '비밀번호는 최소 6자 이상이어야 합니다.';
    }
    if (password !== confirmPassword) {
      return '비밀번호가 일치하지 않습니다.';
    }
    return null;
  };

  /**
   * 회원가입 제출 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // 비밀번호 검증
    const passwordError = validatePassword();
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!window.require) {
      setError('Electron 환경에서만 회원가입이 가능합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth-sign-up', {
        email,
        password,
      });

      if (result.success) {
        // 회원가입 성공
        setSuccessMessage(
          '회원가입 완료! 이메일 인증 후 로그인하세요.'
        );
        // 3초 후 로그인 화면으로 전환
        setTimeout(() => {
          onSwitchToLogin && onSwitchToLogin();
        }, 3000);
      } else {
        // 회원가입 실패
        setError(result.error || '회원가입에 실패했습니다.');
      }
    } catch (err) {
      console.error('회원가입 오류:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-form-container">
      <h2 className="form-title">회원가입</h2>

      <form className="signup-form" onSubmit={handleSubmit}>
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
            minLength={6}
          />
          <p className="form-hint">최소 6자 이상</p>
        </div>

        {/* 비밀번호 확인 */}
        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">
            비밀번호 확인
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="form-input"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
            minLength={6}
          />
        </div>

        {/* 에러 메시지 */}
        {error && <div className="error-message">{error}</div>}

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="submit-button"
          disabled={isLoading || !!successMessage}
        >
          {isLoading ? '처리 중...' : '회원가입'}
        </button>
      </form>

      {/* 로그인 전환 */}
      <div className="form-footer">
        <p className="form-footer-text">
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            className="link-button"
            onClick={onSwitchToLogin}
            disabled={isLoading}
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUpForm;
