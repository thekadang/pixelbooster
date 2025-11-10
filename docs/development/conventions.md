# 코딩 컨벤션

픽셀부스터 프로젝트의 코딩 스타일 및 명명 규칙을 정의합니다.

---

## 📌 핵심 원칙

1. **One Source of Truth** - 중복 금지, 모든 정보는 단일 출처
2. **Single Responsibility** - 함수/클래스는 하나의 책임만
3. **No Hard-coding** - 설정은 별도 파일로 관리
4. **Error Handling** - 모든 에러는 명확한 메시지와 함께 처리
5. **한글화** - 주석 및 문서는 한글, 코드는 영어

---

## 명명 규칙

### 파일명
```
kebab-case 사용

✅ 올바른 예시:
- image-processor.ts
- subscription-manager.ts
- user-management.tsx

❌ 잘못된 예시:
- ImageProcessor.ts (PascalCase)
- subscription_manager.ts (snake_case)
- UserManagement.tsx (컴포넌트 파일은 PascalCase 허용)
```

**예외**: React 컴포넌트 파일은 **PascalCase** 허용
```
✅ 컴포넌트 파일:
- HeaderBar.tsx
- DropZone.tsx
- SettingsPanel.tsx
```

### 변수 및 함수
```typescript
// camelCase 사용
const subscriptionTier = 'pro';
let deviceCount = 0;

function processImage(path: string) { }
async function fetchUserData() { }

✅ 올바른 예시:
- subscriptionManager
- imageProcessor
- getUserData()

❌ 잘못된 예시:
- SubscriptionManager (변수는 camelCase)
- image_processor (snake_case 금지)
- GetUserData() (함수는 camelCase)
```

### 클래스 및 타입
```typescript
// PascalCase 사용
class ImageProcessor { }
class SubscriptionManager { }

interface IUser { }
interface ISubscription { }

type SubscriptionTier = 'free' | 'basic' | 'pro';

✅ 올바른 예시:
- ImageProcessor
- IUser (인터페이스는 I prefix)
- SubscriptionTier

❌ 잘못된 예시:
- imageProcessor (클래스는 PascalCase)
- User (인터페이스는 I prefix)
- subscriptionTier (타입은 PascalCase)
```

### 상수
```typescript
// UPPER_SNAKE_CASE 사용
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_QUALITY = 80;

✅ 올바른 예시:
- MAX_FILE_SIZE
- API_BASE_URL
- DEFAULT_QUALITY

❌ 잘못된 예시:
- maxFileSize (상수는 UPPER_SNAKE_CASE)
- apiBaseUrl (상수는 UPPER_SNAKE_CASE)
```

---

## TypeScript 스타일

### 타입 정의

```typescript
// ✅ 인터페이스 사용 (확장 가능성)
interface IUser {
  id: string;
  email: string;
  createdAt: Date;
}

// ✅ 타입 별칭 사용 (유니온, 인터섹션)
type SubscriptionTier = 'free' | 'basic' | 'pro';
type ImageFormat = 'webp' | 'avif' | 'jpg' | 'png';

// ✅ Result 타입 패턴
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// 사용 예시
function processImage(path: string): Result<string> {
  try {
    // 로직
    return { success: true, data: outputPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 함수 정의

```typescript
// ✅ 화살표 함수 (간결한 경우)
const add = (a: number, b: number): number => a + b;

// ✅ 일반 함수 (복잡한 로직)
function processImage(
  inputPath: string,
  outputFormat: ImageFormat,
  quality: number = 80
): Promise<Result<string>> {
  // 복잡한 로직
}

// ✅ 비동기 함수
async function fetchUserData(userId: string): Promise<IUser | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  } catch (error) {
    console.error('사용자 조회 실패:', error);
    return null;
  }
}
```

### Enum vs Union Type

```typescript
// ❌ Enum 지양 (런타임 오버헤드)
enum SubscriptionTier {
  Free = 'free',
  Basic = 'basic',
  Pro = 'pro',
}

// ✅ Union Type 사용
type SubscriptionTier = 'free' | 'basic' | 'pro';

// ✅ 상수 객체 + Union Type
const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
} as const;

type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];
```

---

## 에러 처리

### Result 타입 패턴

```typescript
// ✅ 모든 중요한 함수는 Result 타입 반환
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function processImage(path: string): Promise<Result<string>> {
  try {
    // 로직
    return { success: true, data: outputPath };
  } catch (error) {
    return {
      success: false,
      error: `이미지 처리 실패: ${error.message}`,
    };
  }
}

// 사용 예시
const result = await processImage('/path/to/image.jpg');
if (result.success) {
  console.log('변환 완료:', result.data);
} else {
  console.error('변환 실패:', result.error);
}
```

### 에러 메시지

```typescript
// ✅ 명확한 한글 에러 메시지
throw new Error('이미지 파일을 찾을 수 없습니다.');
throw new Error('구독 등급이 부족합니다. Pro로 업그레이드하세요.');

// ✅ 에러 컨텍스트 포함
throw new Error(`파일 변환 실패: ${filePath} (${error.message})`);

