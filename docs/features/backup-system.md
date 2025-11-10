# 백업 시스템

픽셀부스터의 원본 파일 백업 및 복원 시스템 문서

---

## 📌 개요

**BackupManager**는 이미지 변환 전 원본 파일을 안전하게 백업하고, 필요 시 복원하는 기능을 제공합니다. 사용자는 언제든지 원본 파일을 되돌릴 수 있습니다.

---

## 🏗️ 아키텍처

### 컴포넌트 구조

```
BackupManager (client/src/services/backup-manager.ts)
├─ backupFile()              # 단일 파일 백업
├─ backupBatch()             # 배치 파일 백업
├─ restoreFile()             # 단일 파일 복원
├─ restoreBatch()            # 배치 파일 복원
├─ listBackups()             # 백업 목록 조회
├─ deleteBackup()            # 백업 삭제
└─ [Private Methods]         # 내부 헬퍼 함수
```

### 데이터 흐름

```
ImageProcessor (변환 전)
      ↓
BackupManager.backupFile()
      ↓
backup/ 폴더에 원본 복사
      ↓
metadata.json 생성 (백업 정보)
      ↓
ImageProcessor (변환 진행)
      ↓
복원 필요 시
      ↓
BackupManager.restoreFile()
```

---

## 🚀 주요 기능

### 1. 백업 폴더 구조

#### 디렉토리 구조
```
backup/
├─ 2025-01-15/
│  ├─ photo1_20250115_143022.jpg       # 원본 파일
│  ├─ photo1_20250115_143022.json      # 백업 메타데이터
│  ├─ photo2_20250115_143025.png
│  └─ photo2_20250115_143025.json
├─ 2025-01-16/
│  ├─ image1_20250116_091530.jpg
│  └─ image1_20250116_091530.json
└─ metadata_index.json                 # 전체 백업 인덱스
```

#### 파일 명명 규칙
```
{원본파일명}_{백업일시}.{확장자}

예시:
photo.jpg → photo_20250115_143022.jpg
image.png → image_20250115_143022.png
```

---

### 2. 백업 메타데이터

#### 개별 파일 메타데이터 (*.json)

```json
{
  "backupId": "backup_20250115_143022_abc123",
  "originalPath": "C:/Users/UserName/Pictures/photo.jpg",
  "backupPath": "backup/2025-01-15/photo_20250115_143022.jpg",
  "filename": "photo.jpg",
  "fileSize": 5242880,
  "fileSizeReadable": "5.00 MB",
  "backupDate": "2025-01-15T14:30:22.000Z",
  "hash": "sha256:abc123def456...",
  "status": "active",
  "restoredAt": null
}
```

#### 전체 백업 인덱스 (metadata_index.json)

```json
{
  "version": "1.0",
  "lastUpdated": "2025-01-15T14:30:22.000Z",
  "totalBackups": 127,
  "totalSize": 672894592,
  "backups": [
    {
      "backupId": "backup_20250115_143022_abc123",
      "filename": "photo.jpg",
      "backupDate": "2025-01-15T14:30:22.000Z",
      "fileSize": 5242880,
      "status": "active"
    },
    // ... 더 많은 백업
  ]
}
```

---

## 🔧 구현 세부사항

### BackupManager 클래스

#### 1. backupFile() - 단일 파일 백업

```typescript
/**
 * 단일 파일 백업
 *
 * @param filePath - 원본 파일 경로
 * @returns 백업 정보
 */
async backupFile(filePath: string): Promise<Result<BackupInfo>>
```

**처리 흐름**:
1. 원본 파일 존재 확인
2. 백업 디렉토리 생성 (backup/YYYY-MM-DD/)
3. 백업 파일명 생성 ({filename}_{timestamp}.{ext})
4. 파일 복사 (fs.copyFile)
5. 파일 해시 계산 (SHA-256)
6. 메타데이터 생성 및 저장 (.json)
7. 전체 인덱스 업데이트
8. 백업 정보 반환

**에러 처리**:
- 원본 파일 없음: `파일을 찾을 수 없습니다`
- 디스크 공간 부족: `디스크 공간이 부족합니다`
- 복사 실패: `파일 백업 실패`

---

#### 2. backupBatch() - 배치 파일 백업

```typescript
/**
 * 배치 파일 백업
 *
 * @param files - 원본 파일 경로 배열
 * @param onProgress - 진행 상태 콜백
 * @returns 백업 결과
 */
async backupBatch(
  files: string[],
  onProgress?: (progress: BackupProgress) => void
): Promise<Result<BackupBatchResult>>
```

**처리 흐름**:
1. 각 파일을 순차적으로 백업 (병렬 가능)
2. 진행 상태 업데이트 (onProgress)
3. 실패한 파일 기록 (에러 메시지 포함)
4. 전체 결과 반환 (성공/실패 개수)

