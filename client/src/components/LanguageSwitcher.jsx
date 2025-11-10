// client/src/components/LanguageSwitcher.jsx
// 언어 전환 컴포넌트

import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // 로컬 스토리지에 자동 저장됨 (i18next-browser-languagedetector)
  };

  return (
    <div className="language-switcher">
      <button
        className={`lang-btn ${i18n.language === 'ko' || i18n.language === 'ko-KR' ? 'active' : ''}`}
        onClick={() => changeLanguage('ko')}
        title={t('settings.korean')}
      >
        🇰🇷 한국어
      </button>
      <button
        className={`lang-btn ${i18n.language === 'en' || i18n.language === 'en-US' ? 'active' : ''}`}
        onClick={() => changeLanguage('en')}
        title={t('settings.english')}
      >
        🇺🇸 English
      </button>
    </div>
  );
}

export default LanguageSwitcher;
