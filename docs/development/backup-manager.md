# BackupManager 개발 가이드

BackupManager 서비스 구현 가이드 및 API 레퍼런스

---

## 📌 개요

BackupManager는 이미지 변환 전 원본 파일을 안전하게 백업하고, 필요 시 복원하는 서비스입니다.

**위치**: `client/src/services/backup-manager.ts`

---

## 🔧 클래스 구조

```typescript
export class BackupManager {
  private backupDir: string;
  private indexPath: string;

  constructor();

  // Public Methods
  async backupFile(filePath: string): Promise<Result<BackupInfo>>;
  async backupBatch(files: string[], onProgress?: (progress: BackupProgress) => void): Promise<Result<BackupBatchResult>>;
  async restoreFile(backupId: string, targetPath?: string): Promise<Result<string>>;
  async restoreBatch(backupIds: string[], onProgress?: (progress: BackupProgress) => void): Promise<Result<BackupBatchResult>>;
  async listBackups(filters?: BackupFilters): Promise<Result<BackupInfo[]>>;
  async deleteBackup(backupId: string): Promise<Result<void>>;

  // Private Methods
  private async ensureBackupDirectory(): Promise<void>;
  private async copyFile(source: string, destination: string, onProgress?: (progress: number) => void): Promise<void>;
  private async calculateHash(filePath: string): Promise<string>;
  private async updateIndex(backupInfo: BackupInfo): Promise<void>;
  private async loadIndex(): Promise<BackupIndex>;
  private getBackupFileName(filename: string, date: Date): string;
  private formatFileSize(bytes: number): string;
}
```

---

## 📚 API 레퍼런스

### backupFile()

```typescript
async backupFile(filePath: string): Promise<Result<BackupInfo>>
```

**설명**: 단일 파일 백업

**파라미터**:
- `filePath` (string): 원본 파일 경로

**반환값**:
- `Result<BackupInfo>`: 백업 정보

**예시**:
```typescript
const result = await backupManager.backupFile('C:/input/photo.jpg');
if (result.success) {
  console.log('백업 완료:', result.data.backupPath);
  console.log('백업 ID:', result.data.backupId);
}
```

---

### backupBatch()

```typescript
async backupBatch(
  files: string[],
  onProgress?: (progress: BackupProgress) => void
): Promise<Result<BackupBatchResult>>
```

**설명**: 배치 파일 백업

**파라미터**:
- `files` (string[]): 원본 파일 경로 배열
- `onProgress` (함수, 옵션): 진행 상태 콜백

**반환값**:
- `Result<BackupBatchResult>`: 배치 백업 결과

**예시**:
```typescript
const files = ['C:/input/photo1.jpg', 'C:/input/photo2.png'];
const result = await backupManager.backupBatch(files, (progress) => {
  console.log(`진행률: ${progress.overallProgress}%`);
});
```

---

### restoreFile()

```typescript
async restoreFile(
  backupId: string,
  targetPath?: string
): Promise<Result<string>>
```

**설명**: 백업 파일 복원

**파라미터**:
- `backupId` (string): 백업 ID
- `targetPath` (string, 옵션): 복원 대상 경로 (미제공 시 원본 경로)

**반환값**:
- `Result<string>`: 복원된 파일 경로

**예시**:
```typescript
// 원본 경로로 복원
const result = await backupManager.restoreFile('backup_20250115_143022_abc123');

// 특정 경로로 복원
const result2 = await backupManager.restoreFile(
  'backup_20250115_143022_abc123',
  'D:/restored/photo.jpg'
);
```

---

### listBackups()

```typescript
async listBackups(
  filters?: BackupFilters
): Promise<Result<BackupInfo[]>>
```

**설명**: 백업 목록 조회

**파라미터**:
- `filters` (BackupFilters, 옵션): 필터 옵션

**반환값**:
- `Result<BackupInfo[]>`: 백업 목록

**예시**:
```typescript
// 전체 백업 조회
const result = await backupManager.listBackups();

// 필터링 조회
const result2 = await backupManager.listBackups({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  status: 'active',
});
```

---

### deleteBackup()

```typescript
async deleteBackup(backupId: string): Promise<Result<void>>
```

**설명**: 백업 삭제

**파라미터**:
- `backupId` (string): 백업 ID

**반환값**:
- `Result<void>`: 성공/실패 결과

**예시**:
```typescript
const result = await backupManager.deleteBackup('backup_20250115_143022_abc123');
if (result.success) {
  console.log('백업 삭제 완료');
}
```

---

## 🎯 구현 체크리스트

