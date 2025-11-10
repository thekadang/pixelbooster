# LogManager 개발 가이드

LogManager 서비스 구현 가이드 및 API 레퍼런스

---

## 📌 개요

LogManager는 이미지 변환 작업의 모든 기록을 Excel 파일로 저장하고 관리하는 서비스입니다.

**위치**: `client/src/services/log-manager.ts`

---

## 🔧 클래스 구조

```typescript
export class LogManager {
  private logDir: string;
  private indexPath: string;

  constructor();

  // Public Methods
  async createLogFile(date?: Date): Promise<Result<string>>;
  async appendBatchLog(batchProgress: BatchProcessProgress, logFilePath?: string): Promise<Result<void>>;
  async getLogHistory(startDate?: Date, endDate?: Date): Promise<Result<LogEntry[]>>;
  async exportToExcel(startDate: Date, endDate: Date, outputPath: string): Promise<Result<void>>;

  // Private Methods
  private async ensureLogDirectory(): Promise<void>;
  private async updateIndex(logEntry: LogEntry): Promise<void>;
  private async loadIndex(): Promise<LogIndex>;
  private getLogFileName(date: Date): string;
  private calculateCompressionRatio(inputSize: number, outputSize: number): number;
  private formatFileSize(bytes: number): string;
}
```

---

## 📚 API 레퍼런스

### createLogFile()

```typescript
async createLogFile(date?: Date): Promise<Result<string>>
```

**설명**: 새 로그 파일 생성

**파라미터**:
- `date` (Date, 옵션): 로그 생성 일자 (기본값: 오늘)

**반환값**:
- `Result<string>`: 생성된 파일 경로

**예시**:
```typescript
const result = await logManager.createLogFile();
if (result.success) {
  console.log('로그 파일 생성:', result.data);
}
```

---

### appendBatchLog()

```typescript
async appendBatchLog(
  batchProgress: BatchProcessProgress,
  logFilePath?: string
): Promise<Result<void>>
```

**설명**: 배치 처리 결과를 로그에 추가

**파라미터**:
- `batchProgress` (BatchProcessProgress): 배치 처리 결과
- `logFilePath` (string, 옵션): 로그 파일 경로 (미제공 시 오늘 날짜 파일)

**반환값**:
- `Result<void>`: 성공/실패 결과

**예시**:
```typescript
const result = await logManager.appendBatchLog(batchProgress);
if (result.success) {
  console.log('로그 추가 완료');
} else {
  console.error('로그 추가 실패:', result.error);
}
```

---

### getLogHistory()

```typescript
async getLogHistory(
  startDate?: Date,
  endDate?: Date
): Promise<Result<LogEntry[]>>
```

**설명**: 로그 이력 조회

**파라미터**:
- `startDate` (Date, 옵션): 시작 일자
- `endDate` (Date, 옵션): 종료 일자

**반환값**:
- `Result<LogEntry[]>`: 로그 항목 배열

**예시**:
```typescript
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');
const result = await logManager.getLogHistory(startDate, endDate);
if (result.success) {
  console.log(`총 ${result.data.length}개의 작업 기록`);
}
```

---

### exportToExcel()

```typescript
async exportToExcel(
  startDate: Date,
  endDate: Date,
  outputPath: string
): Promise<Result<void>>
```

**설명**: 통합 Excel 파일로 내보내기

**파라미터**:
- `startDate` (Date): 시작 일자
- `endDate` (Date): 종료 일자
- `outputPath` (string): 출력 파일 경로

**반환값**:
- `Result<void>`: 성공/실패 결과

**예시**:
```typescript
const result = await logManager.exportToExcel(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  'reports/2025-01-monthly-report.xlsx'
);
```

---

## 🎯 구현 체크리스트

### Phase 1: 기본 구조
- [ ] LogManager 클래스 생성
- [ ] 타입 정의 (LogEntry, LogStatistics, LogIndex)
- [ ] 생성자 및 초기화 로직
- [ ] logs/ 디렉토리 생성 로직

### Phase 2: 로그 파일 생성
- [ ] createLogFile() 구현
- [ ] ExcelJS Workbook 생성
- [ ] "작업 기록" 시트 추가 (헤더 포함)
- [ ] "통계" 시트 추가 (템플릿 포함)
- [ ] 파일 저장 로직

