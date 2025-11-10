# 이미지 처리 로직

픽셀부스터의 이미지 변환 엔진 아키텍처 및 구현 상세 문서

---

## 📌 개요

픽셀부스터는 **Sharp 라이브러리**를 기반으로 고성능 이미지 변환을 제공합니다. 다양한 포맷 변환, 압축 최적화, 리사이즈, 배치 처리 등의 기능을 지원합니다.

---

## 🏗️ 아키텍처

### 컴포넌트 구조

```
ImageProcessor (client/src/services/image-processor.ts)
├─ processImage()        # 단일 파일 처리
├─ processBatch()        # 배치 처리 (병렬)
├─ cancelBatch()         # 배치 취소
├─ getFileInfo()         # 파일 정보 조회
├─ isSupportedFormat()   # 포맷 지원 확인
└─ [Private Methods]     # 내부 헬퍼 함수
```

### 데이터 흐름

```
Renderer (React UI)
      ↓ (IPC: start-batch-process)
Main Process (Electron)
      ↓
ImageProcessor.processBatch()
      ↓ (병렬 처리)
Sharp 라이브러리 ← [4개 동시 처리]
      ↓
파일 시스템 (출력)
      ↑ (IPC: batch-progress)
Renderer (진행 상태 UI)
```

---

## 🚀 주요 기능

### 1. 지원 포맷

#### 입력 포맷
- **래스터 이미지**: JPG, JPEG, PNG, GIF, BMP, TIFF, TIF
- **최신 포맷**: WebP, AVIF, HEIF, HEIC
- **벡터 이미지**: SVG

#### 출력 포맷
- **WebP**: 손실/무손실 압축, 빠른 처리 속도
- **AVIF**: 차세대 포맷, 최고 압축률
- **JPG**: 범용 호환성, Progressive 지원
- **PNG**: 무손실 압축, 투명도 지원
- **TIFF**: 고품질 보존, LZW 압축
- **GIF**: 애니메이션 지원
- **BMP**: Windows 비트맵 포맷

---

### 2. 변환 옵션

#### 품질 설정 (quality)
- **범위**: 0-100
- **기본값**: 80
- **적용 포맷**: WebP, AVIF, JPG, PNG

```typescript
// 예시
{
  format: 'webp',
  quality: 90  // 고품질 (파일 크기 증가)
}
```

#### 압축 레벨 (compressionLevel)
- **범위**: 0-9
- **기본값**: 6
- **의미**: 높을수록 느리지만 작은 파일

```typescript
// 예시
{
  format: 'avif',
  quality: 80,
  compressionLevel: 9  // 최대 압축 (느림)
}
```

#### 리사이즈 (width, height)
- **너비/높이**: 픽셀 단위
- **종횡비 유지**: maintainAspectRatio (기본값: true)
- **확대 방지**: withoutEnlargement (자동 활성화)

```typescript
// 예시
{
  format: 'webp',
  width: 1920,
  height: 1080,
  maintainAspectRatio: true  // 비율 유지
}
```

---

### 3. 배치 처리 (병렬)

#### 성능 최적화
- **동시 처리**: 최대 4개 파일 병렬 처리
- **대기열 관리**: 자동 작업 분배
- **메모리 효율**: Sharp 스트림 방식 사용

#### 병렬 처리 알고리즘

```typescript
// 핵심 로직
const MAX_CONCURRENT = 4;  // 동시 처리 제한
const queue = [...items];  // 작업 대기열
const processing = [];     // 진행 중 작업

while (queue.length > 0 || processing.length > 0) {
  // 1. 대기열에서 작업 추가 (MAX_CONCURRENT까지)
  while (processing.length < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift();
    processing.push(processItem(item));
  }

  // 2. 하나라도 완료될 때까지 대기
  const completed = await Promise.race(processing);
  processing.splice(completed, 1);
}
```

#### 진행 상태 추적

```typescript
interface BatchProcessProgress {
  total: number;          // 전체 파일 수
  completed: number;      // 완료된 파일 수
  failed: number;         // 실패한 파일 수
  processing: number;     // 처리 중인 파일 수
  overallProgress: number; // 전체 진행률 (0-100%)
  items: BatchProcessItem[]; // 개별 항목 상태
}
```

---

