// AuthModal.jsx - 인증 모달 컴포넌트 (로그인/회원가입 전환)
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  if (!isOpen) return null;

  /**
   * 로그인 성공 핸들러
   */
  const handleSuccess = (authData) => {
    onSuccess && onSuccess(authData);
    onClose && onClose();
  };

  /**
   * 회원가입 전환
   */
  const switchToSignUp = () => {
    setMode('signup');
  };

  /**
   * 로그인 전환
   */
  const switchToLogin = () => {
    setMode('login');
  };

  /**
   * 오버레이 클릭 핸들러 (모달 외부 클릭 시 닫기)
   */
  const handleOverlayClick = (e) => {
    // 오버레이 자체를 클릭했을 때만 닫기 (자식 요소 클릭은 무시)
    if (e.target === e.currentTarget) {
      onClose && onClose();
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick} onMouseDown={handleOverlayClick}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {/* 닫기 버튼 */}
        <button className="close-button" onClick={onClose} title="닫기">
          ✕
        </button>

        {/* 로고 및 제목 */}
        <div className="modal-header">
          <h1 className="modal-logo">🚀 픽셀부스터</h1>
          <p className="modal-subtitle">
            {mode === 'login'
              ? '로그인하여 이미지 변환을 시작하세요'
              : '새 계정을 만들어 시작하세요'}
          </p>
        </div>

        {/* 폼 전환 */}
        <div className="modal-body">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToSignUp={switchToSignUp}
            />
          ) : (
            <SignUpForm
              onSuccess={handleSuccess}
              onSwitchToLogin={switchToLogin}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
