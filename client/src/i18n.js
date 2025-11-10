// i18n.js - i18next 설정 파일
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 리소스 파일 import
import translationKO from './locales/ko/translation.json';
import translationEN from './locales/en/translation.json';

const resources = {
  ko: {
    translation: translationKO
  },
  en: {
    translation: translationEN
  }
};

i18n
  // 언어 감지 플러그인
  .use(LanguageDetector)
  // React 통합
  .use(initReactI18next)
  // 초기화
  .init({
    resources,
    fallbackLng: 'en', // 폴백 언어
    supportedLngs: ['ko', 'en'], // 지원 언어
    debug: false, // 디버그 모드

    // 언어 감지 옵션
    detection: {
      order: ['localStorage', 'navigator'], // 감지 순서
      caches: ['localStorage'], // 캐시 저장소
      lookupLocalStorage: 'i18nextLng' // 로컬 스토리지 키
    },

    // 네임스페이스 (필요 시 확장)
    ns: ['translation'],
    defaultNS: 'translation',

    // 보간 설정
    interpolation: {
      escapeValue: false // React는 XSS 자동 방지
    },

    // React 옵션
    react: {
      useSuspense: false // Suspense 비활성화 (Electron 호환)
    }
  });

export default i18n;