### Phase 1: 기본 구조
- [ ] BackupManager 클래스 생성
- [ ] 타입 정의 (BackupInfo, BackupFilters, BackupProgress, BackupBatchResult)
- [ ] 생성자 및 초기화 로직
- [ ] backup/ 디렉토리 생성 로직

### Phase 2: 단일 파일 백업
- [ ] backupFile() 구현
- [ ] 파일 복사 로직
- [ ] 파일 해시 계산 (SHA-256)
- [ ] 메타데이터 생성 및 저장
- [ ] 전체 인덱스 업데이트

### Phase 3: 배치 파일 백업
- [ ] backupBatch() 구현
- [ ] 순차 처리 로직
- [ ] 진행 상태 업데이트 (onProgress)
- [ ] 에러 처리 및 계속 진행

### Phase 4: 파일 복원
- [ ] restoreFile() 구현
- [ ] 백업 메타데이터 조회
- [ ] 파일 복사 (백업 → 대상)
- [ ] 복원 완료 메타데이터 업데이트

### Phase 5: 백업 관리
- [ ] listBackups() 구현 (필터링, 정렬)
- [ ] deleteBackup() 구현
- [ ] 빈 디렉토리 정리

### Phase 6: IPC 통합
- [ ] Main Process IPC 핸들러 추가
- [ ] Renderer Process API 호출
- [ ] UI 컴포넌트 연동

---

## 🔌 IPC 통신

### IPC 채널

```typescript
// types/ipc.ts

export const IPC_CHANNELS = {
  // ... 기존 채널

  // 백업 관련
  BACKUP_FILE: 'backup:file',
  BACKUP_BATCH: 'backup:batch',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_RESTORE_BATCH: 'backup:restore-batch',
  BACKUP_LIST: 'backup:list',
  BACKUP_DELETE: 'backup:delete',
} as const;
```

### Main Process 핸들러

```typescript
// client/main.ts

import { BackupManager } from './src/services/backup-manager';

const backupManager = new BackupManager();

// 단일 파일 백업
ipcMain.handle(IPC_CHANNELS.BACKUP_FILE, async (_event, filePath: string) => {
  return await backupManager.backupFile(filePath);
});

// 배치 파일 백업
ipcMain.handle(IPC_CHANNELS.BACKUP_BATCH, async (_event, files: string[]) => {
  return await backupManager.backupBatch(files, (progress) => {
    _event.sender.send('backup-progress', progress);
  });
});

// 파일 복원
ipcMain.handle(
  IPC_CHANNELS.BACKUP_RESTORE,
  async (_event, backupId: string, targetPath?: string) => {
    return await backupManager.restoreFile(backupId, targetPath);
  }
);

// 백업 목록 조회
ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async (_event, filters?: BackupFilters) => {
  return await backupManager.listBackups(filters);
});

// 백업 삭제
ipcMain.handle(IPC_CHANNELS.BACKUP_DELETE, async (_event, backupId: string) => {
  return await backupManager.deleteBackup(backupId);
});
```

---

## 📦 의존성

### 내장 모듈 사용
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
```

### 추가 라이브러리 (옵션)
```json
{
  "dependencies": {
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7"
  }
}
```

---

## 🧪 테스트 시나리오

### 1. 파일 백업 테스트

```typescript
const backupManager = new BackupManager();

// 파일 백업
const result = await backupManager.backupFile('C:/test/photo.jpg');
console.assert(result.success, '백업 실패');
console.assert(fs.existsSync(result.data.backupPath), '백업 파일이 생성되지 않음');
```

### 2. 배치 백업 테스트

```typescript
const files = [
  'C:/test/photo1.jpg',
  'C:/test/photo2.png',
  'C:/test/photo3.gif',
];

const result = await backupManager.backupBatch(files);
console.assert(result.success, '배치 백업 실패');
console.assert(result.data.successCount === 3, '백업 개수 불일치');
```

### 3. 파일 복원 테스트

```typescript
// 백업 생성
const backupResult = await backupManager.backupFile('C:/test/photo.jpg');
const backupId = backupResult.data.backupId;

// 원본 파일 삭제
await fs.unlink('C:/test/photo.jpg');

// 복원
const restoreResult = await backupManager.restoreFile(backupId);
console.assert(restoreResult.success, '복원 실패');
console.assert(fs.existsSync('C:/test/photo.jpg'), '복원된 파일이 생성되지 않음');
```

---

## 📚 관련 문서

- [백업 시스템](../features/backup-system.md) - 기능 명세
- [코딩 컨벤션](conventions.md) - 코드 스타일
- [ImageProcessor](image-processor.md) - 통합 참고

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**버전**: v0.1.0 (Phase 4)