## 🔧 구현 세부사항

### ImageProcessor 클래스

#### 1. processImage() - 단일 파일 처리

```typescript
/**
 * 단일 이미지 처리
 *
 * @param inputPath - 입력 파일 경로
 * @param outputPath - 출력 파일 경로
 * @param options - 변환 옵션
 * @returns 처리 결과
 */
async processImage(
  inputPath: string,
  outputPath: string,
  options: ImageProcessOptions
): Promise<Result<FileInfo>>
```

**처리 흐름**:
1. 입력 파일 검증 (존재 여부)
2. 출력 디렉토리 생성 (recursive)
3. Sharp 인스턴스 생성
4. 리사이즈 적용 (옵션)
5. 포맷 변환 및 압축
6. 파일 저장
7. 결과 파일 정보 반환

**에러 처리**:
- 파일 없음: `파일을 찾을 수 없습니다: {path}`
- 변환 실패: `이미지 처리 실패: {error}`

---

#### 2. processBatch() - 배치 처리

```typescript
/**
 * 배치 처리 (다중 파일) - 병렬 처리 최적화
 *
 * @param files - 입력 파일 경로 배열
 * @param outputDir - 출력 디렉토리
 * @param options - 변환 옵션
 * @param onProgress - 진행 상태 콜백
 * @returns 배치 처리 결과
 */
async processBatch(
  files: string[],
  outputDir: string,
  options: ImageProcessOptions,
  onProgress?: (progress: BatchProcessProgress) => void
): Promise<Result<BatchProcessProgress>>
```

**처리 흐름**:
1. 배치 초기화 (취소 플래그, 작업 항목 생성)
2. 진행 상태 초기화
3. 병렬 처리 시작 (MAX_CONCURRENT = 4)
4. 작업 완료 대기 (Promise.race)
5. 진행 상태 업데이트 (onProgress 콜백)
6. 모든 작업 완료 후 결과 반환

**최적화 포인트**:
- 병렬 처리로 4배 빠른 성능 (4코어 기준)
- Promise.race로 효율적인 대기열 관리
- 실시간 진행 상태 전송

---

#### 3. applyFormatOptions() - 포맷별 옵션 적용

```typescript
/**
 * 포맷별 최적화 옵션 적용
 *
 * @param sharpInstance - Sharp 인스턴스
 * @param options - 변환 옵션
 * @returns Sharp 인스턴스 (메서드 체이닝)
 */
private applyFormatOptions(
  sharpInstance: sharp.Sharp,
  options: ImageProcessOptions
): sharp.Sharp
```

**포맷별 최적화 설정**:

| 포맷 | 주요 옵션 | 특징 |
|------|-----------|------|
| WebP | quality, effort | 손실/무손실 가능, 빠른 속도 |
| AVIF | quality, effort | 최고 압축률, 느린 속도 |
| JPG | quality, progressive, mozjpeg | 범용 호환성, MozJPEG 압축 |
| PNG | quality, compressionLevel, progressive | 무손실 압축, 투명도 지원 |
| TIFF | quality, compression: 'lzw' | 고품질 보존, LZW 압축 |
| GIF | progressive | 애니메이션 지원 |
| BMP | - | Windows 비트맵 |

---

### Sharp 라이브러리 활용

#### 메모리 효율적 처리
```typescript
// 스트림 방식 사용 (메모리 효율)
let sharpInstance = sharp(inputPath);

// 리사이즈 (체이닝)
sharpInstance = sharpInstance.resize(width, height, {
  fit: 'inside',              // 비율 유지
  withoutEnlargement: true,   // 확대 방지
});

// 포맷 변환 (체이닝)
sharpInstance = sharpInstance.webp({ quality: 80 });

// 파일 저장 (최종)
await sharpInstance.toFile(outputPath);
```

#### 메타데이터 처리
```typescript
// 이미지 정보 가져오기
const metadata = await sharp(filePath).metadata();
// metadata.width, metadata.height, metadata.format 등
```

---

## 📊 성능 최적화

### 병렬 처리 효과

| 파일 수 | 순차 처리 | 병렬 처리 (4코어) | 성능 향상 |
|---------|-----------|-------------------|-----------|
| 10개 | 30초 | 8초 | **3.75배** |
| 50개 | 150초 | 40초 | **3.75배** |
| 100개 | 300초 | 80초 | **3.75배** |