### Phase 3: 로그 추가
- [ ] appendBatchLog() 구현
- [ ] 로그 파일 열기 (없으면 생성)
- [ ] 각 파일 항목을 행으로 추가
- [ ] 하이퍼링크 처리
- [ ] 통계 시트 업데이트
- [ ] 파일 저장

### Phase 4: 로그 조회
- [ ] getLogHistory() 구현
- [ ] logs/ 디렉토리 읽기
- [ ] 날짜 범위 필터링
- [ ] 모든 항목 통합
- [ ] 일시 순 정렬

### Phase 5: Excel 내보내기
- [ ] exportToExcel() 구현
- [ ] 통합 로그 시트 생성
- [ ] 통계 시트 생성
- [ ] 스타일링 적용
- [ ] 파일 저장

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

  // 로그 관련
  LOG_CREATE_FILE: 'log:create-file',
  LOG_APPEND_BATCH: 'log:append-batch',
  LOG_GET_HISTORY: 'log:get-history',
  LOG_EXPORT_EXCEL: 'log:export-excel',
} as const;
```

### Main Process 핸들러

```typescript
// client/main.ts

import { LogManager } from './src/services/log-manager';

const logManager = new LogManager();

// 로그 파일 생성
ipcMain.handle(IPC_CHANNELS.LOG_CREATE_FILE, async (_event, date?: string) => {
  const dateObj = date ? new Date(date) : undefined;
  return await logManager.createLogFile(dateObj);
});

// 배치 로그 추가
ipcMain.handle(
  IPC_CHANNELS.LOG_APPEND_BATCH,
  async (_event, batchProgress: BatchProcessProgress, logFilePath?: string) => {
    return await logManager.appendBatchLog(batchProgress, logFilePath);
  }
);

// 로그 이력 조회
ipcMain.handle(
  IPC_CHANNELS.LOG_GET_HISTORY,
  async (_event, startDate?: string, endDate?: string) => {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return await logManager.getLogHistory(start, end);
  }
);

// Excel 내보내기
ipcMain.handle(
  IPC_CHANNELS.LOG_EXPORT_EXCEL,
  async (_event, startDate: string, endDate: string, outputPath: string) => {
    return await logManager.exportToExcel(
      new Date(startDate),
      new Date(endDate),
      outputPath
    );
  }
);
```

---

## 📦 의존성

### 필수 라이브러리

```json
{
  "dependencies": {
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/exceljs": "^1.3.0"
  }
}
```

### 설치 명령

```bash
npm install exceljs
npm install --save-dev @types/exceljs
```

---

## 🧪 테스트 시나리오

### 1. 로그 파일 생성 테스트

```typescript
const logManager = new LogManager();

// 오늘 날짜 로그 파일 생성
const result = await logManager.createLogFile();
console.assert(result.success, '로그 파일 생성 실패');
console.assert(result.data.endsWith('.xlsx'), '파일 확장자 오류');
```

### 2. 배치 로그 추가 테스트

```typescript
// Mock 배치 처리 결과
const batchProgress: BatchProcessProgress = {
  total: 2,
  completed: 2,
  failed: 0,
  processing: 0,
  overallProgress: 100,
  items: [
    {
      id: '1',
      filename: 'test1.jpg',
      inputPath: 'C:/test/test1.jpg',
      outputPath: 'C:/output/test1.webp',
      status: 'completed',
      progress: 100,
      originalSize: 5242880,
      compressedSize: 1310720,
      startTime: new Date(),
      endTime: new Date(),
    },
  ],
};

const result = await logManager.appendBatchLog(batchProgress);
console.assert(result.success, '로그 추가 실패');
```

### 3. 로그 조회 테스트

```typescript
const result = await logManager.getLogHistory();
console.assert(result.success, '로그 조회 실패');
console.assert(result.data.length > 0, '로그 항목이 없음');
```

---

## 📚 관련 문서

- [로그 시스템](../features/log-system.md) - 기능 명세
- [코딩 컨벤션](conventions.md) - 코드 스타일
- [ImageProcessor](image-processor.md) - 통합 참고

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**버전**: v0.1.0 (Phase 4)