**최적화 포인트**:
- 병렬 처리 가능 (MAX_CONCURRENT = 4)
- 실패 시 다음 파일 계속 처리
- 실시간 진행 상태 전송

---

#### 3. restoreFile() - 단일 파일 복원

```typescript
/**
 * 백업 파일 복원
 *
 * @param backupId - 백업 ID
 * @param targetPath - 복원 대상 경로 (옵션)
 * @returns 복원 결과
 */
async restoreFile(
  backupId: string,
  targetPath?: string
): Promise<Result<string>>
```

**처리 흐름**:
1. 백업 메타데이터 조회
2. 백업 파일 존재 확인
3. 복원 대상 경로 결정 (targetPath 또는 원본 경로)
4. 대상 경로에 파일 이미 존재하면 확인 메시지
5. 파일 복사 (백업 → 대상)
6. 복원 완료 메타데이터 업데이트
7. 복원된 파일 경로 반환

**에러 처리**:
- 백업 없음: `백업을 찾을 수 없습니다`
- 대상 경로 충돌: `파일이 이미 존재합니다`
- 복사 실패: `파일 복원 실패`

---

#### 4. listBackups() - 백업 목록 조회

```typescript
/**
 * 백업 목록 조회
 *
 * @param filters - 필터 옵션
 * @returns 백업 목록
 */
async listBackups(
  filters?: BackupFilters
): Promise<Result<BackupInfo[]>>
```

**필터 옵션**:
```typescript
interface BackupFilters {
  startDate?: Date;        // 시작 일자
  endDate?: Date;          // 종료 일자
  filename?: string;       // 파일명 (부분 일치)
  status?: BackupStatus;   // 백업 상태 (active/restored)
  sortBy?: 'date' | 'size' | 'filename'; // 정렬 기준
  sortOrder?: 'asc' | 'desc'; // 정렬 순서
}
```

**처리 흐름**:
1. 전체 인덱스 읽기
2. 필터 조건 적용
3. 정렬 적용
4. 결과 반환

---

#### 5. deleteBackup() - 백업 삭제

```typescript
/**
 * 백업 삭제
 *
 * @param backupId - 백업 ID
 * @returns 삭제 결과
 */
async deleteBackup(backupId: string): Promise<Result<void>>
```

**처리 흐름**:
1. 백업 메타데이터 조회
2. 백업 파일 삭제
3. 메타데이터 파일 삭제
4. 전체 인덱스 업데이트
5. 빈 디렉토리 정리 (일자별 폴더)

---

### 파일 시스템 유틸리티

#### 파일 복사 (안전)

```typescript
/**
 * 파일 안전 복사 (진행 상태 포함)
 *
 * @param source - 원본 경로
 * @param destination - 대상 경로
 * @param onProgress - 진행 상태 콜백
 */
private async copyFileWithProgress(
  source: string,
  destination: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const readStream = fs.createReadStream(source);
  const writeStream = fs.createWriteStream(destination);

  const totalSize = (await fs.stat(source)).size;
  let copiedSize = 0;

  readStream.on('data', (chunk) => {
    copiedSize += chunk.length;
    if (onProgress) {
      onProgress((copiedSize / totalSize) * 100);
    }
  });

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
  });
}
```

#### 파일 해시 계산

```typescript
/**
 * SHA-256 해시 계산
 *
 * @param filePath - 파일 경로
 * @returns 해시 값
 */
private async calculateHash(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
```

---

## 📊 데이터 모델

### BackupInfo 타입

```typescript
interface BackupInfo {
  backupId: string;           // 백업 고유 ID
  originalPath: string;       // 원본 파일 경로
  backupPath: string;         // 백업 파일 경로
  filename: string;           // 파일명
  fileSize: number;           // 파일 크기 (바이트)
  fileSizeReadable: string;   // 읽기 쉬운 크기 (예: "5.00 MB")
  backupDate: Date;           // 백업 일시
  hash: string;               // SHA-256 해시
  status: BackupStatus;       // 백업 상태
  restoredAt?: Date;          // 복원 일시 (옵션)
}
```

### BackupStatus 타입

```typescript
type BackupStatus = 'active' | 'restored' | 'deleted';
```

### BackupProgress 타입

```typescript
interface BackupProgress {
  total: number;              // 전체 파일 수
  completed: number;          // 완료된 파일 수
  failed: number;             // 실패한 파일 수
  processing: number;         // 처리 중인 파일 수
  overallProgress: number;    // 전체 진행률 (0-100%)
  currentFile?: string;       // 현재 처리 중인 파일명
}
```

---

## 🧪 테스트 가이드

### 단일 파일 백업

