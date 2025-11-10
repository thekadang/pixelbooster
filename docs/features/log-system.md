# 로그 시스템

픽셀부스터의 Excel 기반 작업 로그 관리 시스템 문서

---

## 📌 개요

**LogManager**는 이미지 변환 작업의 모든 기록을 Excel 파일로 저장하고 관리합니다. 사용자는 작업 이력을 시각적으로 확인하고, 통계 정보를 분석할 수 있습니다.

---

## 🏗️ 아키텍처

### 컴포넌트 구조

```
LogManager (client/src/services/log-manager.ts)
├─ createLogFile()           # 새 로그 파일 생성
├─ appendBatchLog()          # 배치 처리 결과 추가
├─ getLogHistory()           # 로그 이력 조회
├─ exportToExcel()           # Excel 파일 내보내기
└─ [Private Methods]         # 내부 헬퍼 함수
```

### 데이터 흐름

```
ImageProcessor (배치 처리 완료)
      ↓
LogManager.appendBatchLog()
      ↓
Excel 파일 (.xlsx)
      ↓ (읽기/쓰기)
exceljs 라이브러리
      ↓
파일 시스템 (저장)
```

---

## 🚀 주요 기능

### 1. Excel 파일 생성

#### 파일 구조
```
logs/
├─ 2025-01-15_batch-log.xlsx
├─ 2025-01-16_batch-log.xlsx
└─ monthly-summary.xlsx
```

#### 시트 구조
```
Sheet 1: "작업 기록" (일자별)
Sheet 2: "통계" (요약 정보)
```

---

### 2. 작업 기록 시트

#### 열 구성

| 열 이름 | 타입 | 설명 | 예시 |
|---------|------|------|------|
| 번호 | Number | 작업 순번 | 1 |
| 작업 일시 | DateTime | 처리 시작 시간 | 2025-01-15 14:30:22 |
| 파일명 | String | 원본 파일명 | photo.jpg |
| 원본 경로 | Hyperlink | 원본 파일 경로 (클릭 가능) | C:/input/photo.jpg |
| 출력 경로 | Hyperlink | 출력 파일 경로 (클릭 가능) | C:/output/photo.webp |
| 원본 크기 | Number | 원본 파일 크기 (MB) | 5.2 MB |
| 출력 크기 | Number | 출력 파일 크기 (MB) | 1.3 MB |
| 압축률 | Percentage | 압축률 (%) | 75.0% |
| 포맷 | String | 출력 포맷 | WebP |
| 품질 | Number | 압축 품질 | 80 |
| 상태 | String | 처리 상태 | 성공 / 실패 |
| 에러 메시지 | String | 실패 시 에러 메시지 | - |
| 처리 시간 | Number | 처리 소요 시간 (초) | 2.3 |

---

### 3. 통계 시트

#### 요약 정보

```
📊 전체 통계
- 총 변환 파일: 127개
- 성공: 124개 (97.6%)
- 실패: 3개 (2.4%)
- 평균 압축률: 68.5%
- 총 절약 용량: 342 MB
- 총 처리 시간: 15분 30초

📈 포맷별 통계
- WebP: 85개 (평균 압축률 72%)
- AVIF: 32개 (평균 압축률 80%)
- JPG: 10개 (평균 압축률 50%)

📅 일자별 통계
- 2025-01-15: 45개 (평균 압축률 70%)
- 2025-01-16: 82개 (평균 압축률 67%)
```

---

## 🔧 구현 세부사항

### LogManager 클래스

#### 1. createLogFile() - 로그 파일 생성

```typescript
/**
 * 새 로그 파일 생성
 *
 * @param date - 로그 생성 일자 (기본값: 오늘)
 * @returns 생성된 파일 경로
 */
async createLogFile(date?: Date): Promise<Result<string>>
```

**처리 흐름**:
1. logs/ 디렉토리 생성 (존재하지 않으면)
2. 파일명 생성: `YYYY-MM-DD_batch-log.xlsx`
3. ExcelJS Workbook 생성
4. "작업 기록" 시트 추가 (헤더 포함)
5. "통계" 시트 추가 (템플릿 포함)
6. 파일 저장
7. 파일 경로 반환

---

#### 2. appendBatchLog() - 배치 로그 추가

```typescript
/**
 * 배치 처리 결과를 로그에 추가
 *
 * @param batchProgress - 배치 처리 결과
 * @param logFilePath - 로그 파일 경로 (옵션)
 * @returns 업데이트 결과
 */
async appendBatchLog(
  batchProgress: BatchProcessProgress,
  logFilePath?: string
): Promise<Result<void>>
```