// ❌ 모호한 메시지
throw new Error('Error');
throw new Error('Something went wrong');
```

---

## 주석 규칙

### 함수 주석 (JSDoc)

```typescript
/**
 * 이미지를 지정된 포맷으로 변환합니다.
 *
 * @param inputPath - 원본 이미지 파일 경로
 * @param outputFormat - 변환할 이미지 포맷
 * @param quality - 압축 품질 (0-100, 기본값: 80)
 * @returns 변환된 파일 경로 또는 에러 메시지
 *
 * @example
 * ```typescript
 * const result = await processImage('/path/to/image.jpg', 'webp', 80);
 * if (result.success) {
 *   console.log('변환 완료:', result.data);
 * }
 * ```
 */
async function processImage(
  inputPath: string,
  outputFormat: ImageFormat,
  quality: number = 80
): Promise<Result<string>> {
  // 구현
}
```

### 인라인 주석

```typescript
// ✅ 왜(Why)를 설명
// Sharp 라이브러리는 메모리 효율을 위해 스트림 방식 사용
const stream = sharp(inputPath).toFormat('webp');

// ✅ 복잡한 로직 설명
// 구독 등급에 따라 사용 가능한 포맷이 다르므로 검증 필요
if (!this.isFormatAllowed(format, tier)) {
  return { success: false, error: '사용할 수 없는 포맷입니다.' };
}

// ❌ 무엇(What)을 반복 (불필요)
// 변수에 값 할당
const tier = 'pro';
```

---

## 파일 구조

### Import 순서

```typescript
// 1. 외부 라이브러리
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import ExcelJS from 'exceljs';

// 2. 내부 모듈 (절대 경로)
import { AppConfig } from '@/config/app-config';
import { IUser, ISubscription } from '@/types';

// 3. 상대 경로
import { ImageProcessor } from './image-processor';
import { SubscriptionManager } from '../services/subscription-manager';

// 4. 스타일 (React 컴포넌트에서)
import './styles.css';
```

### Export 방식

```typescript
// ✅ Named Export 선호
export class ImageProcessor { }
export function processImage() { }

// ✅ Default Export (React 컴포넌트만)
export default function MainPage() {
  return <div>Main</div>;
}

// ❌ 혼용 지양
export default class ImageProcessor { }
export function processImage() { }
```

---

## React 컴포넌트

### 함수 컴포넌트

```typescript
// ✅ 화살표 함수 + TypeScript
interface HeaderBarProps {
  userName: string;
  onLogout: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ userName, onLogout }) => {
  return (
    <header>
      <span>{userName}</span>
      <button onClick={onLogout}>로그아웃</button>
    </header>
  );
};

export default HeaderBar;
```

### Hooks 순서

```typescript
function MyComponent() {
  // 1. useState
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  // 2. useContext
  const theme = useContext(ThemeContext);

  // 3. useReducer
  const [state, dispatch] = useReducer(reducer, initialState);

  // 4. useEffect
  useEffect(() => {
    // 로직
  }, []);

  // 5. 커스텀 훅
  const data = useCustomHook();

  // 6. 렌더링
  return <div>{count}</div>;
}
```

---

## 설정 파일 관리

### app-config.ts

```typescript
// ✅ 환경 변수를 한 곳에서 관리
export const AppConfig = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
  },
  subscription: {
    maxDevices: {
      free: 1,
      basic: 2,
      pro: 5,
    },
  },
  imageFormats: {
    free: ['webp'] as const,
    basic: ['webp', 'avif'] as const,
    pro: ['webp', 'avif', 'jpg', 'png', 'gif', 'bmp', 'tiff'] as const,
  },
  maxFileSize: 50 * 1024 * 1024, // 50MB
  defaultQuality: 80,
};

// ❌ 하드코딩
const maxDevices = 5;
const formats = ['webp', 'avif'];
```

---

## Git Commit 메시지

### 형식

```
<type>: <subject>

<body> (선택사항)
```

### Type 종류

- `feat`: 새 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가
- `chore`: 빌드/설정 변경
- `style`: 코드 스타일 변경 (포맷팅)

### 예시

```
✅ 좋은 예시:
feat: 이미지 WEBP 변환 기능 구현
fix: 로그인 시 기기 인증 오류 수정
docs: API 명세서 업데이트
refactor: ImageProcessor 클래스 분리

❌ 나쁜 예시:
update code
fix bug
change files
```

---

## Linting & Formatting

### ESLint 설정

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Prettier 설정

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

---

## 체크리스트

코드 작성 후 확인사항:

- [ ] 명명 규칙 준수 (camelCase, PascalCase, UPPER_SNAKE_CASE)
- [ ] 타입 정의 완료 (any 타입 사용 금지)
- [ ] 에러 처리 구현 (Result 타입 또는 try-catch)
- [ ] 주석 작성 (복잡한 로직에 대한 설명)
- [ ] 하드코딩 제거 (설정 파일 사용)
- [ ] Import 순서 정리
- [ ] ESLint/Prettier 통과

---

**참고 문서**:
- [개발 환경 설정](setup.md)
- [Git 워크플로우](git-workflow.md)
