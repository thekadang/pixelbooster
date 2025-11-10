// LanguageSwitcher.jsx - 언어 전환 컴포넌트
import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <button
        className={'lang-btn ' + (i18n.language === 'ko' ? 'active' : '')}
        onClick={() => changeLanguage('ko')}
        title={t('settings.language')}
      >
        한국어
      </button>
      <button
        className={'lang-btn ' + (i18n.language === 'en' ? 'active' : '')}
        onClick={() => changeLanguage('en')}
        title={t('settings.language')}
      >
        English
      </button>
    </div>
  );
};

export default LanguageSwitcher;
