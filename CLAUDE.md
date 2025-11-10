# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 더카당 픽셀부스터 - 개발 가이드 (Hub)

이 문서는 픽셀부스터 프로젝트의 중앙 허브로서, 모든 설계 문서와 개발 가이드를 연결합니다.

---

## 🚀 빠른 시작 (새 세션 시작 시)

### 1단계: 프로젝트 상태 파악
```
1. COMMIT_HISTORY.md 확인 - 최근 커밋 및 작업 이력
2. task.md 확인 - 현재 진행 단계 (Phase 5 완료! 100% 완료 🎉)
3. 다음 작업: 통합 테스트 및 배포 준비 완료 ✅
```

### 2단계: 개발 명령어
```bash
# Git 자동 커밋 (Claude Code에게 말하기)
"커밋해줘" 또는 "변경사항 저장해줘"

# 롤백
"<commit-hash>로 롤백해줘"

# 커밋 히스토리 확인
"COMMIT_HISTORY.md 열어줘"
```

### 3단계: 프로젝트 구조 이해
```
client/   - Electron 데스크톱 앱 (이미지 처리 로직)
server/   - Supabase Edge Functions (인증, 구독 관리)
admin/    - 관리자 대시보드 (사용자/수익 관리)
shared/   - 공통 타입 및 유틸리티
docs/     - 전체 기술 문서
```

---

## 📌 핵심 원칙 (항상 준수)

1. **One Source of Truth** - 중복 금지, 모든 정보는 단일 출처
2. **Single Responsibility** - 함수/클래스는 하나의 책임만
3. **No Hard-coding** - 설정은 별도 파일로 관리
4. **Error Handling** - 모든 에러는 명확한 메시지와 함께 처리
5. **기존 패턴 유지** - 프로젝트의 코딩 스타일 분석 후 동일하게 작성
6. **한글화** - 모든 산출물(md 파일, 코드 주석 등)은 한글화를 기본 원칙으로 합니다. (단, 코드의 함수명, 변수명 등은 영어로 작성합니다.)

---

## 📋 프로젝트 상태

- **[진행 상황 및 작업 계획](task.md)** - 현재 작업 및 다음 단계 확인

---

## 🏗️ 아키텍처 문서

### 시스템 설계
- **[전체 시스템 구조](docs/architecture/system-overview.md)** - 프로젝트 전체 구조 및 모듈 관계
- **[데이터베이스 설계](docs/architecture/database-schema.md)** - Supabase PostgreSQL 스키마 및 RLS 정책
- **[보안 아키텍처](docs/architecture/security-architecture.md)** - 인증, 기기 등록, 어뷰징 방지

### API 명세
- **[API 명세서](docs/api/api-specification.md)** - Supabase Edge Functions 및 클라이언트 API
- **[인증 API](docs/api/auth-api.md)** - 로그인, 회원가입, 기기 인증
- **[구독 API](docs/api/subscription-api.md)** - 구독 등급 확인 및 관리

---

## 🎨 클라이언트 (데스크톱 앱)

### 기능 문서
- **[이미지 처리 로직](docs/features/image-processing.md)** - Sharp 기반 변환 로직 및 병렬 배치 처리 ✅
- **[UI/UX 가이드](docs/features/ui-ux-guide.md)** - 디자인 원칙 및 컴포넌트 구조
- **[구독 등급별 기능](docs/features/subscription-tiers.md)** - Free/Basic/Pro 기능 차이 및 구현
- **[로그 시스템](docs/features/log-system.md)** - Excel 기반 작업 로그 관리 ✅
- **[백업 시스템](docs/features/backup-system.md)** - 원본 파일 백업 및 복원 ✅
- **[어필리에이트 시스템](docs/features/affiliate-system.md)** - 추천 코드, 쿠키 추적, 수수료 관리 ✅
- **[관리자 대시보드](docs/features/admin-dashboard.md)** - 사용자/수익/어필리에이트 관리 (설계 완료)
- **[다국어 지원](docs/features/i18n-system.md)** - i18next 기반 다국어 구현 (대기)

---

## 🔧 개발 가이드

