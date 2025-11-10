# 다국어 지원 시스템 (i18n)

> i18next 기반 한국어/영어 다국어 지원 시스템

**작성일**: 2025-11-10
**버전**: v0.1.0
**지원 언어**: 한국어 (ko), 영어 (en)

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [설치 및 설정](#설치-및-설정)
3. [리소스 파일 구조](#리소스-파일-구조)
4. [사용 방법](#사용-방법)
5. [언어 전환](#언어-전환)
6. [번역 추가](#번역-추가)

---

## 시스템 개요

### 사용 라이브러리

- **i18next**: 다국어 지원 핵심 라이브러리
- **react-i18next**: React 통합
- **i18next-browser-languagedetector**: OS 언어 자동 감지
- **i18next-http-backend**: 리소스 파일 동적 로드

### 기능

- ✅ OS 언어 자동 감지 (한국어/영어)
- ✅ 수동 언어 전환
- ✅ 로컬 스토리지 언어 설정 저장
- ✅ 네임스페이스 기반 리소스 관리
- ✅ 폴백 번역 (번역 누락 시 영어 표시)
- ✅ 동적 번역 추가

---

## 설치 및 설정

### 패키지 설치

```bash
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend --save
```

### i18next 설정 (client/src/i18n.js)

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

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
  // Backend 플러그인 (동적 로드)
  .use(Backend)
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
```

---

## 리소스 파일 구조

### 파일 위치

```
client/src/locales/
├── ko/
│   └── translation.json  # 한국어 번역
└── en/
    └── translation.json  # 영어 번역
```

### 한국어 리소스 (ko/translation.json)

```json
{
  "app": {
    "title": "픽셀부스터",
    "subtitle": "이미지 최적화 도구"
  },
  "auth": {
    "login": "로그인",
    "signup": "회원가입",
    "email": "이메일",
    "password": "비밀번호",
    "forgotPassword": "비밀번호를 잊으셨나요?",
    "signupLink": "계정이 없으신가요? 회원가입",
    "loginLink": "이미 계정이 있으신가요? 로그인"
  },
  "tabs": {
    "converter": "변환",
    "logs": "로그",
    "backups": "백업",
    "affiliate": "어필리에이트"
  },
  "converter": {
    "dropzone": "이미지를 드래그하거나 클릭하여 선택",
    "selectFolder": "폴더 선택",
    "format": "출력 포맷",
    "quality": "품질",
    "startConversion": "변환 시작",
    "cancel": "취소",
    "processing": "처리 중..."
  },
  "settings": {
    "language": "언어",
    "selectLanguage": "언어 선택"
  },
  "subscription": {
    "free": "무료",
    "basic": "베이직",
    "pro": "프로",
    "upgrade": "업그레이드",
    "expired": "만료됨"
  },
  "common": {
    "save": "저장",
    "cancel": "취소",
    "confirm": "확인",
    "delete": "삭제",
    "edit": "수정",
    "close": "닫기",
    "loading": "로딩 중...",
    "error": "오류",
    "success": "성공"
  }
}
```

### 영어 리소스 (en/translation.json)

```json
{
  "app": {
    "title": "Pixel Booster",
    "subtitle": "Image Optimization Tool"
  },
  "auth": {
    "login": "Login",
    "signup": "Sign Up",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot Password?",
    "signupLink": "Don't have an account? Sign Up",
    "loginLink": "Already have an account? Login"
  },
  "tabs": {
    "converter": "Converter",
    "logs": "Logs",
    "backups": "Backups",
    "affiliate": "Affiliate"
  },
  "converter": {
    "dropzone": "Drag images or click to select",
    "selectFolder": "Select Folder",
    "format": "Output Format",
    "quality": "Quality",
    "startConversion": "Start Conversion",
    "cancel": "Cancel",
    "processing": "Processing..."
  },
  "settings": {
    "language": "Language",
    "selectLanguage": "Select Language"
  },
  "subscription": {
    "free": "Free",
    "basic": "Basic",
    "pro": "Pro",
    "upgrade": "Upgrade",
    "expired": "Expired"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  }
}
```

---

## 사용 방법

### App.jsx에서 i18n 초기화

```javascript
import React from 'react';
import './i18n'; // i18n 초기화

function App() {
  return (
    <div className="app">
      {/* 컴포넌트들 */}
    </div>
  );
}

export default App;
```

### 컴포넌트에서 번역 사용

#### Hook 방식 (함수형 컴포넌트)

```javascript
import React from 'react';
import { useTranslation } from 'react-i18next';

function LoginForm() {
  const { t } = useTranslation();

  return (
    <form>
      <h2>{t('auth.login')}</h2>
      <input type="email" placeholder={t('auth.email')} />
      <input type="password" placeholder={t('auth.password')} />
      <button>{t('auth.login')}</button>
      <a href="/forgot">{t('auth.forgotPassword')}</a>
    </form>
  );
}

export default LoginForm;
```

#### 변수 보간 (interpolation)

```javascript
// translation.json
{
  "welcome": "안녕하세요, {{name}}님!",
  "fileCount": "{{count}}개 파일 변환 완료"
}

// 컴포넌트
const { t } = useTranslation();

<h1>{t('welcome', { name: '더카당' })}</h1>
// 출력: 안녕하세요, 더카당님!

<p>{t('fileCount', { count: 5 })}</p>
// 출력: 5개 파일 변환 완료
```

#### 복수형 처리 (pluralization)

```json
{
  "file": "파일",
  "file_plural": "파일들",
  "fileCountWithPlural": "{{count}}개의 {{file}}"
}
```

```javascript
<p>{t('file', { count: 1 })}</p> // 파일
<p>{t('file', { count: 5 })}</p> // 파일들
```

---

## 언어 전환

### 언어 전환 컴포넌트

```javascript
import React from 'react';
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // 로컬 스토리지에 자동 저장됨
  };

  return (
    <div className="language-switcher">
      <button
        className={i18n.language === 'ko' ? 'active' : ''}
        onClick={() => changeLanguage('ko')}
      >
        한국어
      </button>
      <button
        className={i18n.language === 'en' ? 'active' : ''}
        onClick={() => changeLanguage('en')}
      >
        English
      </button>
    </div>
  );
}

export default LanguageSwitcher;
```

### 드롭다운 방식

```javascript
function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  );
}
```

---

## 번역 추가

### 네임스페이스 추가

```javascript
// i18n.js
const resources = {
  ko: {
    translation: translationKO,
    settings: settingsKO,  // 새로운 네임스페이스
    errors: errorsKO
  },
  en: {
    translation: translationEN,
    settings: settingsEN,
    errors: errorsEN
  }
};

i18n.init({
  ns: ['translation', 'settings', 'errors'],
  defaultNS: 'translation'
});
```

### 특정 네임스페이스 사용

```javascript
const { t } = useTranslation('settings');

<h2>{t('title')}</h2>  // settings.title
```

### 동적 번역 추가

```javascript
i18n.addResourceBundle('ko', 'translation', {
  newKey: '새로운 번역'
}, true, true);
```

---

## 언어 감지 로직

### 우선순위

1. **로컬 스토리지** (`localStorage.getItem('i18nextLng')`)
2. **시스템 언어** (`navigator.language`)
3. **폴백 언어** (`en`)

### 시스템 언어 매핑

```javascript
// ko-KR → ko
// en-US → en
// ja-JP → en (지원하지 않으면 폴백)
```

### 수동 설정 우선

```javascript
// 사용자가 언어를 수동으로 변경하면 localStorage에 저장됨
i18n.changeLanguage('ko');
// localStorage.setItem('i18nextLng', 'ko')
```

---

## 모범 사례

### 1. 번역 키 네이밍

```json
{
  "feature.component.action": "번역"
}

// 예시:
{
  "auth.login.submit": "로그인",
  "converter.dropzone.placeholder": "이미지를 드래그하세요",
  "settings.language.label": "언어"
}
```

### 2. 컨텍스트 분리

```json
{
  "button": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제"
  },
  "message": {
    "saveSuccess": "저장되었습니다",
    "saveError": "저장 실패"
  }
}
```

### 3. 재사용 가능한 common 섹션

```json
{
  "common": {
    "yes": "예",
    "no": "아니오",
    "confirm": "확인",
    "cancel": "취소"
  }
}
```

---

## 성능 최적화

### 1. 네임스페이스 분리

```javascript
// 모든 번역을 하나의 파일에 넣지 말고 네임스페이스로 분리
client/src/locales/ko/
├── translation.json  # 공통
├── auth.json         # 인증
├── converter.json    # 변환
├── settings.json     # 설정
└── errors.json       # 에러 메시지
```

### 2. 필요한 네임스페이스만 로드

```javascript
const { t } = useTranslation(['translation', 'auth']);
```

---

## 테스트

### 언어 전환 테스트

```javascript
// 한국어 → 영어
i18n.changeLanguage('en');
expect(t('auth.login')).toBe('Login');

// 영어 → 한국어
i18n.changeLanguage('ko');
expect(t('auth.login')).toBe('로그인');
```

### 누락 번역 처리

```javascript
// 번역이 없으면 영어 폴백
// ko/translation.json에 "newFeature"가 없으면
// en/translation.json의 "newFeature" 사용
```

---

## 참고 문서

- [i18next 공식 문서](https://www.i18next.com/)
- [react-i18next 공식 문서](https://react.i18next.com/)
- [언어 감지 플러그인](https://github.com/i18next/i18next-browser-languageDetector)

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
