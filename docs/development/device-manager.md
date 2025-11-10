# DeviceManager - 기기 인증 시스템

기기 ID 생성, 저장, 검증 및 등급별 기기 한도 관리를 담당하는 서비스입니다.

---

## 📋 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [DeviceManager 클래스](#devicemanager-클래스)
4. [Edge Function](#edge-function)
5. [UI 컴포넌트](#ui-컴포넌트)
6. [테스트 가이드](#테스트-가이드)
7. [문제 해결](#문제-해결)

---

## 개요

### 목적
- **계정 공유 방지**: 한 계정을 여러 사용자가 공유하는 것을 방지
- **구독 등급별 제한**: Free 1대, Basic 2대, Pro 5대까지 등록 가능
- **기기 고유성 보장**: 하드웨어 시리얼, MAC 주소, OS 정보 조합으로 기기 식별

### 주요 기능
1. 기기 고유 ID 생성 (SHA-256 해시)
2. 기기 ID 로컬 저장 (암호화)
3. 로그인 시 기기 검증
4. 기기 한도 초과 처리
5. 기기 관리 UI

---

## 아키텍처

### 시스템 흐름

```
┌─────────────────┐
│  1. 로그인 시도  │
└────────┬────────┘
         │
         v
┌─────────────────────────────┐
│  DeviceManager.getDeviceId() │ - 기기 ID 생성/조회
└────────┬───────────────────┘
         │
         v
┌─────────────────────────────────────┐
│  Edge Function: login-with-device-check │
│  - 사용자 인증                            │
│  - 구독 등급 조회                          │
│  - 등급별 기기 한도 확인                    │
│  - 기존 기기 확인                          │
│  - 새 기기 등록 (한도 내)                  │
└────────┬──────────────────────────────┘
         │
    ┌────v────┐
    │ 한도 내?  │
    └─┬────┬──┘
      │    │
   Yes│    │No
      │    │
      v    v
   로그인  기기 한도
   성공   초과 모달
```

### 파일 구조

```
client/src/services/
├── device-manager.ts          # 기기 ID 생성 및 관리
├── auth-manager.ts            # 로그인 시 기기 검증 통합
└── secure-storage.ts          # 기기 ID 암호화 저장

client/src/components/
├── LoginForm.jsx              # 로그인 폼 (기기 한도 처리)
└── DeviceLimitModal.jsx       # 기기 한도 초과 모달

supabase/functions/
└── login-with-device-check/
    └── index.ts               # Edge Function (서버 측 검증)
```

---

## DeviceManager 클래스

### 기기 ID 생성

**파일**: `client/src/services/device-manager.ts`

```typescript
class DeviceManager {
  generateDeviceId(): string {
    // 1. 하드웨어 시리얼 번호 (Windows: MachineGuid, macOS: IOPlatformUUID)
    const machineId = machineIdSync(true);

    // 2. MAC 주소 (첫 번째 실제 네트워크 인터페이스)
    const nets = networkInterfaces();
    const mac = Object.values(nets)
      .flat()
      .find(net => net && !net.internal && net.mac !== '00:00:00:00:00:00')
      ?.mac || 'unknown-mac';

    // 3. OS 정보
    const platform = process.platform; // 'win32', 'darwin', 'linux'
    const arch = process.arch;         // 'x64', 'arm64'
    const osInfo = `${platform}-${arch}`;

    // 4. 조합하여 SHA-256 해시
    const combined = `${machineId}-${mac}-${osInfo}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    return hash; // 64자 16진수 문자열
  }
}
```

**특징**:
- **견고성**: 3가지 정보 조합 (하드웨어 시리얼, MAC, OS)
- **보안**: SHA-256 해시로 원본 정보 보호
- **플랫폼 독립성**: Windows, macOS, Linux 모두 지원

### 기기 이름 생성

```typescript
generateDeviceName(): string {
  const hostname = require('os').hostname();
  const platform = process.platform;

  let deviceType = 'Unknown Device';

  switch (platform) {
    case 'win32':
      deviceType = 'Windows PC';
      break;
    case 'darwin':
      deviceType = 'MacBook';
      break;
    case 'linux':
      deviceType = 'Linux Workstation';
      break;
  }

  return `${deviceType} (${hostname})`;
  // 예: "Windows PC (DESKTOP-ABC123)"
}
```

### 기기 ID 저장 및 조회

```typescript
async getDeviceId(): Promise<string> {
  // 1. 로컬에서 조회
  let deviceId = SecureStorage.getDeviceId();

  // 2. 없으면 생성 및 저장
  if (!deviceId) {
    deviceId = this.generateDeviceId();
    SecureStorage.setDeviceId(deviceId);
  }

  return deviceId;
}
```

---

## Edge Function

### login-with-device-check

**파일**: `supabase/functions/login-with-device-check/index.ts`

#### 처리 흐름

```typescript
// 1. 입력 검증
const { email, password, deviceId, deviceName } = await req.json();

// 2. 사용자 인증
const { data: authData, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// 3. 구독 등급 조회
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('tier, status, expires_at')
  .eq('user_id', authData.user.id)
  .single();

const tier = subscription?.tier || 'free';

// 4. 등급별 기기 한도
const deviceLimits = { free: 1, basic: 2, pro: 5 };
const maxDevices = deviceLimits[tier];

// 5. 기존 기기 확인
const { data: existingDevice } = await supabase
  .from('registered_devices')
  .select('*')
  .eq('user_id', authData.user.id)
  .eq('device_id', deviceId)
  .single();

if (existingDevice) {
  // 기존 기기 - 로그인 허용
  return Response(JSON.stringify({ success: true, token, ... }));
}

// 6. 새 기기 - 한도 확인
const { count } = await supabase
  .from('registered_devices')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', authData.user.id);

if (count >= maxDevices) {
  // 한도 초과
  return Response(JSON.stringify({
    error: 'Device limit exceeded',
    message: `기기 한도 초과: ${tier} 플랜은 최대 ${maxDevices}대까지`,
  }), { status: 403 });
}

// 7. 새 기기 등록
await supabase.from('registered_devices').insert({
  user_id: authData.user.id,
  device_id: deviceId,
  device_name: deviceName,
});

// 8. 성공 응답
return Response(JSON.stringify({ success: true, token, ... }));
```

#### 응답 형식

**성공 (기존 기기)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "...",
  "user": { "id": "...", "email": "..." },
  "subscription": {
    "tier": "basic",
    "status": "active",
    "expires_at": "2025-12-31T23:59:59Z"
  },
  "device": {
    "isNew": false,
    "deviceId": "...",
    "deviceName": "MacBook Pro",
    "registeredAt": "2025-11-10T10:00:00Z"
  }
}
```

**성공 (새 기기)**:
```json
{
  "success": true,
  "message": "로그인 성공 (새 기기 등록)",
  "device": {
    "isNew": true,
    ...
  }
}
```

**실패 (기기 한도 초과)**:
```json
{
  "error": "Device limit exceeded",
  "message": "기기 한도 초과: free 플랜은 최대 1대까지 등록 가능합니다.",
  "details": {
    "tier": "free",
    "maxDevices": 1,
    "currentDevices": 1
  }
}
```

---

## UI 컴포넌트

### DeviceLimitModal

**파일**: `client/src/components/DeviceLimitModal.jsx`

#### Props

```typescript
interface DeviceLimitModalProps {
  tier: 'free' | 'basic' | 'pro';
  maxDevices: number;
  currentDevices: number;
  onClose: () => void;
  onUpgrade: () => void;
}
```

#### 화면 구성

```
┌───────────────────────────────────────┐
│  🚫 기기 한도 초과                     │
│  ─────────────────────────────────   │
│                                       │
│  현재 FREE 플랜은 최대 1대까지         │
│  등록할 수 있습니다.                   │
│                                       │
│  현재 등록된 기기: 1대                 │
│  최대 허용 기기: 1대                   │
│                                       │
│  [해결 방법]                          │
│                                       │
│  1. 기존 기기 제거                     │
│     웹사이트에서 사용하지 않는          │
│     기기를 제거하세요.                 │
│     → 기기 관리 페이지 열기            │
│                                       │
│  2. 플랜 업그레이드                    │
│     Basic 플랜으로 업그레이드하면      │
│     2대까지 등록할 수 있습니다.        │
│     [Basic 플랜 업그레이드 ($9.99/월)] │
│                                       │
│  [닫기]                               │
└───────────────────────────────────────┘
```

### LoginForm 통합

```jsx
// LoginForm.jsx
const [deviceLimitError, setDeviceLimitError] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();

  const result = await ipcRenderer.invoke('auth-sign-in', { email, password });

  if (!result.success) {
    if (result.error.includes('기기 한도')) {
      // 기기 한도 초과 모달 표시
      setDeviceLimitError({
        tier: result.tier,
        maxDevices: result.maxDevices,
        currentDevices: result.currentDevices,
      });
    } else {
      setError(result.error);
    }
  }
};
```

---

## 테스트 가이드

### 1. 기기 ID 생성 테스트

```typescript
// DeviceManager 단위 테스트
const deviceId = await DeviceManager.getDeviceId();

console.log('Device ID:', deviceId);
// 출력: abc123def456... (64자 16진수)

// 동일 기기에서 재실행 시 동일한 ID 반환
const deviceId2 = await DeviceManager.getDeviceId();
assert(deviceId === deviceId2);
```

### 2. 로그인 및 기기 등록 테스트

**테스트 시나리오**:

1. **Free 사용자 - 첫 로그인**
   - ✅ 새 기기 등록
   - ✅ 로그인 성공

2. **Free 사용자 - 같은 기기에서 재로그인**
   - ✅ 기존 기기 인식
   - ✅ 로그인 성공

3. **Free 사용자 - 다른 기기에서 로그인**
   - ❌ 기기 한도 초과
   - ❌ 로그인 실패
   - ✅ DeviceLimitModal 표시

4. **Basic 사용자 - 두 번째 기기 로그인**
   - ✅ 새 기기 등록
   - ✅ 로그인 성공

5. **Basic 사용자 - 세 번째 기기 로그인**
   - ❌ 기기 한도 초과

### 3. Edge Function 로컬 테스트

```bash
# Supabase 로컬 환경 시작
supabase start

# Edge Function 실행
supabase functions serve login-with-device-check

# 테스트 요청
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/login-with-device-check' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "password": "password123",
    "deviceId": "test-device-id-abc",
    "deviceName": "Test Device"
  }'
```

---

## 문제 해결

### 문제 1: 기기 ID가 변경됨

**원인**: MAC 주소 또는 하드웨어 시리얼이 변경됨
- OS 재설치
- 네트워크 인터페이스 교체
- 가상 머신 복제

**해결**:
- 사용자가 웹사이트에서 기기 제거 후 재로그인
- 관리자가 DB에서 기기 삭제

### 문제 2: 기기 한도 초과 모달이 나타나지 않음

**확인 사항**:
1. Edge Function이 배포되었는지 확인
2. LoginForm에서 에러 메시지에 "기기 한도" 문자열이 포함되는지 확인
3. 브라우저 콘솔에서 에러 확인

### 문제 3: Edge Function 호출 실패

**확인 사항**:
1. Supabase URL 및 anon key가 `.env`에 설정되었는지 확인
2. Edge Function이 배포되었는지 확인
3. CORS 헤더가 올바른지 확인
4. Supabase 로그 확인:
   ```bash
   supabase functions logs login-with-device-check
   ```

---

## 향후 개선 사항

1. **기기 관리 UI**: 웹사이트에서 기기 목록 조회 및 삭제 기능
2. **기기 이름 편집**: 사용자가 기기 이름을 직접 설정
3. **기기 활동 로그**: 마지막 로그인 시간, IP 주소 기록
4. **의심스러운 활동 감지**: 짧은 시간에 다수 기기 등록 시 알림
5. **2FA (Two-Factor Authentication)**: 보안 강화

---

## 참고 문서

- [보안 아키텍처](../architecture/security-architecture.md)
- [API 명세: 인증](../api/auth-api.md)
- [Edge Functions 배포 가이드](./edge-functions-deploy.md)
- [데이터베이스 스키마](../architecture/database-schema.md)

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
**담당자**: 백엔드 개발자
