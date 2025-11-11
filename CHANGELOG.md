# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1] - 2025-11-11 (버그 수정 패치) 🐛

### Fixed (수정된 버그)
- **로그인 입력 필드 차단 문제 수정** (CRITICAL 버그)
  - 문제: 로그인 모달의 이메일 및 비밀번호 입력 필드에서 텍스트 입력 불가
  - 원인: AuthModal 오버레이의 이벤트 핸들러가 입력 필드와 간섭
  - 해결:
    - `AuthModal.jsx`: 오버레이 클릭 핸들러 개선 (`e.target === e.currentTarget` 체크)
    - `LoginForm.jsx`: 입력 필드에 `autoFocus`, `autoComplete`, `tabIndex` 추가
    - `LoginForm.css`: `pointer-events: auto`, `user-select: text` 명시적 설정
    - `AuthModal.css`: `z-index: 1001` 설정으로 레이어 우선순위 명확화
  - 영향 범위: client/src/components/AuthModal.jsx, LoginForm.jsx, LoginForm.css, AuthModal.css
  - 문서화: docs/bugfixes/login-input-blocking-fix.md

### Security (보안 개선)
- 입력 필드 접근성 개선으로 사용자 경험 및 보안성 향상
- 명시적 `autoComplete` 속성으로 브라우저 자동완성 보안 강화

---

## [0.1.0] - 2025-11-11 (첫 공식 릴리스) 🎉

### Added (추가된 기능)

#### 🖼️ 이미지 처리 엔진
- **Sharp 기반 고성능 이미지 변환** (v0.34+)
  - 입력 포맷: JPG, PNG, GIF, BMP, TIFF, SVG, AVIF, HEIF, HEIC
  - 출력 포맷: WebP, AVIF, JPG, PNG, TIFF, GIF, BMP
- **병렬 처리 시스템** (MAX_CONCURRENT = 4)
  - 최대 4개 파일 동시 변환
  - 약 3.75배 성능 향상
- **배치 처리 기능**
  - 다중 파일 일괄 변환
  - 실시간 진행 상태 추적
- **압축 최적화**
  - 품질 조절 (0-100%)
  - 압축 레벨 조절 (0-9)
  - 빠른 프리셋 (빠른 변환, 균형잡힌, 최고 품질)
- **리사이즈 옵션**
  - 너비/높이 조절
  - 종횡비 자동 유지

#### 🎨 사용자 인터페이스
- **드래그 앤 드롭 영역**
  - 다중 파일 선택 지원
  - 시각적 드래그 피드백
- **설정 패널**
  - 포맷 선택 (WebP, AVIF, JPG, PNG)
  - 품질 및 압축 조절 슬라이더
  - 리사이즈 옵션 입력
  - 빠른 프리셋 버튼
- **진행 상태 추적**
  - 전체 및 개별 파일 진행률
  - 실시간 압축률 표시
  - 처리 시간 측정
- **탭 네비게이션**
  - 이미지 변환 탭
  - 로그 조회 탭
  - 백업 관리 탭
  - 어필리에이트 탭

#### 🔐 인증 시스템
- **Supabase Auth 연동**
  - 이메일 기반 회원가입/로그인
  - 세션 관리 및 상태 추적
  - 비밀번호 재설정 기능
- **기기 인증 시스템**
  - 하드웨어 기반 기기 ID 생성 (SHA-256)
  - 구독 등급별 기기 한도: Free (1대), Basic (2대), Pro (5대)
  - 기기 한도 초과 처리 모달
- **보안 저장소 (SecureStorage)**
  - machine-id 기반 암호화
  - JWT 토큰 암호화 저장
  - 구독 정보 캐싱 (1시간 TTL)

#### 💼 구독 관리
- **3단계 구독 등급**
  - **Free**: WebP만 사용 가능, 5개 배치, 1대 기기
  - **Basic**: WebP/AVIF 사용, 15개 배치, 2대 기기
  - **Pro**: 모든 포맷 사용, 무제한 배치, 5대 기기
- **기능 제한 시스템**
  - 포맷별 접근 제어
  - 배치 크기 검증
  - 만료일 자동 확인
- **업그레이드 안내**
  - 구독 정보 표시
  - 업그레이드 버튼 및 안내

#### 📊 로그 시스템
- **Excel 기반 작업 로그**
  - exceljs 라이브러리 사용
  - 2개 시트: 작업 기록 + 통계
  - 13개 컬럼: 번호, 일시, 파일명, 경로, 크기, 압축률 등
- **LogViewer UI**
  - 날짜 범위 필터링
  - 통계 카드 (총 작업, 성공률, 평균 압축률)
  - Excel 내보내기 버튼
- **자동 로그 기록**
  - 이미지 변환 완료 시 자동 저장
  - 메타데이터 및 통계 업데이트

#### 💾 백업 시스템
- **자동 백업 기능**
  - 변환 전 원본 파일 자동 백업
  - 날짜별 폴더 생성 (backup/YYYY-MM-DD/)
  - SHA-256 해시 기반 파일 무결성 검증
- **BackupViewer UI**
  - 백업 목록 조회 (필터링, 정렬)
  - 파일 복원 버튼
  - 백업 삭제 버튼
  - 통계 카드 (총 백업, 용량, 복원 가능)
- **메타데이터 관리**
  - 백업 정보 JSON 파일
  - 전체 백업 인덱스 (metadata_index.json)
  - 백업 상태: 'active' | 'restored' | 'deleted'

