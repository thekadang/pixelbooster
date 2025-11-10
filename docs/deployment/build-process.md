# 빌드 프로세스 가이드

> Electron Builder를 사용한 Windows/macOS/Linux 빌드 및 배포 가이드

**작성일**: 2025-11-10
**버전**: v0.1.0

---

## 📋 목차

1. [빌드 환경 설정](#빌드-환경-설정)
2. [아이콘 생성](#아이콘-생성)
3. [빌드 스크립트](#빌드-스크립트)
4. [플랫폼별 빌드](#플랫폼별-빌드)
5. [코드 사이닝](#코드-사이닝)
6. [배포 전 체크리스트](#배포-전-체크리스트)

---

## 빌드 환경 설정

### 필수 패키지

```json
{
  "dependencies": {
    "electron": "^39.1.1",
    "electron-builder": "^26.0.12"
  }
}
```

### electron-builder 설정 (package.json)

```json
{
  "build": {
    "appId": "com.thekadang.pixelbooster",
    "productName": "픽셀부스터",
    "directories": {
      "buildResources": "build",
      "output": "dist-electron"
    },
    "files": [
      "client/dist/**/*",
      "client/main.js",
      "client/preload.js",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "build/icon.icns",
      "category": "public.app-category.graphics-design"
    },
    "linux": {
      "target": ["AppImage"],
      "icon": "build/icon.png",
      "category": "Graphics"
    }
  }
}
```

---

## 아이콘 생성

### 아이콘 요구사항

| 플랫폼 | 파일 | 크기 | 포맷 |
|--------|------|------|------|
| Windows | icon.ico | 256x256 | ICO |
| macOS | icon.icns | 512x512 | ICNS |
| Linux | icon.png | 512x512 | PNG |

### 아이콘 생성 방법

#### 1. PNG 마스터 이미지 준비 (1024x1024)

```bash
# 1024x1024 PNG 파일 준비
# 투명 배경 권장
# 파일명: icon-master.png
```

#### 2. 온라인 도구 사용

**CloudConvert** (추천):
- https://cloudconvert.com/png-to-ico
- https://cloudconvert.com/png-to-icns

**IconVertical** (무료):
- https://iconverticons.com/online/

#### 3. 로컬 도구 사용

**Windows (ImageMagick)**:
```bash
# ICO 생성
magick convert icon-master.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico

# PNG 리사이즈
magick convert icon-master.png -resize 512x512 build/icon.png
```

**macOS (iconutil)**:
```bash
# ICNS 생성 (iconutil 사용)
mkdir icon.iconset
sips -z 16 16     icon-master.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-master.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-master.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-master.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-master.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-master.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-master.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-master.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-master.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon-master.png --out icon.iconset/icon_512x512@2x.png

iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
```

#### 4. 임시 아이콘 (개발용)

```bash
# 단색 PNG 생성 (ImageMagick)
magick -size 512x512 xc:#667eea -gravity center \
  -pointsize 180 -fill white -annotate +0+0 "PB" \
  build/icon.png

# ICO 변환
magick convert build/icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

---

## 빌드 스크립트

### package.json 스크립트

```json
{
  "scripts": {
    "compile:main": "tsc -p tsconfig.main.json",
    "build": "npm run compile:main && webpack --mode production",
    "build:electron": "npm run build && electron-builder",
    "build:win": "npm run build && electron-builder --win",
    "build:mac": "npm run build && electron-builder --mac",
    "build:linux": "npm run build && electron-builder --linux",
    "build:all": "npm run build && electron-builder --win --mac --linux"
  }
}
```

### 빌드 실행

```bash
# 전체 빌드 (TypeScript + Webpack + Electron Builder)
npm run build:electron

# Windows 빌드
npm run build:win

# macOS 빌드
npm run build:mac

# Linux 빌드
npm run build:linux

# 모든 플랫폼 빌드
npm run build:all
```

---

## 플랫폼별 빌드

### Windows (NSIS)

#### 빌드 설정

```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.ico",
      "artifactName": "${productName}-Setup-${version}.${ext}",
      "publisherName": "더카당"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "픽셀부스터",
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "deleteAppDataOnUninstall": false
    }
  }
}
```

#### 빌드 실행

```bash
npm run build:win
```

#### 출력 파일

```
dist-electron/
├── 픽셀부스터-Setup-0.1.0.exe      # 설치 파일 (x64)
├── 픽셀부스터-Setup-0.1.0-arm64.exe # 설치 파일 (arm64)
└── latest.yml                       # 자동 업데이트 메타데이터
```

---

### macOS (DMG)

#### 빌드 설정

```json
{
  "build": {
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.icns",
      "category": "public.app-category.graphics-design",
      "artifactName": "${productName}-${version}-${arch}.${ext}",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "dmg": {
      "title": "${productName} ${version}",
      "icon": "build/icon.icns",
      "background": "build/dmg-background.png",
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ]
    }
  }
}
```

#### 빌드 실행

```bash
npm run build:mac
```

#### 출력 파일

```
dist-electron/
├── 픽셀부스터-0.1.0-x64.dmg         # Intel Mac
├── 픽셀부스터-0.1.0-arm64.dmg       # Apple Silicon
└── latest-mac.yml                   # 자동 업데이트 메타데이터
```

---

### Linux (AppImage)

#### 빌드 설정

```json
{
  "build": {
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.png",
      "category": "Graphics",
      "artifactName": "${productName}-${version}-${arch}.${ext}",
      "desktop": {
        "Name": "픽셀부스터",
        "Comment": "이미지 최적화 도구",
        "Categories": "Graphics;Photography;",
        "Keywords": "image;optimization;webp;avif;"
      }
    },
    "appImage": {
      "artifactName": "${productName}-${version}-${arch}.${ext}"
    }
  }
}
```

#### 빌드 실행

```bash
npm run build:linux
```

#### 출력 파일

```
dist-electron/
├── 픽셀부스터-0.1.0-x64.AppImage     # x64
├── 픽셀부스터-0.1.0-arm64.AppImage   # arm64
└── latest-linux.yml                  # 자동 업데이트 메타데이터
```

---

## 코드 사이닝

### Windows (Authenticode)

#### 인증서 준비

```bash
# .pfx 인증서 파일 준비
# 환경 변수 설정
export CSC_LINK="/path/to/certificate.pfx"
export CSC_KEY_PASSWORD="your-password"
```

#### package.json 설정

```json
{
  "build": {
    "win": {
      "certificateFile": "certs/certificate.pfx",
      "certificatePassword": "${env.CSC_KEY_PASSWORD}",
      "signingHashAlgorithms": ["sha256"],
      "signDlls": true
    }
  }
}
```

### macOS (Apple Developer)

#### 인증서 준비

```bash
# Apple Developer 계정 필요
# Developer ID Application 인증서 설치

# 환경 변수 설정
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

#### package.json 설정

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

#### entitlements.mac.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
</dict>
</plist>
```

#### notarize.js (macOS Notarization)

```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    tool: 'notarytool',
    appBundleId: 'com.thekadang.pixelbooster',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  });
};
```

---

## 배포 전 체크리스트

### 빌드 준비

- [ ] `package.json` 버전 업데이트
- [ ] `CHANGELOG.md` 작성
- [ ] 환경 변수 설정 확인 (`.env` 파일)
- [ ] 아이콘 파일 준비 (icon.ico, icon.icns, icon.png)
- [ ] 코드 사이닝 인증서 준비 (프로덕션)

### 빌드 검증

- [ ] TypeScript 컴파일 성공
- [ ] Webpack 빌드 성공
- [ ] Electron Builder 빌드 성공
- [ ] 설치 파일 실행 테스트
- [ ] 자동 업데이트 메타데이터 생성 확인

### 기능 테스트

- [ ] 로그인/회원가입
- [ ] 기기 인증
- [ ] 이미지 변환 (WebP, AVIF)
- [ ] 백업 시스템
- [ ] 로그 시스템
- [ ] 어필리에이트 기능
- [ ] 다국어 전환

### 보안 체크

- [ ] 민감한 정보 하드코딩 제거
- [ ] `.env` 파일 `.gitignore` 포함 확인
- [ ] Supabase 키 보안 확인
- [ ] API 엔드포인트 보안 확인

### 문서 업데이트

- [ ] README.md 최신화
- [ ] 사용자 가이드 작성
- [ ] 릴리스 노트 작성
- [ ] task.md 최종 업데이트

---

## 빌드 문제 해결

### 일반적인 오류

#### 1. "Icon file not found"

```bash
# 해결: 아이콘 파일 존재 확인
ls -la build/icon.*

