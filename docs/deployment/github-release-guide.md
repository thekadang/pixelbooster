# GitHub Release 배포 가이드

> GitHub Releases를 사용한 자동 업데이트 및 배포 가이드

**작성일**: 2025-11-10
**버전**: v0.1.0
**대상**: 프로덕션 및 베타 릴리스

---

## 📋 목차

1. [GitHub Release 개요](#github-release-개요)
2. [배포 준비](#배포-준비)
3. [베타 릴리스](#베타-릴리스)
4. [정식 릴리스](#정식-릴리스)
5. [자동 업데이트 검증](#자동-업데이트-검증)
6. [문제 해결](#문제-해결)

---

## GitHub Release 개요

### electron-updater + GitHub Releases 통합

**자동 업데이트 흐름**:
```
1. 앱 시작 → autoUpdater.checkForUpdates()
2. GitHub Release API 호출
3. latest.yml 다운로드
4. 버전 비교 (현재 vs 최신)
5. 업데이트 있음 → 사용자 알림
6. 다운로드 → 설치 → 재시작
```

### package.json 설정 확인

```json
{
  "name": "pixelbooster",
  "version": "0.1.0",
  "description": "이미지 최적화 도구",
  "author": "thekadang",
  "repository": {
    "type": "git",
    "url": "https://github.com/thekadang/pixelbooster.git"
  },
  "build": {
    "appId": "com.thekadang.pixelbooster",
    "productName": "픽셀부스터",
    "publish": {
      "provider": "github",
      "owner": "thekadang",
      "repo": "pixelbooster"
    }
  }
}
```

### GitHub Token 설정

#### 1. GitHub Personal Access Token 생성
1. **GitHub 설정 이동**:
   - https://github.com/settings/tokens
2. **Generate new token (classic) 클릭**
3. **권한 설정**:
   - `repo` (전체 권한) ✅
   - `write:packages` ✅
4. **Generate token 클릭**
5. **토큰 복사** (한 번만 표시됨!)

#### 2. 환경 변수 설정

**Windows (PowerShell)**:
```powershell
# 현재 세션
$env:GH_TOKEN = "ghp_XXXXXXXXXX..."

# 영구 설정 (시스템 환경 변수)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_XXXXXXXXXX...', 'User')
```

**Windows (CMD)**:
```cmd
set GH_TOKEN=ghp_XXXXXXXXXX...
```

#### 3. .env 파일에 추가 (선택 사항)
```bash
# .env
GH_TOKEN=ghp_XXXXXXXXXX...
```

**⚠️ 주의**: `.env` 파일은 절대 Git에 커밋하지 마세요!

---

## 배포 준비

### 1. 버전 업데이트

#### package.json 버전 변경
```json
{
  "version": "0.1.0"  // 또는 "0.1.0-beta.1"
}
```

#### CHANGELOG.md 작성
```markdown
# Changelog

## [0.1.0] - 2025-11-10

### Added
- 이미지 변환 기능 (WebP, AVIF, JPG, PNG)
- 인증 시스템 (로그인, 회원가입, 기기 인증)
- 백업 및 복원 시스템
- 로그 시스템 (Excel 기반)
- 어필리에이트 시스템
- 다국어 지원 (한국어, 영어)
- 자동 업데이트 시스템

### Fixed
- 초기 릴리스

### Changed
- N/A

### Removed
- N/A
```

### 2. Git 커밋 및 태그

```bash
# 변경사항 확인
git status

# 변경사항 커밋
git add .
git commit -m "chore: prepare for v0.1.0 release"

# Git 태그 생성
git tag v0.1.0

# 또는 베타 버전
git tag v0.1.0-beta.1

# 태그 확인
git tag -l

# 원격 저장소에 푸시
git push origin main
git push origin v0.1.0
```

### 3. 빌드 실행

```bash
# TypeScript 컴파일
npm run compile:main

# Webpack 빌드
npm run build

# Electron Builder 빌드
npm run build:win
```

#### 빌드 결과물 확인
```bash
cd dist-electron

# 예상 파일:
# - 픽셀부스터 Setup 0.1.0.exe (설치 파일)
# - 픽셀부스터 Setup 0.1.0.exe.blockmap
# - latest.yml (자동 업데이트 메타데이터)
# - win-unpacked/ (압축 해제된 실행 파일)
```

#### latest.yml 내용 확인
```yaml
version: 0.1.0
files:
  - url: 픽셀부스터 Setup 0.1.0.exe
    sha512: [SHA-512 해시]
    size: [파일 크기 바이트]
path: 픽셀부스터 Setup 0.1.0.exe
sha512: [SHA-512 해시]
releaseDate: '2025-11-10T...'
```

---

## 베타 릴리스

### 1. Pre-release 생성

#### GitHub Release 페이지 이동
1. https://github.com/thekadang/pixelbooster/releases
2. **Draft a new release** 클릭

#### 릴리스 정보 입력

**Tag**: `v0.1.0-beta.1`
- Choose a tag: v0.1.0-beta.1
- Target: main

**Title**: `픽셀부스터 v0.1.0 Beta 1`

**Description**:
```markdown
# 픽셀부스터 v0.1.0 Beta 1 🚀

## ⚠️ 베타 버전 안내
이 버전은 베타 테스트용입니다. 프로덕션 환경에서 사용하지 마세요.

## 🎯 테스트 목표
- 설치 및 첫 실행 검증
- 인증 시스템 검증 (로그인, 회원가입, 기기 인증)
- 이미지 변환 기능 검증 (WebP, AVIF, JPG, PNG)
- 백업 및 로그 시스템 검증
- 다국어 전환 검증

## 📥 다운로드
Windows 사용자는 아래 설치 파일을 다운로드하세요:
- **픽셀부스터 Setup 0.1.0-beta.1.exe** (Windows 10/11 64-bit)

## ✨ 주요 기능
- **이미지 변환**: WebP, AVIF, JPG, PNG 변환 지원
- **병렬 처리**: 최대 4개 파일 동시 처리
- **백업 시스템**: 원본 파일 자동 백업 및 복원
- **로그 시스템**: Excel 기반 작업 로그 관리
- **다국어 지원**: 한국어, 영어 지원
- **자동 업데이트**: GitHub Releases 기반 자동 업데이트

## 📝 피드백 제공
버그 및 개선 제안은 아래 채널로 제공해주세요:
- **GitHub Issues**: https://github.com/thekadang/pixelbooster/issues
- **이메일**: thekadang@example.com

## 🐛 버그 리포트
버그를 발견하셨다면 [버그 리포트 템플릿](링크)을 사용해주세요.

## 🎁 베타 테스터 혜택
- Pro 플랜 1개월 무료
- 정식 버전 출시 시 Pro 플랜 50% 할인
- 베타 테스터 배지

## 📅 테스트 기간
- 시작일: 2025-11-10
- 종료일: 2025-11-17 (7일)

## 📚 문서
- [베타 테스트 가이드](링크)
- [사용자 가이드](링크)

---

**릴리스 날짜**: 2025-11-10
**버전**: v0.1.0-beta.1
**대상**: 베타 테스터 (10-20명)
```

#### 파일 업로드
1. **Attach binaries** 클릭
2. 다음 파일들을 드래그 앤 드롭:
   - `픽셀부스터 Setup 0.1.0-beta.1.exe`
   - `latest.yml`

#### Pre-release 설정
- **Set as a pre-release** ✅ 체크
- **Set as the latest release** ❌ 체크 해제

#### 릴리스 발행
- **Publish release** 클릭

### 2. 베타 테스터 초대

#### 이메일 발송
```markdown
제목: 픽셀부스터 v0.1.0 베타 테스트 초대

안녕하세요, [테스터 이름]님!

픽셀부스터 베타 테스트에 참여해주셔서 감사합니다.

## 📥 다운로드
아래 링크에서 베타 버전을 다운로드하실 수 있습니다:
https://github.com/thekadang/pixelbooster/releases/tag/v0.1.0-beta.1

## 📋 테스트 가이드
베타 테스트 가이드 문서를 참고해주세요:
- [베타 테스트 가이드](링크)

감사합니다!
```

---

## 정식 릴리스

### 1. Release 생성

#### GitHub Release 페이지 이동
1. https://github.com/thekadang/pixelbooster/releases
2. **Draft a new release** 클릭

#### 릴리스 정보 입력

**Tag**: `v0.1.0`
- Choose a tag: v0.1.0
- Target: main

**Title**: `픽셀부스터 v0.1.0 - 첫 정식 릴리스 🎉`

**Description**:
```markdown
# 픽셀부스터 v0.1.0 - 첫 정식 릴리스 🎉

픽셀부스터의 첫 정식 버전을 공개합니다!

## 📥 다운로드
Windows 사용자는 아래 설치 파일을 다운로드하세요:
- **픽셀부스터 Setup 0.1.0.exe** (Windows 10/11 64-bit)

설치 방법:
1. 설치 파일 다운로드
2. 더블 클릭으로 설치 시작
3. 설치 경로 선택 (기본 경로 권장)
4. 설치 완료 후 앱 실행

## ✨ 주요 기능

### 🖼️ 이미지 변환
- **지원 입력 포맷**: JPG, PNG, GIF, BMP, TIFF, SVG, HEIF, HEIC
- **지원 출력 포맷**: WebP, AVIF, JPG, PNG, TIFF, GIF, BMP
- **병렬 처리**: 최대 4개 파일 동시 처리
- **빠른 프리셋**: 빠른 변환, 균형잡힌, 최고 품질

### 💾 백업 시스템
- 원본 파일 자동 백업
- SHA-256 해시 기반 무결성 검증
- 날짜별 백업 폴더 관리
- 원클릭 복원 기능

### 📊 로그 시스템
- Excel 기반 작업 로그 자동 생성
- 작업 기록 시트 (13개 컬럼)
- 통계 시트 (총 파일 수, 성공률, 압축률 등)
- 날짜 범위 필터링 및 정렬

### 🔐 인증 시스템
- 이메일 기반 로그인 및 회원가입
- 기기 인증 시스템 (SHA-256 해시)
- 등급별 기기 한도 관리 (Free: 1대, Basic: 2대, Pro: 5대)

### 💰 어필리에이트 시스템
- 추적 링크 생성 (8자 랜덤 코드)
- 쿠키 기반 추천 연결 (3일 유효)
- 수수료 계산 및 수익 통계

### 🌐 다국어 지원
- 한국어, 영어 지원
- OS 언어 자동 감지
- 언어 전환 UI

### 🔄 자동 업데이트
- GitHub Releases 기반 자동 업데이트
- 백그라운드 다운로드
- 재시작 시 자동 설치

## 🚀 성능
- **처리 속도**: 1MB 이미지 기준 1-3초 이내
- **압축률**: WebP 30-50%, AVIF 40-60%
- **메모리 사용**: Idle 500MB 이하, 변환 중 1GB 이하
- **CPU 사용**: Idle 5% 이하, 변환 중 50-70%

## 📦 구독 플랜

### Free (무료)
- WebP 변환만 지원
- 배치 크기: 5개
- 기기 한도: 1대

### Basic ($9.99/월)
- WebP, AVIF 변환 지원
- 배치 크기: 15개
- 기기 한도: 2대
- 우선 지원

### Pro ($19.99/월)
- 모든 포맷 변환 지원
- 무제한 배치
- 기기 한도: 5대
- 우선 지원
- 베타 테스트 우선 참여

## 🎯 시스템 요구사항
- **OS**: Windows 10/11 (64-bit)
- **메모리**: 최소 4GB RAM (권장 8GB)
- **디스크**: 500MB 여유 공간
- **인터넷**: 인증 및 자동 업데이트를 위한 안정적인 연결

## 📚 문서
- [사용자 가이드](링크)
- [FAQ](링크)
- [GitHub 저장소](https://github.com/thekadang/pixelbooster)

## 🐛 버그 리포트
버그를 발견하셨다면 GitHub Issues로 제보해주세요:
- https://github.com/thekadang/pixelbooster/issues

## 💬 피드백
여러분의 피드백은 픽셀부스터를 더 좋은 도구로 만드는 데 도움이 됩니다:
- GitHub Issues: https://github.com/thekadang/pixelbooster/issues
- 이메일: thekadang@example.com

## 🙏 감사의 말
베타 테스트에 참여해주신 모든 분들께 감사드립니다!

---

**릴리스 날짜**: 2025-11-10
**버전**: v0.1.0
**라이선스**: MIT
```

#### 파일 업로드
1. **Attach binaries** 클릭
2. 다음 파일들을 드래그 앤 드롭:
   - `픽셀부스터 Setup 0.1.0.exe`
   - `latest.yml`

#### Release 설정
- **Set as a pre-release** ❌ 체크 해제
- **Set as the latest release** ✅ 체크

#### 릴리스 발행
- **Publish release** 클릭

### 2. 릴리스 공지

#### SNS 공지 템플릿
```markdown
🎉 픽셀부스터 v0.1.0 정식 출시! 🚀

이미지 최적화를 더 쉽고 빠르게! 픽셀부스터의 첫 정식 버전을 공개합니다.

✨ 주요 기능:
• 다양한 포맷 변환 (WebP, AVIF, JPG, PNG 등)
• 병렬 처리 (최대 4개 동시)
• 자동 백업 및 로그 관리
• 다국어 지원 (한국어, 영어)

📥 다운로드: https://github.com/thekadang/pixelbooster/releases/tag/v0.1.0

#pixelbooster #image #optimization #webp #avif
```

---

## 자동 업데이트 검증

### 1. 자동 업데이트 흐름 확인

#### main.ts autoUpdater 로직
```typescript
// client/main.ts

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'thekadang',
  repo: 'pixelbooster'
});

// 앱 시작 5초 후 자동 업데이트 확인
setTimeout(() => {
  autoUpdater.checkForUpdates();
}, 5000);
```

### 2. 업데이트 테스트 시나리오

#### 시나리오 1: 이전 버전 → 최신 버전
```
1. v0.0.9 설치
2. 앱 실행
3. 5초 후 자동 업데이트 확인
4. "업데이트 가능" 알림 표시
5. 다운로드 버튼 클릭
6. 진행 상태 표시
7. 다운로드 완료 알림
8. 앱 종료
9. 백그라운드 자동 설치
10. 재시작 후 v0.1.0 확인
```

#### 시나리오 2: 최신 버전 (업데이트 없음)
```
1. v0.1.0 실행
2. 5초 후 자동 업데이트 확인
3. "최신 버전입니다" 메시지 (개발 모드에서는 로그만)
```

### 3. latest.yml 검증

#### GitHub Release에서 latest.yml 다운로드
```bash
# 다운로드 URL
https://github.com/thekadang/pixelbooster/releases/download/v0.1.0/latest.yml

# 내용 확인
curl -L https://github.com/thekadang/pixelbooster/releases/download/v0.1.0/latest.yml
```

#### 예상 내용
```yaml
version: 0.1.0
files:
  - url: 픽셀부스터 Setup 0.1.0.exe
    sha512: [SHA-512 해시]
    size: [파일 크기]
path: 픽셀부스터 Setup 0.1.0.exe
sha512: [SHA-512 해시]
releaseDate: '2025-11-10T...'
```

### 4. 자동 업데이트 로그 확인

#### main.ts 로그 출력
```typescript
autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version);
});

autoUpdater.on('update-not-available', () => {
  console.log('[AutoUpdater] Update not available');
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[AutoUpdater] Download: ${progressObj.percent}%`);
});

autoUpdater.on('update-downloaded', () => {
  console.log('[AutoUpdater] Update downloaded');
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err);
});
```

#### 로그 확인 방법
```bash
# Windows
# Electron DevTools Console 확인

# 또는 로그 파일
%APPDATA%\pixelbooster\logs\main.log
```

---

## 문제 해결

### 1. "GitHub Token not found" 에러

**문제**: GH_TOKEN 환경 변수 미설정

**해결**:
```bash
# PowerShell
$env:GH_TOKEN = "ghp_XXXXXXXXXX..."

# 또는 시스템 환경 변수 설정
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_XXXXXXXXXX...', 'User')

# 터미널 재시작 후 확인
echo $env:GH_TOKEN
```

### 2. "Cannot publish: repository not found" 에러

**문제**: package.json에 repository 정보 누락

**해결**:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/thekadang/pixelbooster.git"
  }
}
```

### 3. "latest.yml not found" 에러

**문제**: GitHub Release에 latest.yml 파일 업로드 누락

**해결**:
1. GitHub Release 페이지 이동
2. Edit release 클릭
3. latest.yml 파일 업로드
4. Update release 클릭

### 4. 자동 업데이트가 작동하지 않음

**원인 1**: 개발 환경에서 실행
```typescript
// main.ts
if (process.env.NODE_ENV === 'development') {
  console.log('[AutoUpdater] Disabled in development mode');
  return;
}
```

**해결**: 프로덕션 빌드 실행
```bash
npm run build:win
# dist-electron/win-unpacked/픽셀부스터.exe 실행
```

**원인 2**: 네트워크 문제
- GitHub Release URL 접근 확인
- 방화벽 설정 확인
- 프록시 설정 확인

**원인 3**: 버전 비교 실패
```bash
# package.json 버전 확인
"version": "0.1.0"

# latest.yml 버전 확인
version: 0.1.0

# 버전 형식 일치 확인 (semantic versioning)
```

### 5. 다운로드 후 설치 실패

**원인**: 관리자 권한 부족

**해결**:
1. 앱을 완전히 종료
2. 관리자 권한으로 재시작
3. 업데이트 재시도

---

## GitHub Actions 자동화 (선택 사항)

### 1. GitHub Actions 워크플로우

#### .github/workflows/release.yml
```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build TypeScript
        run: npm run compile:main

      - name: Build Webpack
        run: npm run build

      - name: Build Electron (Windows)
        run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: dist-electron/*.exe

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist-electron/픽셀부스터 Setup *.exe
            dist-electron/latest.yml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. GitHub Secrets 설정

1. **GitHub 저장소 이동**
2. **Settings → Secrets and variables → Actions**
3. **New repository secret 클릭**
4. **Name**: `GH_TOKEN`
5. **Value**: GitHub Personal Access Token
6. **Add secret 클릭**

### 3. 자동 배포 실행

```bash
# 태그 생성 및 푸시
git tag v0.1.0
git push origin v0.1.0

# GitHub Actions 자동 실행
# - 빌드
# - Release 생성
# - 파일 업로드
```

---

## 체크리스트

### 배포 전
- [ ] package.json 버전 업데이트
- [ ] CHANGELOG.md 작성
- [ ] Git 커밋 및 태그 생성
- [ ] 빌드 실행 (TypeScript, Webpack, Electron Builder)
- [ ] 빌드 결과물 확인 (exe, latest.yml)
- [ ] GitHub Token 환경 변수 설정

### 베타 릴리스
- [ ] GitHub Release 생성 (Pre-release)
- [ ] 릴리스 정보 입력 (제목, 설명)
- [ ] 빌드 파일 업로드 (exe, latest.yml)
- [ ] Pre-release 체크
- [ ] Publish release 클릭
- [ ] 베타 테스터 초대 이메일 발송

### 정식 릴리스
- [ ] GitHub Release 생성 (Latest release)
- [ ] 릴리스 정보 입력 (제목, 설명)
- [ ] 빌드 파일 업로드 (exe, latest.yml)
- [ ] Latest release 체크
- [ ] Publish release 클릭
- [ ] SNS 공지

### 배포 후
- [ ] 다운로드 테스트
- [ ] 설치 테스트
- [ ] 자동 업데이트 테스트
- [ ] latest.yml 확인
- [ ] 사용자 피드백 수집

---

## 다음 단계

### v0.1.1 패치 릴리스
- Critical/High 버그 수정
- 동일한 프로세스로 릴리스

### v0.2.0 마이너 릴리스
- 새로운 기능 추가
- 베타 테스트 → 정식 릴리스

### v1.0.0 메이저 릴리스
- 안정성 검증 완료
- 프로덕션 준비 완료

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**참고 문서**:
- [베타 테스트 가이드](beta-testing-guide.md)
- [배포 전 체크리스트](deployment-checklist.md)
- [자동 업데이트 가이드](auto-update.md)
- [빌드 프로세스](build-process.md)