#### 🔗 어필리에이트 시스템
- **추천 코드 생성**
  - 8자 랜덤 코드 자동 생성
  - 추적 링크 생성 및 복사 기능
- **쿠키 추적**
  - 30일 쿠키 유효기간
  - Edge Function: track-referral
- **수수료 관리**
  - 등급별 수수료율: Free (0%), Basic (10%), Pro (15%)
  - Edge Function: process-commission
- **AffiliatePanel UI**
  - 추적 링크 생성 및 복사
  - 통계 조회 (추천 수, 수수료)
  - 추천 내역 테이블

#### 🌐 다국어 지원
- **i18next 통합**
  - 한국어 (ko)
  - 영어 (en)
- **OS 언어 자동 감지**
  - i18next-browser-languagedetector
- **언어 전환 UI**
  - 헤더 언어 전환 버튼
  - 모든 UI 텍스트 번역

#### 🔄 자동 업데이트
- **electron-updater 연동**
  - GitHub Releases 자동 확인
  - 앱 시작 5초 후 자동 업데이트 확인
  - 업데이트 다운로드 및 설치
- **업데이트 이벤트**
  - checking-for-update
  - update-available
  - update-downloaded
  - download-progress
- **개발/프로덕션 분리**
  - 개발 환경: 업데이트 비활성화
  - 프로덕션: 자동 업데이트 활성화

#### 📦 빌드 및 패키징
- **electron-builder 설정**
  - Windows (NSIS 설치 파일)
  - macOS (DMG + ZIP)
  - Linux (AppImage)
- **빌드 스크립트**
  - build:win / build:mac / build:linux
  - publish:win / publish:mac / publish:linux / publish:all
- **GitHub Releases 자동 배포**
  - GitHub Personal Access Token 인증
  - 릴리스 자동 생성
  - 자동 업데이트 메타데이터 (latest.yml)

#### 📚 완전한 문서화
- **Hub-and-Spoke 문서 구조**
  - CLAUDE.md: 중앙 허브 (모든 문서 연결)
  - docs/: 카테고리별 상세 문서
- **27개 이상의 기술 문서**
  - 아키텍처 설계
  - API 명세서
  - 기능별 가이드
  - 개발 가이드
  - 배포 가이드
- **자동화 문서**
  - Git 워크플로우
  - Git 자동화 시스템
  - COMMIT_HISTORY.md (전체 커밋 기록)

### Changed (변경된 기능)
- Electron Main Process를 JavaScript에서 **TypeScript로 마이그레이션**
  - 완전한 타입 안정성 확보
  - IPC 통신 타입 시스템 구축
- Webpack devtool을 `eval-source-map`으로 변경 (HMR 호환성)
- CSP 정책 개발/프로덕션 분리 (보안 강화)

### Fixed (수정된 버그)
- TypeScript 컴파일 에러 완전 해결 (0 errors)
- CSP 정책 위반 오류 제거
- 스크롤 영역 분리 및 overflow 설정 개선
- 병렬 처리 시 null 참조 오류 수정
- **Preload script window 객체 접근 오류 수정** (client/preload.ts:126-127)
  - global.window에서 window 직접 접근으로 변경
  - TypeScript 타입 선언 추가
- **프로덕션 빌드에서 DevTools 자동 열림 문제 수정** (client/main.ts:98)
  - DevTools를 개발 환경에서만 열리도록 조건 추가
  - 프로덕션 빌드 시 DevTools 자동 비활성화

### Security (보안 개선)
- **환경 변수 보안**
  - .env 파일로 민감 정보 분리
  - .gitignore에 .env 추가
  - 하드코딩 완전 제거
- **API 키 보안**
  - Supabase Anon Key만 사용 (Service Key 사용 금지)
  - RLS(Row Level Security) 정책 활성화
- **데이터 암호화**
  - machine-id 기반 암호화 키
  - JWT 토큰 암호화 저장
  - electron-store 암호화 활성화

### Performance (성능 개선)
- **병렬 처리 최적화**
  - 순차 처리 → 병렬 처리 (MAX_CONCURRENT = 4)
  - 약 **3.75배** 속도 향상
- **메모리 최적화**
  - Idle 시: < 500MB
  - 변환 중: < 1GB
- **CPU 사용 최적화**
  - Idle 시: 0-5%
  - 변환 중: 50-70%

### Technical Stack (기술 스택)
- **Frontend**: React 19.2, i18next 25.6
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Desktop**: Electron 39.1, electron-updater 6.6
- **Image Processing**: Sharp 0.34+
- **Build**: Webpack 5.102, electron-builder 26.0
- **Language**: TypeScript 5.9

### Known Issues (알려진 이슈)
- macOS 빌드는 macOS 환경에서만 가능 (크로스 빌드 제한)
- 코드 사이닝은 인증서 구매 후 적용 예정

---

## [Unreleased] (미출시)

### Planned (계획 중)
- 관리자 대시보드 구현 (사용자/수익/어필리에이트 관리)
- 추가 이미지 포맷 지원 (JXL, HEIF)
- 고급 편집 기능 (회전, 자르기, 필터)
- 클라우드 스토리지 연동 (Google Drive, Dropbox)

---

**마지막 업데이트**: 2025-11-11
**작성자**: 더카당
**라이선스**: MIT
