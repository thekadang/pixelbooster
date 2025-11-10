# 더카당 픽셀부스터 (The Kadang Pixel Booster)

이미지 최적화 및 변환을 위한 크로스 플랫폼 데스크톱 애플리케이션

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](https://github.com/thekadang/pixelbooster)
[![Version](https://img.shields.io/badge/version-0.1.0-brightgreen.svg)](https://github.com/thekadang/pixelbooster/releases)
[![Release](https://img.shields.io/github/v/release/thekadang/pixelbooster)](https://github.com/thekadang/pixelbooster/releases/latest)

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

### 사용자용 설치 (일반 사용자)

#### Windows
1. [GitHub Releases](https://github.com/thekadang/pixelbooster/releases/latest)에서 최신 버전 다운로드
2. `픽셀부스터 Setup 0.1.0.exe` 파일 실행
3. 설치 마법사 지침에 따라 설치
4. 시작 메뉴 또는 바탕화면 아이콘으로 실행

#### macOS (향후 지원)
- DMG 파일 다운로드 및 Applications 폴더로 드래그

#### 시스템 요구사항
- **OS**: Windows 10/11 (64-bit) 또는 macOS 10.13+
- **RAM**: 최소 4GB (권장 8GB 이상)
- **디스크**: 500MB 이상 여유 공간
- **인터넷**: 첫 실행 시 인증 및 업데이트 확인

### 개발자용 설치 (빌드 및 개발)

#### 필수 요구사항
- Node.js 18+
- npm 또는 yarn
- Git

#### 로컬 개발 환경 구축

```bash
# 1. 저장소 클론
git clone https://github.com/thekadang/pixelbooster.git
cd pixelbooster

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
# .env.example을 .env로 복사하고 Supabase 키 입력
cp .env.example .env

# 4. 개발 서버 실행
npm run dev
# 또는 별도 터미널에서:
# npm run dev:webpack  (Webpack 개발 서버)
# npm run dev:electron (Electron 앱)

# 5. 프로덕션 빌드
npm run build:win    # Windows 빌드
npm run build:mac    # macOS 빌드 (macOS 환경 필요)
npm run build:linux  # Linux 빌드
```

자세한 개발 가이드는 [개발 환경 설정 가이드](docs/development/setup.md)를 참고하세요.

---

## 📚 문서

모든 프로젝트 문서는 **[CLAUDE.md](CLAUDE.md)**에서 시작합니다.

### 주요 문서
- **[전체 시스템 구조](docs/architecture/system-overview.md)** - 아키텍처 개요
- **[데이터베이스 설계](docs/architecture/database-schema.md)** - DB 스키마 및 RLS
- **[코딩 컨벤션](docs/development/conventions.md)** - 명명 규칙 및 스타일
- **[진행 상황](task.md)** - 현재 작업 및 다음 단계

---

## 🎉 v0.1.0 릴리스 (첫 공식 릴리스!)

**릴리스 날짜**: 2025-11-11
**상태**: Production Ready ✅

### 주요 릴리스 내용
- ✅ **이미지 처리 엔진**: Sharp 기반 고성능 변환 (병렬 처리, 최대 3.75배 성능 향상)
- ✅ **인증 시스템**: Supabase Auth 연동, 기기 한도 관리, 암호화 저장소
- ✅ **구독 관리**: Free/Basic/Pro 3단계 구독, 기능별 접근 제어
- ✅ **백업 시스템**: 자동 백업, 복원, SHA-256 무결성 검증
- ✅ **로그 시스템**: Excel 기반 작업 로그, 통계 자동 생성
- ✅ **어필리에이트**: 추천 코드, 쿠키 추적, 수수료 관리
- ✅ **다국어 지원**: 한국어/영어 자동 감지 및 전환
- ✅ **자동 업데이트**: GitHub Releases 연동, 백그라운드 업데이트

### 완료된 Phase
1. ✅ **Phase 1**: 기반 구축 (100%)
2. ✅ **Phase 2**: 클라이언트 개발 (100%)
3. ✅ **Phase 3**: 서버 연동 (100%)
4. ✅ **Phase 4**: 고급 기능 (100%)
5. ✅ **Phase 5**: 다국어 및 배포 (100%)

### 테스트 및 검증
- ✅ TypeScript 컴파일 검증 (0 errors)
- ✅ 빌드 파일 자동 검증 완료
- ✅ [TEST_REPORT.md](TEST_REPORT.md) - 빌드 검증 보고서
- ✅ [MANUAL_TEST_GUIDE.md](MANUAL_TEST_GUIDE.md) - 사용자 수동 테스트 가이드

자세한 변경 사항은 [CHANGELOG.md](CHANGELOG.md)를 확인하세요.

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