### 환경 설정
- **[개발 환경 설정](docs/development/setup.md)** - 로컬 개발 환경 구축 가이드
- **[코딩 컨벤션](docs/development/conventions.md)** - 명명 규칙, 코드 스타일, 타입 정의
- **[Git 워크플로우](docs/development/git-workflow.md)** - 브랜치 전략, 커밋 규칙, 롤백 방법
- **[Git 자동화 시스템](docs/development/git-automation.md)** - 자동 커밋/푸시, 롤백 기능
- **[커밋 히스토리](COMMIT_HISTORY.md)** - 전체 커밋 기록 및 롤백 가이드

### 핵심 컴포넌트
- **[ImageProcessor](docs/development/image-processor.md)** - 이미지 변환 엔진
- **[SubscriptionManager](docs/development/subscription-manager.md)** - 구독 등급 관리
- **[DeviceManager](docs/development/device-manager.md)** - 기기 인증 및 등록
- **[LogManager](docs/development/log-manager.md)** - Excel 로그 생성
- **[BackupManager](docs/development/backup-manager.md)** - 파일 백업 처리

---

## 🌐 서버 (Supabase)

### 서버 구성
- **[Supabase 설정](docs/development/supabase-setup.md)** - 프로젝트 생성 및 초기 설정
- **[Edge Functions](docs/development/edge-functions.md)** - 서버리스 함수 개발 가이드
- **[데이터베이스 마이그레이션](docs/development/migrations.md)** - 스키마 변경 관리

---

## 💰 비즈니스 로직

### 구독 시스템
- **[구독 관리](docs/features/subscription-management.md)** - Freemium 모델 구현
- **[결제 연동](docs/features/payment-integration.md)** - 결제 시스템 통합 계획

### 어필리에이트
- **[어필리에이트 시스템](docs/features/affiliate-system.md)** - 추천 코드, 쿠키 추적, 수수료 관리

---

## 👨‍💼 관리자 대시보드

- **[관리자 대시보드](docs/features/admin-dashboard.md)** - 사용자 관리, 수익 관리, 권한 설정

---

## 📦 배포

### 빌드 및 패키징
- **[빌드 프로세스](docs/deployment/build-process.md)** - Windows/Mac 빌드 및 패키징 ✅
- **[자동 업데이트](docs/deployment/auto-update.md)** - electron-updater 연동 ✅

### 테스트 및 배포
- **[통합 테스트 가이드](docs/development/testing-guide.md)** - 전체 기능 테스트 시나리오 ✅
- **[배포 전 체크리스트](docs/deployment/deployment-checklist.md)** - 프로덕션 배포 검증 체크리스트 ✅
- **[베타 테스트 가이드](docs/deployment/beta-testing-guide.md)** - 베타 테스터 모집 및 피드백 수집 ✅
- **[GitHub Release 가이드](docs/deployment/github-release-guide.md)** - GitHub Releases 배포 및 자동 업데이트 ✅

---

## 📚 참고 문서

- **[기획서](기획서.md)** - 프로젝트 요구사항 및 비즈니스 모델
- **[기술적 계획](기술적계획.md)** - 기술 스택 선정 및 확장성 계획

---

## 🚀 빠른 시작

### 1단계: 문서 확인
프로젝트에 처음 합류했다면 다음 순서로 문서를 읽으세요:
1. [전체 시스템 구조](docs/architecture/system-overview.md)
2. [개발 환경 설정](docs/development/setup.md)
3. [코딩 컨벤션](docs/development/conventions.md)

### 2단계: 현재 작업 확인
[task.md](task.md)에서 현재 진행 중인 작업과 다음 단계를 확인하세요.

### 3단계: 기능별 문서 참고
개발할 기능에 해당하는 문서를 찾아 상세 구현 가이드를 따르세요.

---

## 🔄 문서 업데이트 규칙

1. **새 기능 추가 시**: 해당하는 spoke 문서를 먼저 작성하고 이 허브에 링크 추가
2. **구현 완료 시**: task.md 업데이트 및 Git 커밋
3. **구조 변경 시**: 관련된 모든 문서를 동시에 업데이트하여 일관성 유지

---

## 📞 도움말

- **문서 위치를 모를 때**: 이 파일(CLAUDE.md)에서 Ctrl+F로 검색
- **새로운 문서 추가 시**: 적절한 카테고리 폴더에 생성 후 이 허브에 링크 추가
- **문서 간 불일치 발견 시**: 즉시 수정하고 다른 개발자에게 알림

---

**마지막 업데이트**: 2025-11-10
**프로젝트 버전**: v0.1.0 (초기 구축 단계)