# 아이콘 생성 (임시)
mkdir -p build
# (아이콘 생성 방법은 위 섹션 참고)
```

#### 2. "Cannot find module 'sharp'"

```bash
# 해결: sharp 재설치
npm rebuild sharp --force

# 또는
rm -rf node_modules
npm install
```

#### 3. "App not signed properly"

```bash
# 해결: 코드 사이닝 설정 확인
# Windows: CSC_LINK, CSC_KEY_PASSWORD 환경 변수
# macOS: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
```

#### 4. "Build failed: out of memory"

```bash
# 해결: Node.js 메모리 증가
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build:electron
```

---

## CI/CD 자동화

### GitHub Actions (예시)

```yaml
# .github/workflows/build.yml

name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build (Windows)
        if: matrix.os == 'windows-latest'
        run: npm run build:win

      - name: Build (macOS)
        if: matrix.os == 'macos-latest'
        run: npm run build:mac
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - name: Build (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist-${{ matrix.os }}
          path: dist-electron/
```

---

## 참고 문서

- [Electron Builder 공식 문서](https://www.electron.build/)
- [코드 사이닝 가이드](https://www.electron.build/code-signing)
- [macOS Notarization](https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/)
- [Windows 인증서 가이드](https://www.electronjs.org/docs/latest/tutorial/code-signing)

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