**처리 흐름**:
1. 로그 파일 경로 결정 (미제공 시 오늘 날짜 파일)
2. 로그 파일 열기 (없으면 생성)
3. "작업 기록" 시트 가져오기
4. 각 파일 항목을 새 행으로 추가
   - 번호, 일시, 파일명, 경로(하이퍼링크), 크기, 압축률, 포맷, 품질, 상태, 에러, 처리 시간
5. "통계" 시트 업데이트
   - 전체 통계, 포맷별 통계, 일자별 통계 계산
6. 파일 저장

---

#### 3. getLogHistory() - 로그 이력 조회

```typescript
/**
 * 로그 이력 조회
 *
 * @param startDate - 시작 일자 (옵션)
 * @param endDate - 종료 일자 (옵션)
 * @returns 로그 항목 배열
 */
async getLogHistory(
  startDate?: Date,
  endDate?: Date
): Promise<Result<LogEntry[]>>
```

**처리 흐름**:
1. logs/ 디렉토리 읽기
2. 날짜 범위 필터링 (startDate ~ endDate)
3. 각 파일의 "작업 기록" 시트 읽기
4. 모든 항목을 하나의 배열로 합치기
5. 일시 순으로 정렬
6. 결과 반환

---

#### 4. exportToExcel() - Excel 파일 내보내기

```typescript
/**
 * 통합 Excel 파일로 내보내기
 *
 * @param startDate - 시작 일자
 * @param endDate - 종료 일자
 * @param outputPath - 출력 파일 경로
 * @returns 내보내기 결과
 */
async exportToExcel(
  startDate: Date,
  endDate: Date,
  outputPath: string
): Promise<Result<void>>
```

**처리 흐름**:
1. 로그 이력 조회 (startDate ~ endDate)
2. 새 Workbook 생성
3. "통합 작업 기록" 시트 추가 (모든 항목)
4. "통계" 시트 추가 (기간 전체 통계)
5. 스타일 적용 (헤더, 셀 포맷팅)
6. 파일 저장

---

### ExcelJS 활용

#### 기본 사용법

```typescript
import * as ExcelJS from 'exceljs';

// Workbook 생성
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('작업 기록');

// 헤더 추가
worksheet.columns = [
  { header: '번호', key: 'id', width: 10 },
  { header: '파일명', key: 'filename', width: 30 },
  { header: '원본 경로', key: 'inputPath', width: 50 },
  // ... 더 많은 열
];

// 데이터 추가
worksheet.addRow({
  id: 1,
  filename: 'photo.jpg',
  inputPath: 'C:/input/photo.jpg',
});

// 하이퍼링크 추가
worksheet.getCell('C2').value = {
  text: 'C:/input/photo.jpg',
  hyperlink: 'file:///C:/input/photo.jpg',
};

// 파일 저장
await workbook.xlsx.writeFile('logs/batch-log.xlsx');
```

#### 스타일링

```typescript
// 헤더 스타일
worksheet.getRow(1).font = { bold: true };
worksheet.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF6B46C1' }, // 보라색
};
worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

// 셀 포맷팅 (숫자, 날짜, 퍼센트)
worksheet.getColumn('원본 크기').numFmt = '0.00" MB"';
worksheet.getColumn('작업 일시').numFmt = 'yyyy-mm-dd hh:mm:ss';
worksheet.getColumn('압축률').numFmt = '0.0"%"';
```

---

## 📊 데이터 모델

### LogEntry 타입

```typescript
interface LogEntry {
  id: number;                 // 순번
  timestamp: Date;            // 작업 일시
  filename: string;           // 파일명
  inputPath: string;          // 원본 경로
  outputPath: string;         // 출력 경로
  inputSize: number;          // 원본 크기 (바이트)
  outputSize: number;         // 출력 크기 (바이트)
  compressionRatio: number;   // 압축률 (0-100%)
  format: ImageFormat;        // 출력 포맷
  quality: number;            // 압축 품질
  status: 'success' | 'failed'; // 처리 상태
  error?: string;             // 에러 메시지
  processingTime: number;     // 처리 시간 (밀리초)
}
```

### LogStatistics 타입

```typescript
interface LogStatistics {
  totalFiles: number;         // 총 파일 수
  successCount: number;       // 성공 수
  failedCount: number;        // 실패 수
  successRate: number;        // 성공률 (%)
  averageCompressionRatio: number; // 평균 압축률 (%)
  totalSavedSize: number;     // 절약 용량 (바이트)
  totalProcessingTime: number; // 총 처리 시간 (밀리초)
  formatStats: {              // 포맷별 통계
    [format: string]: {
      count: number;
      averageCompressionRatio: number;
    };
  };
  dateStats: {                // 일자별 통계
    [date: string]: {
      count: number;
      averageCompressionRatio: number;
    };
  };
}
```