```typescript
const backupManager = new BackupManager();

// 파일 백업
const result = await backupManager.backupFile('C:/input/photo.jpg');
if (result.success) {
  console.log('백업 완료:', result.data.backupPath);
  console.log('백업 ID:', result.data.backupId);
} else {
  console.error('백업 실패:', result.error);
}
```

### 배치 파일 백업

```typescript
const files = [
  'C:/input/photo1.jpg',
  'C:/input/photo2.png',
  'C:/input/photo3.gif',
];

const result = await backupManager.backupBatch(files, (progress) => {
  console.log(`진행률: ${progress.overallProgress}%`);
  console.log(`완료: ${progress.completed}, 실패: ${progress.failed}`);
});

if (result.success) {
  console.log('배치 백업 완료');
  console.log(`성공: ${result.data.successCount}, 실패: ${result.data.failedCount}`);
} else {
  console.error('배치 백업 실패:', result.error);
}
```

### 파일 복원

```typescript
// 백업 ID로 복원 (원본 경로로)
const restoreResult = await backupManager.restoreFile('backup_20250115_143022_abc123');
if (restoreResult.success) {
  console.log('복원 완료:', restoreResult.data);
}

// 특정 경로로 복원
const restoreResult2 = await backupManager.restoreFile(
  'backup_20250115_143022_abc123',
  'D:/restored/photo.jpg'
);
```

### 백업 목록 조회

```typescript
// 전체 백업 조회
const allBackups = await backupManager.listBackups();

// 필터링 조회
const recentBackups = await backupManager.listBackups({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  status: 'active',
  sortBy: 'date',
  sortOrder: 'desc',
});

if (recentBackups.success) {
  console.log(`총 ${recentBackups.data.length}개의 백업`);
  recentBackups.data.forEach((backup) => {
    console.log(`${backup.filename}: ${backup.fileSizeReadable} (${backup.backupDate})`);
  });
}
```

---

## 🎨 UI 통합

### 백업 관리 컴포넌트

```jsx
// client/src/components/BackupManager.jsx

const BackupManager = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    const result = await window.api.invoke('BACKUP_LIST');
    if (result.success) {
      setBackups(result.data);
    }
    setLoading(false);
  };

  const handleRestore = async (backupId) => {
    const confirmed = window.confirm('이 파일을 복원하시겠습니까?');
    if (!confirmed) return;

    const result = await window.api.invoke('BACKUP_RESTORE', backupId);
    if (result.success) {
      alert('복원 완료!');
      loadBackups();
    } else {
      alert(`복원 실패: ${result.error}`);
    }
  };

  const handleDelete = async (backupId) => {
    const confirmed = window.confirm('이 백업을 삭제하시겠습니까?');
    if (!confirmed) return;

    const result = await window.api.invoke('BACKUP_DELETE', backupId);
    if (result.success) {
      alert('삭제 완료!');
      loadBackups();
    } else {
      alert(`삭제 실패: ${result.error}`);
    }
  };

  return (
    <div className="backup-manager">
      <h2>백업 관리</h2>
      <button onClick={loadBackups}>새로고침</button>
      <table>
        <thead>
          <tr>
            <th>파일명</th>
            <th>백업 일시</th>
            <th>파일 크기</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
            <tr key={backup.backupId}>
              <td>{backup.filename}</td>
              <td>{new Date(backup.backupDate).toLocaleString()}</td>
              <td>{backup.fileSizeReadable}</td>
              <td>{backup.status === 'active' ? '활성' : '복원됨'}</td>
              <td>
                <button onClick={() => handleRestore(backup.backupId)}>복원</button>
                <button onClick={() => handleDelete(backup.backupId)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 🚦 제한사항

### 현재 구현 제한

| 항목 | 제한 | 비고 |
|------|------|------|
| 백업 보관 기간 | 무제한 | 사용자가 수동 삭제 |
| 백업 크기 제한 | 없음 | 디스크 공간에 따라 제한 |
| 동시 백업 | 순차 처리 | 안전성 우선 |
| 백업 압축 | 지원 안 함 | 원본 그대로 보관 |

### 향후 개선 사항

1. **자동 백업 정리**: 30일 이전 백업 자동 삭제 옵션
2. **백업 압축**: ZIP 압축으로 디스크 공간 절약
3. **증분 백업**: 변경된 부분만 백업 (효율성 향상)
4. **백업 암호화**: AES-256 암호화로 보안 강화
5. **클라우드 백업**: Google Drive, Dropbox 연동

---

## 📚 관련 문서

- [로그 시스템](log-system.md) - Excel 기반 작업 로그 관리
- [이미지 처리 로직](image-processing.md) - ImageProcessor 통합
- [코딩 컨벤션](../development/conventions.md) - 코드 스타일 가이드

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**버전**: v0.1.0 (Phase 4 준비)
