# 자동 업데이트 시스템

electron-updater를 활용한 자동 업데이트 시스템 구현 가이드

---

## 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [설치 및 설정](#설치-및-설정)
4. [업데이트 전략](#업데이트-전략)
5. [구현 가이드](#구현-가이드)
6. [GitHub Releases 연동](#github-releases-연동)
7. [업데이트 UI](#업데이트-ui)
8. [테스팅](#테스팅)
9. [문제 해결](#문제-해결)

---

## 개요

### 목적
- 사용자에게 자동으로 최신 버전 제공
- 수동 다운로드/설치 없이 원클릭 업데이트
- 버그 수정 및 기능 개선의 빠른 배포

### 주요 기능
- **자동 업데이트 확인**: 앱 시작 시 자동으로 새 버전 확인
- **백그라운드 다운로드**: 사용자 작업 방해 없이 다운로드
- **원클릭 설치**: 다운로드 완료 후 즉시 설치 가능
- **변경 사항 표시**: 릴리스 노트 UI 제공
- **롤백 지원**: 문제 발생 시 이전 버전 복구

### 지원 플랫폼
- **Windows**: NSIS 설치 파일 (.exe)
- **macOS**: DMG + 자동 업데이트 (.dmg, .zip)
- **Linux**: AppImage 자동 업데이트 (.AppImage)

---

## 시스템 아키텍처

### 업데이트 흐름

```
[앱 시작]
    ↓
[업데이트 확인] ← electron-updater
    ↓
[새 버전 있음?]
    ↓ (YES)
[사용자에게 알림 표시]
    ↓
[다운로드 시작] (백그라운드)
    ↓
[진행률 표시]
    ↓
[다운로드 완료]
    ↓
[설치 확인 대화상자]
    ↓
[앱 종료 → 업데이트 설치 → 재시작]
```

### 컴포넌트 구조

```
Main Process (autoUpdater.js)
├── checkForUpdatesAndNotify() - 업데이트 확인
├── downloadUpdate() - 업데이트 다운로드
├── quitAndInstall() - 설치 및 재시작
└── Event Handlers
    ├── update-available - 업데이트 발견
    ├── download-progress - 다운로드 진행
    └── update-downloaded - 다운로드 완료

Renderer Process (UpdateNotification.jsx)
├── 업데이트 알림 UI
├── 진행률 표시
└── 설치 확인 버튼
```

---

## 설치 및 설정

### 1. 패키지 설치

```bash
npm install electron-updater --save
```

### 2. package.json 설정

```json
{
  "name": "pixelbooster",
  "version": "0.1.0",
  "main": "main.js",
  "build": {
    "appId": "com.thekadang.pixelbooster",
    "productName": "픽셀부스터",
    "publish": [
      {
        "provider": "github",
        "owner": "thekadang",
        "repo": "pixelbooster",
        "private": false
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.graphics-design",
      "icon": "build/icon.icns"
    },
    "linux": {
      "target": ["AppImage"],
      "category": "Graphics",
      "icon": "build/icon.png"
    }
  }
}
```

### 3. 환경 변수 설정 (.env)

```env
# GitHub Personal Access Token (릴리스 업로드용)
GH_TOKEN=your_github_token_here

# 업데이트 채널 (production, beta, alpha)
UPDATE_CHANNEL=production
```

---

## 업데이트 전략

### 업데이트 채널

**Production (기본)**
```javascript
// 안정적인 정식 릴리스
autoUpdater.channel = 'latest';
```

**Beta**
```javascript
// 베타 테스트 버전
autoUpdater.channel = 'beta';
autoUpdater.allowPrerelease = true;
```

**Alpha/Dev**
```javascript
// 개발 테스트 버전
autoUpdater.channel = 'alpha';
autoUpdater.allowPrerelease = true;
autoUpdater.allowDowngrade = true;
```

### 업데이트 타이밍

**앱 시작 시 (권장)**
```javascript
app.on('ready', () => {
  // 5초 후 업데이트 확인 (UI 로딩 후)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
});
```

**주기적 확인**
```javascript
// 1시간마다 확인
setInterval(() => {
  autoUpdater.checkForUpdates();
}, 60 * 60 * 1000);
```

**수동 확인**
```javascript
// 사용자가 메뉴에서 "업데이트 확인" 클릭
ipcMain.handle('check-for-updates', async () => {
  return await autoUpdater.checkForUpdates();
});
```

---

## 구현 가이드

### Main Process (main.js)

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// 로그 설정
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow;

// 개발 환경에서는 자동 업데이트 비활성화
if (process.env.NODE_ENV === 'development') {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

// 앱 준비 완료
app.on('ready', () => {
  createWindow();

  // 5초 후 업데이트 확인
  setTimeout(() => {
    if (process.env.NODE_ENV !== 'development') {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }, 5000);
});

// 업데이트 이벤트 핸들러
autoUpdater.on('checking-for-update', () => {
  log.info('업데이트 확인 중...');
  mainWindow?.webContents.send('update-checking');
});

autoUpdater.on('update-available', (info) => {
  log.info('업데이트 가능:', info);
  mainWindow?.webContents.send('update-available', {
    version: info.version,
    releaseNotes: info.releaseNotes,
    releaseDate: info.releaseDate
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('최신 버전 사용 중:', info);
  mainWindow?.webContents.send('update-not-available', {
    version: info.version
  });
});

autoUpdater.on('error', (err) => {
  log.error('업데이트 오류:', err);
  mainWindow?.webContents.send('update-error', {
    message: err.message
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  log.info('다운로드 진행률:', progressObj.percent);
  mainWindow?.webContents.send('update-download-progress', {
    percent: progressObj.percent,
    transferred: progressObj.transferred,
    total: progressObj.total,
    bytesPerSecond: progressObj.bytesPerSecond
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('업데이트 다운로드 완료:', info);
  mainWindow?.webContents.send('update-downloaded', {
    version: info.version,
    releaseNotes: info.releaseNotes
  });
});

// IPC 핸들러
ipcMain.handle('check-for-updates', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { available: false, message: '개발 환경에서는 업데이트 불가' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: true, updateInfo: result.updateInfo };
  } catch (error) {
    return { available: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  // 앱 종료 후 업데이트 설치
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-current-version', () => {
  return app.getVersion();
});
```

### Preload Script (preload.js)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('autoUpdate', {
  // 업데이트 확인
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // 업데이트 다운로드
  downloadUpdate: () => ipcRenderer.invoke('download-update'),

  // 업데이트 설치
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // 현재 버전 조회
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),

  // 이벤트 리스너
  onUpdateChecking: (callback) => {
    ipcRenderer.on('update-checking', callback);
  },

  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },

  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (event, info) => callback(info));
  },

  onDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },

  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  }
});
```

---

## GitHub Releases 연동

### 1. GitHub Personal Access Token 생성

1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Scopes 선택: `repo` (전체 저장소 액세스)
4. 토큰 복사 후 `.env` 파일에 저장

```env
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. 릴리스 스크립트 (package.json)

```json
{
  "scripts": {
    "build:win": "npm run build && electron-builder --win",
    "build:mac": "npm run build && electron-builder --mac",
    "build:linux": "npm run build && electron-builder --linux",
    "build:all": "npm run build && electron-builder --win --mac --linux",
    "publish:win": "npm run build && electron-builder --win --publish always",
    "publish:mac": "npm run build && electron-builder --mac --publish always",
    "publish:linux": "npm run build && electron-builder --linux --publish always",
    "publish:all": "npm run build && electron-builder --win --mac --linux --publish always"
  }
}
```

### 3. 릴리스 프로세스

**Step 1: 버전 업데이트**
```bash
npm version patch  # 0.1.0 → 0.1.1 (버그 수정)
npm version minor  # 0.1.1 → 0.2.0 (기능 추가)
npm version major  # 0.2.0 → 1.0.0 (주요 변경)
```

**Step 2: 변경 사항 기록 (CHANGELOG.md)**
```markdown
## [0.2.0] - 2025-01-15

### Added
- 다국어 지원 (한국어, 영어)
- 어필리에이트 시스템

### Fixed
- 이미지 변환 오류 수정
- 백업 복원 버그 수정
```

**Step 3: 빌드 및 릴리스**
```bash
# Windows만 릴리스
npm run publish:win

# 모든 플랫폼 릴리스
npm run publish:all
```

**Step 4: GitHub Releases 확인**
- 자동으로 GitHub Releases에 업로드됨
- 릴리스 노트는 CHANGELOG.md 기반으로 자동 생성
- 각 플랫폼별 설치 파일이 첨부됨

### 4. latest.yml 파일 생성

electron-builder가 자동 생성하는 파일:

**Windows (latest.yml)**
```yaml
version: 0.2.0
files:
  - url: pixelbooster-Setup-0.2.0.exe
    sha512: [자동 생성 해시]
    size: 123456789
path: pixelbooster-Setup-0.2.0.exe
sha512: [자동 생성 해시]
releaseDate: '2025-01-15T10:30:00.000Z'
```

**macOS (latest-mac.yml)**
```yaml
version: 0.2.0
files:
  - url: pixelbooster-0.2.0-mac.zip
    sha512: [자동 생성 해시]
    size: 123456789
  - url: pixelbooster-0.2.0.dmg
    sha512: [자동 생성 해시]
    size: 234567890
path: pixelbooster-0.2.0-mac.zip
sha512: [자동 생성 해시]
releaseDate: '2025-01-15T10:30:00.000Z'
```

---

## 업데이트 UI

### React 컴포넌트 (UpdateNotification.jsx)

```jsx
import React, { useState, useEffect } from 'react';
import './UpdateNotification.css';

function UpdateNotification() {
  const [updateState, setUpdateState] = useState('idle'); // idle, checking, available, downloading, downloaded, error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    // 현재 버전 조회
    window.autoUpdate.getCurrentVersion().then(setCurrentVersion);

    // 이벤트 리스너 등록
    window.autoUpdate.onUpdateChecking(() => {
      setUpdateState('checking');
    });

    window.autoUpdate.onUpdateAvailable((info) => {
      setUpdateState('available');
      setUpdateInfo(info);
    });

    window.autoUpdate.onUpdateNotAvailable(() => {
      setUpdateState('idle');
    });

    window.autoUpdate.onDownloadProgress((progress) => {
      setUpdateState('downloading');
      setDownloadProgress(progress.percent);
    });

    window.autoUpdate.onUpdateDownloaded((info) => {
      setUpdateState('downloaded');
      setUpdateInfo(info);
    });

    window.autoUpdate.onUpdateError((error) => {
      setUpdateState('error');
      console.error('업데이트 오류:', error);
    });
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateState('checking');
    const result = await window.autoUpdate.checkForUpdates();
    if (!result.available) {
      alert('최신 버전을 사용 중입니다.');
      setUpdateState('idle');
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateState('downloading');
    await window.autoUpdate.downloadUpdate();
  };

  const handleInstallUpdate = () => {
    window.autoUpdate.installUpdate();
  };

  if (updateState === 'idle') {
    return (
      <div className="update-notification idle">
        <button onClick={handleCheckForUpdates}>
          🔄 업데이트 확인
        </button>
        <span className="version-info">현재 버전: v{currentVersion}</span>
      </div>
    );
  }

  if (updateState === 'checking') {
    return (
      <div className="update-notification checking">
        <span>업데이트 확인 중...</span>
      </div>
    );
  }

  if (updateState === 'available') {
    return (
      <div className="update-notification available">
        <div className="update-header">
          <h3>🎉 새로운 버전 발견!</h3>
          <span className="new-version">v{updateInfo.version}</span>
        </div>
        <div className="release-notes">
          <h4>변경 사항:</h4>
          <div dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }} />
        </div>
        <div className="update-actions">
          <button className="download-btn" onClick={handleDownloadUpdate}>
            ⬇️ 다운로드
          </button>
          <button className="cancel-btn" onClick={() => setUpdateState('idle')}>
            나중에
          </button>
        </div>
      </div>
    );
  }

  if (updateState === 'downloading') {
    return (
      <div className="update-notification downloading">
        <h3>업데이트 다운로드 중...</h3>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
        </div>
        <span className="progress-text">{downloadProgress.toFixed(1)}%</span>
      </div>
    );
  }

  if (updateState === 'downloaded') {
    return (
      <div className="update-notification downloaded">
        <h3>✅ 업데이트 다운로드 완료!</h3>
        <p>지금 설치하시겠습니까?</p>
        <div className="update-actions">
          <button className="install-btn" onClick={handleInstallUpdate}>
            🚀 지금 설치
          </button>
          <button className="later-btn" onClick={() => setUpdateState('idle')}>
            나중에 설치
          </button>
        </div>
      </div>
    );
  }

  if (updateState === 'error') {
    return (
      <div className="update-notification error">
        <h3>❌ 업데이트 오류</h3>
        <p>업데이트를 확인하는 중 오류가 발생했습니다.</p>
        <button onClick={() => setUpdateState('idle')}>닫기</button>
      </div>
    );
  }

  return null;
}

export default UpdateNotification;
```

### 스타일 (UpdateNotification.css)

```css
.update-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 20px;
  max-width: 400px;
  z-index: 9999;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.update-notification.idle {
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.update-header {
  margin-bottom: 15px;
}

.update-header h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
}

.new-version {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.release-notes {
  margin-bottom: 20px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
}

.release-notes h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
}

.update-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.update-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.download-btn,
.install-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.download-btn:hover,
.install-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.cancel-btn,
.later-btn {
  background: #e0e0e0;
  color: #333;
}

.cancel-btn:hover,
.later-btn:hover {
  background: #d0d0d0;
}

.progress-bar {
  width: 100%;
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  margin: 15px 0 10px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #667eea;
}

.version-info {
  font-size: 12px;
  color: #666;
}
```

---

## 테스팅

### 로컬 테스트 (개발 환경)

**1. 모의 업데이트 서버 설정**

```javascript
// dev-app-update.yml 생성
const yaml = require('js-yaml');
const fs = require('fs');

const updateConfig = {
  provider: 'generic',
  url: 'http://localhost:3000/updates'
};

fs.writeFileSync('dev-app-update.yml', yaml.dump(updateConfig));
```

**2. 업데이트 파일 제공**

```bash
# 간단한 HTTP 서버 실행
npm install -g http-server
cd dist-electron
http-server -p 3000
```

**3. 테스트 시나리오**

```javascript
// main.js에 추가
if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서 로컬 업데이트 서버 사용
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://localhost:3000/updates'
  });

  // 강제 업데이트 확인
  autoUpdater.checkForUpdates();
}
```

### 프로덕션 테스트

**1. Beta 채널 테스트**

```bash
# package.json 버전을 0.1.1-beta.0으로 변경
npm version prerelease --preid=beta

# Beta 릴리스 배포
npm run publish:all
```

**2. 실제 업데이트 플로우 테스트**

- 구버전(0.1.0) 설치
- 신버전(0.1.1) GitHub Release 생성
- 앱 실행 후 자동 업데이트 확인
- 다운로드 및 설치 프로세스 검증

**3. 롤백 테스트**

```bash
# 이전 버전으로 롤백 허용
autoUpdater.allowDowngrade = true;
autoUpdater.checkForUpdates();
```

---

## 문제 해결

### 일반적인 문제

**1. 업데이트가 감지되지 않음**
```javascript
// 로그 확인
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'debug';

// 수동 확인
autoUpdater.checkForUpdates().then((result) => {
  console.log('업데이트 결과:', result);
}).catch((error) => {
  console.error('업데이트 오류:', error);
});
```

**2. GitHub Releases 권한 오류**
```bash
# GH_TOKEN 확인
echo $GH_TOKEN  # macOS/Linux
echo %GH_TOKEN%  # Windows

# 토큰 권한 확인 (repo 스코프 필요)
```

**3. 서명 문제 (Windows)**
```javascript
// package.json
{
  "build": {
    "win": {
      "certificateFile": "cert.pfx",
      "certificatePassword": "password",
      "signingHashAlgorithms": ["sha256"]
    }
  }
}
```

**4. macOS Notarization 문제**
```javascript
// package.json
{
  "build": {
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

### 디버깅 팁

**업데이트 상태 모니터링**
```javascript
autoUpdater.on('checking-for-update', () => {
  console.log('[1/5] 업데이트 확인 시작');
});

autoUpdater.on('update-available', (info) => {
  console.log('[2/5] 업데이트 발견:', info.version);
});

autoUpdater.on('download-progress', (progress) => {
  console.log('[3/5] 다운로드 진행:', progress.percent.toFixed(2), '%');
});

autoUpdater.on('update-downloaded', () => {
  console.log('[4/5] 다운로드 완료');
});

autoUpdater.on('before-quit-for-update', () => {
  console.log('[5/5] 업데이트 설치 시작');
});
```

---

## 보안 고려사항

### 1. 코드 서명
- **필수**: Windows, macOS에서 신뢰 받은 앱으로 인식
- Windows: EV 코드 서명 인증서 필요
- macOS: Apple Developer 계정 + 인증서

### 2. HTTPS 전용
```javascript
// HTTP는 절대 사용 금지
autoUpdater.setFeedURL({
  provider: 'github',
  repo: 'pixelbooster',
  owner: 'thekadang',
  protocol: 'https' // 반드시 HTTPS
});
```

### 3. 무결성 검증
- electron-updater가 SHA-512 해시로 자동 검증
- 다운로드된 파일과 latest.yml의 해시 비교

### 4. 업데이트 소스 검증
```javascript
// GitHub만 신뢰
if (autoUpdater.getFeedURL().includes('github.com')) {
  autoUpdater.checkForUpdates();
} else {
  console.error('신뢰할 수 없는 업데이트 소스');
}
```

---

## 참고 자료

- [electron-updater 공식 문서](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Electron 코드 서명 가이드](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [macOS Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**마지막 업데이트**: 2025-01-10
**작성자**: Claude Code (픽셀부스터 개발팀)