---

## 🧪 테스트 가이드

### 단일 로그 추가

```typescript
const logManager = new LogManager();

// 로그 파일 생성
const fileResult = await logManager.createLogFile();
if (!fileResult.success) {
  console.error('로그 파일 생성 실패:', fileResult.error);
  return;
}

// 배치 처리 결과 추가
const batchProgress: BatchProcessProgress = {
  total: 2,
  completed: 2,
  failed: 0,
  processing: 0,
  overallProgress: 100,
  items: [
    {
      id: '1',
      filename: 'photo1.jpg',
      inputPath: 'C:/input/photo1.jpg',
      outputPath: 'C:/output/photo1.webp',
      status: 'completed',
      progress: 100,
      originalSize: 5242880,    // 5 MB
      compressedSize: 1310720,  // 1.25 MB
      startTime: new Date('2025-01-15T14:30:00'),
      endTime: new Date('2025-01-15T14:30:02'),
    },
    {
      id: '2',
      filename: 'photo2.png',
      inputPath: 'C:/input/photo2.png',
      outputPath: 'C:/output/photo2.webp',
      status: 'completed',
      progress: 100,
      originalSize: 3145728,    // 3 MB
      compressedSize: 786432,   // 0.75 MB
      startTime: new Date('2025-01-15T14:30:02'),
      endTime: new Date('2025-01-15T14:30:04'),
    },
  ],
};

const result = await logManager.appendBatchLog(batchProgress);
if (result.success) {
  console.log('로그 추가 완료');
} else {
  console.error('로그 추가 실패:', result.error);
}
```

### 로그 이력 조회

```typescript
// 전체 로그 조회
const allLogs = await logManager.getLogHistory();

// 특정 기간 로그 조회
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');
const monthlyLogs = await logManager.getLogHistory(startDate, endDate);

if (monthlyLogs.success) {
  console.log(`총 ${monthlyLogs.data.length}개의 작업 기록`);
  monthlyLogs.data.forEach((log) => {
    console.log(`${log.filename}: ${log.status} (압축률: ${log.compressionRatio}%)`);
  });
}
```

### Excel 파일 내보내기

```typescript
// 월간 리포트 내보내기
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');
const outputPath = 'reports/2025-01-monthly-report.xlsx';

const result = await logManager.exportToExcel(startDate, endDate, outputPath);
if (result.success) {
  console.log('월간 리포트 내보내기 완료');
} else {
  console.error('내보내기 실패:', result.error);
}
```

---

## 🎨 UI 통합

### 로그 뷰어 컴포넌트

```jsx
// client/src/components/LogViewer.jsx

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    const result = await window.api.invoke('LOG_GET_HISTORY');
    if (result.success) {
      setLogs(result.data);
    }
    setLoading(false);
  };

  return (
    <div className="log-viewer">
      <h2>작업 이력</h2>
      <button onClick={loadLogs}>새로고침</button>
      <table>
        <thead>
          <tr>
            <th>일시</th>
            <th>파일명</th>
            <th>상태</th>
            <th>압축률</th>
            <th>처리 시간</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.filename}</td>
              <td>{log.status === 'success' ? '✅' : '❌'}</td>
              <td>{log.compressionRatio.toFixed(1)}%</td>
              <td>{(log.processingTime / 1000).toFixed(1)}초</td>
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
| 로그 파일 크기 | 제한 없음 | 메모리 효율적 스트림 방식 |
| 로그 보관 기간 | 무제한 | 사용자가 수동 삭제 |
| Excel 버전 | Excel 2007+ | .xlsx 포맷 사용 |

### 향후 개선 사항

1. **로그 자동 정리**: 30일 이전 로그 자동 삭제 옵션
2. **로그 압축**: 오래된 로그 파일 자동 압축 (.zip)
3. **CSV 내보내기**: Excel 외에 CSV 포맷 지원
4. **로그 검색**: 파일명, 포맷, 날짜 기반 검색 기능
5. **차트 생성**: 통계 시트에 차트 자동 생성

---

## 📚 관련 문서

- [백업 시스템](backup-system.md) - 원본 파일 백업 및 복원
- [이미지 처리 로직](image-processing.md) - ImageProcessor 통합
- [코딩 컨벤션](../development/conventions.md) - 코드 스타일 가이드

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**버전**: v0.1.0 (Phase 4 준비)