**가정**:
- 파일당 처리 시간: 3초
- CPU 코어: 4개
- 동시 처리: MAX_CONCURRENT = 4

---

### 메모리 관리

#### Sharp 스트림 방식
- **장점**: 전체 파일을 메모리에 로드하지 않음
- **효과**: 대용량 파일(50MB+) 처리 가능
- **메모리 사용량**: 파일 크기와 무관하게 일정

#### 배치 처리 제한
- **동시 처리 제한**: MAX_CONCURRENT = 4
- **이유**: 과도한 메모리 사용 방지
- **효과**: 안정적인 대량 파일 처리

---

## 🔍 에러 처리

### Result 타입 패턴

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### 주요 에러 케이스

#### 1. 파일 관련 에러
```typescript
// 파일 없음
return {
  success: false,
  error: `파일을 찾을 수 없습니다: ${inputPath}`,
};

// 파일 정보 조회 실패
return {
  success: false,
  error: `파일 정보를 가져올 수 없습니다: ${errorMessage}`,
};
```

#### 2. 변환 에러
```typescript
// 이미지 처리 실패
return {
  success: false,
  error: `이미지 처리 실패: ${error.message}`,
};

// 배치 처리 실패
return {
  success: false,
  error: `배치 처리 실패: ${error.message}`,
};
```

#### 3. 사용자 취소
```typescript
// 취소 처리
if (this.isCancelled) {
  item.status = 'failed';
  item.error = '사용자가 취소했습니다';
  this.currentBatch.failed++;
  return;
}
```

---

## 🧪 테스트 가이드

### 단일 파일 테스트

```typescript
// 기본 변환
const result = await imageProcessor.processImage(
  'C:/input/photo.jpg',
  'C:/output/photo.webp',
  { format: 'webp', quality: 80 }
);

// 리사이즈 + 변환
const result = await imageProcessor.processImage(
  'C:/input/photo.jpg',
  'C:/output/photo-resized.webp',
  {
    format: 'webp',
    quality: 90,
    width: 1920,
    height: 1080,
    maintainAspectRatio: true,
  }
);
```

### 배치 처리 테스트

```typescript
// 10개 파일 배치 처리
const files = [
  'C:/input/photo1.jpg',
  'C:/input/photo2.png',
  // ... 8개 더
];

const result = await imageProcessor.processBatch(
  files,
  'C:/output',
  { format: 'webp', quality: 80 },
  (progress) => {
    console.log(`진행률: ${progress.overallProgress}%`);
    console.log(`완료: ${progress.completed}, 실패: ${progress.failed}`);
  }
);
```

### 포맷별 테스트

```typescript
// WebP (빠름)
{ format: 'webp', quality: 80, compressionLevel: 6 }

// AVIF (최고 압축, 느림)
{ format: 'avif', quality: 80, compressionLevel: 9 }

// JPG (범용)
{ format: 'jpg', quality: 90 }

// PNG (무손실)
{ format: 'png', quality: 100, compressionLevel: 9 }
```

---

## 🚦 제한사항

### 현재 구현된 제한

| 항목 | 제한 | 비고 |
|------|------|------|
| 동시 처리 | 4개 | MAX_CONCURRENT |
| 최대 파일 크기 | 50MB | AppConfig 설정 |
| 지원 포맷 | 12개 | 입력 포맷 |
| 출력 포맷 | 7개 | WebP, AVIF 등 |

### 향후 개선 사항

1. **동적 동시 처리 제한**: CPU 코어 수에 따라 자동 조절
2. **프리뷰 생성**: 변환 전 미리보기 기능
3. **메타데이터 보존**: EXIF, IPTC 등 메타데이터 유지
4. **워터마크**: 이미지에 워터마크 추가
5. **일괄 리네임**: 파일명 자동 변경 규칙

---

## 📚 관련 문서

- [UI/UX 가이드](ui-ux-guide.md) - React 컴포넌트 구조
- [구독 등급별 기능](subscription-tiers.md) - Free/Basic/Pro 기능 차이
- [코딩 컨벤션](../development/conventions.md) - 코드 스타일 가이드

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**버전**: v0.1.0 (Phase 2 완료)
