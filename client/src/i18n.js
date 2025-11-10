// client/src/i18n.js
// i18next 다국어 지원 설정

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 리소스 파일 import
import translationKO from './locales/ko/translation.json';
import translationEN from './locales/en/translation.json';

// 리소스 정의
const resources = {
  ko: {
    translation: translationKO
  },
  en: {
    translation: translationEN
  }
};

// i18n 초기화
i18n
  // 언어 감지 플러그인 (OS 언어 자동 감지)
  .use(LanguageDetector)
  // React 통합
  .use(initReactI18next)
  // 초기화
  .init({
    resources,
    fallbackLng: 'en', // 폴백 언어 (번역 누락 시 영어 사용)
    supportedLngs: ['ko', 'en'], // 지원 언어
    debug: false, // 디버그 모드 (개발 시 true)

    // 언어 감지 옵션
    detection: {
      order: ['localStorage', 'navigator'], // 감지 순서 (로컬 스토리지 우선, 그 다음 시스템 언어)
      caches: ['localStorage'], // 언어 설정 캐시 저장소
      lookupLocalStorage: 'i18nextLng' // 로컬 스토리지 키
    },

    // 네임스페이스 설정
    ns: ['translation'],
    defaultNS: 'translation',

    // 보간 설정 (변수 치환)
    interpolation: {
      escapeValue: false // React는 XSS 자동 방지
    },

    // React 옵션
    react: {
      useSuspense: false // Suspense 비활성화 (Electron 호환)
    }
  });

export default i18n;
