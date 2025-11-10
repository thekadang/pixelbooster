# 더카당 픽셀부스터 (The Kadang Pixel Booster)

이미지 최적화 및 변환을 위한 크로스 플랫폼 데스크톱 애플리케이션

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](https://github.com/thekadang/pixelbooster)

---

## 📌 프로젝트 개요

**픽셀부스터**는 윈도우와 맥 환경에서 이미지 파일을 손쉽게 변환하고 최적화할 수 있는 데스크톱 애플리케이션입니다. 직관적인 UI와 강력한 배치 처리 기능으로 웹사이트 성능 개선과 작업 효율을 극대화합니다.

### 핵심 가치
- **🚀 작업 효율**: 일괄 처리로 반복 작업 자동화
- **⚡ 성능 향상**: WEBP, AVIF 등 고압축 포맷 지원
- **🎨 직관적 UI**: 드래그 앤 드롭으로 즉시 사용
- **🌍 글로벌 지원**: 다국어 지원 (한국어, 영어)
- **💰 Freemium 모델**: 무료 버전부터 프로 기능까지

---

## ✨ 주요 기능

### Free (무료)
- ✅ **무제한 변환**: 횟수 제한 없음
- ✅ **WEBP 변환**: 다양한 포맷 → WEBP
  - 입력: JPG, PNG, GIF, BMP, TIFF, SVG
- ✅ **파일 선택**: 다중 파일 선택 가능
- ✅ **다국어 지원**: 한국어, 영어

### Basic (베이직)
- ✅ Free 기능 전체
- ✅ **AVIF 지원**: 다양한 포맷 → WEBP/AVIF
  - 추가 입력: HEIF, AVIF
- ✅ **폴더 선택**: 하위 폴더 포함 가능
- ✅ **백업 기능**: 원본 파일 자동 백업
- ✅ **로그 기록**: Excel 작업 로그

### Pro (프로)
- ✅ Basic 기능 전체
- ✅ **모든 포맷 상호 변환**:
  - 입력: JPG, PNG, GIF, BMP, TIFF, SVG, WEBP, AVIF, HEIF
  - 출력: JPG, PNG, GIF, WEBP, AVIF, TIFF
- ✅ **컴퓨터 전체**: 드라이브 전체 스캔 및 변환

---

## 🏗️ 기술 스택

### 클라이언트 (Desktop App)
- **프레임워크**: Electron 39+
- **언어**: TypeScript 5.9+
- **UI**: React 19 + JSX/TSX
- **번들러**: Webpack 5
- **이미지 처리**: Sharp 0.34+
- **Excel**: ExcelJS
- **다국어**: i18next

### 서버 (Backend)
- **BaaS**: Supabase
- **데이터베이스**: PostgreSQL
- **인증**: Supabase Auth (JWT)
- **서버리스**: Deno (Edge Functions)

### 관리자 대시보드
- **프레임워크**: React 18
- **UI 라이브러리**: Material-UI
- **차트**: Recharts

---

## 📂 프로젝트 구조

```
thekadang_pixelbooster/
├── docs/               # 📚 문서 시스템
├── client/             # 💻 데스크톱 앱
├── server/             # 🌐 Supabase Functions
├── admin/              # 👨‍💼 관리자 대시보드
├── shared/             # 🔄 공통 코드
├── CLAUDE.md           # 📌 문서 허브
├── task.md             # 📋 진행 상황
└── README.md           # 📖 프로젝트 소개
```

---

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18+
- npm 또는 yarn
- Git

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/thekadang/pixelbooster.git
cd pixelbooster

# 의존성 설치
npm install

# 클라이언트 개발 모드 실행
cd client
npm run dev

# 관리자 대시보드 실행
cd admin
npm run dev
```

자세한 내용은 [개발 환경 설정 가이드](docs/development/setup.md)를 참고하세요.

---

## 📚 문서

모든 프로젝트 문서는 **[CLAUDE.md](CLAUDE.md)**에서 시작합니다.

### 주요 문서
- **[전체 시스템 구조](docs/architecture/system-overview.md)** - 아키텍처 개요
- **[데이터베이스 설계](docs/architecture/database-schema.md)** - DB 스키마 및 RLS
- **[코딩 컨벤션](docs/development/conventions.md)** - 명명 규칙 및 스타일
- **[진행 상황](task.md)** - 현재 작업 및 다음 단계

---

## 🔄 개발 진행 상황

**현재 단계**: Phase 3 완료! 🎉 (서버 연동)
**진행률**: 70%

### 최근 완료 작업
- ✅ Phase 1: 기반 구축 완료 (100%)
- ✅ Phase 2: 클라이언트 개발 완료 (100%) 🎉
  - Electron + React 초기화
  - ImageProcessor 코어 로직 (TypeScript)
  - React UI 컴포넌트 (DropZone, SettingsPanel, ProgressTracker)
  - Main Process TypeScript 마이그레이션
  - 병렬 처리 최적화 (MAX_CONCURRENT = 4)
  - 실제 이미지 변환 테스트 완료
  - 이미지 처리 기능 문서 작성
- ✅ Phase 3: 서버 연동 완료 (100%) 🎉
  - Phase 3-1: AuthManager, SecureStorage, SubscriptionManager 구현
  - Phase 3-2: 로그인/회원가입 UI 구현, 구독 등급별 제한
  - Phase 3-3: DeviceManager 구현, Edge Function 배포, 기기 인증 시스템
  - Supabase Auth 연동 및 JWT 토큰 관리
  - 등급별 기기 한도 (Free 1대, Basic 2대, Pro 5대)
  - Edge Function: login-with-device-check 배포 완료

자세한 진행 상황은 [task.md](task.md)를 확인하세요.

---

## 🤝 기여 방법

이 프로젝트는 현재 초기 개발 단계입니다. 기여를 원하시면:

1. 이 저장소를 Fork 합니다
2. 새 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: 새로운 기능 추가'`)
4. 브랜치에 Push 합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

커밋 메시지는 [코딩 컨벤션](docs/development/conventions.md#git-commit-메시지)을 따라주세요.

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

---

## 📞 연락처

- **프로젝트 링크**: [https://github.com/thekadang/pixelbooster](https://github.com/thekadang/pixelbooster)
- **이슈 리포트**: [GitHub Issues](https://github.com/thekadang/pixelbooster/issues)

---

## 🙏 감사의 말

- [Electron](https://www.electronjs.org/) - 크로스 플랫폼 프레임워크
- [Sharp](https://sharp.pixelplumbing.com/) - 고성능 이미지 처리
- [Supabase](https://supabase.com/) - 백엔드 인프라
- [React](https://react.dev/) - UI 라이브러리

---

**Made with ❤️ by The Kadang**
