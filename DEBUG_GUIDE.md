# 디버깅 가이드 - 기기 등록 오류 해결

기기 등록 오류를 디버깅하기 위한 단계별 가이드입니다.

---

## 🔧 개발 환경에서 디버깅

### 1단계: 개발 서버 실행

```bash
# 터미널 1: Webpack Dev Server
npm run dev:webpack

# 터미널 2: TypeScript 컴파일 감시
npm run watch:main

# 터미널 3: Electron 앱 실행
npm run dev:electron
```

### 2단계: 개발자 도구 확인

앱이 실행되면 **자동으로 DevTools가 열립니다** (임시로 활성화됨).

#### Console 탭에서 확인할 로그:

**정상 로그인 흐름**:
```
[AuthManager] Device info: { deviceId: '...', deviceName: 'Windows PC' }
[AuthManager] Calling Edge Function: https://yqkfgwzbxeliusukxigy.supabase.co/functions/v1/login-with-device-check
[AuthManager] Edge Function response status: 200
[AuthManager] Edge Function result: { token: '...', user: {...}, subscription: {...} }
[AuthManager] Login successful: { email: '...', tier: 'free', deviceId: '...', isNewDevice: true }
```

**오류 발생 시**:
```
[AuthManager] Edge Function response status: 401/500/etc
[AuthManager] Edge Function error: { status: 401, error: '...', message: '...', details: '...' }
```

#### Network 탭에서 확인:

1. **Filter**: `login-with-device-check` 입력
2. **Request Headers** 확인:
   - `Authorization: Bearer eyJhbGci...` (Supabase Anon Key)
   - `Content-Type: application/json`
3. **Request Payload** 확인:
   ```json
   {
     "email": "sw4916@naver.com",
     "password": "******",
     "deviceId": "abc123...",
     "deviceName": "Windows PC"
   }
   ```
4. **Response** 확인:
   - **200 OK**: 성공
   - **401 Unauthorized**: 이메일/비밀번호 오류
   - **403 Forbidden**: 기기 한도 초과
   - **500 Internal Server Error**: Edge Function 오류

---

## 🚨 일반적인 오류 원인 및 해결

### 오류 1: "서버에 연결할 수 없습니다"

**원인**:
- 인터넷 연결 문제
- Edge Function URL 잘못됨
- Supabase 서비스 장애

**확인 방법**:
1. 브라우저에서 직접 Edge Function URL 접근:
   ```
   https://yqkfgwzbxeliusukxigy.supabase.co/functions/v1/login-with-device-check
   ```
   → "Missing required fields" 에러가 나와야 정상 (POST 요청이 필요하므로)

2. `.env` 파일 확인:
   ```bash
   SUPABASE_URL=https://yqkfgwzbxeliusukxigy.supabase.co
   SUPABASE_ANON_KEY=eyJhbGci...
   ```

**해결 방법**:
- 인터넷 연결 확인
- `.env` 파일의 URL 및 API Key 재확인

---

### 오류 2: "이메일 또는 비밀번호가 올바르지 않습니다"

**원인**:
- 잘못된 이메일/비밀번호 입력
- 이메일 인증이 완료되지 않음
- Supabase Auth 설정 문제

**확인 방법**:
1. Supabase Dashboard → Authentication → Users
   - 해당 이메일이 등록되어 있는지 확인
   - `Email Confirmed` 상태 확인 (✅ 표시되어야 함)

2. Console에서 상세 오류 확인:
   ```
   [AuthManager] Edge Function error: {
     status: 401,
     error: 'Authentication failed',
     message: '이메일 또는 비밀번호가 올바르지 않습니다.',
     details: 'Email not confirmed'  ← 이메일 미인증
   }
   ```

**해결 방법**:
- 이메일 인증 완료 확인
- 비밀번호 재확인 (6자 이상)
- 비밀번호 재설정 시도

---

### 오류 3: "기기 한도를 초과했습니다"

**원인**:
- Free 계정 (1대 제한)에서 2대 이상 로그인 시도
- Basic 계정 (2대 제한)에서 3대 이상 로그인 시도

**확인 방법**:
1. Supabase Dashboard → SQL Editor에서 실행:
   ```sql
   SELECT user_id, device_id, device_name, created_at
   FROM registered_devices
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sw4916@naver.com');
   ```

2. Console 로그:
   ```
   [AuthManager] Edge Function error: {
     error: 'Device limit exceeded',
     message: '기기 한도를 초과했습니다. (현재: 1, 최대: 1)',
     tier: 'free',
     currentDevices: 1,
     maxDevices: 1
   }
   ```

**해결 방법**:
- 기존 기기 등록 해제:
  ```sql
  DELETE FROM registered_devices
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sw4916@naver.com')
  AND device_id = '<삭제할 기기 ID>';
  ```
- 구독 업그레이드 (Pro → 5대)

---

### 오류 4: "서버 응답 파싱 실패"

**원인**:
- Edge Function이 JSON이 아닌 HTML 에러 페이지 반환
- Edge Function이 배포되지 않음
- CORS 문제

**확인 방법**:
1. Network 탭 → Response 탭 확인:
   - JSON 형식인지 확인
   - HTML 에러 페이지가 나오면 Edge Function 미배포

2. Supabase Dashboard → Edge Functions 확인:
   - `login-with-device-check` 함수가 배포되어 있는지 확인

**해결 방법**:
```bash
# Edge Function 재배포
supabase functions deploy login-with-device-check
```

---

### 오류 5: "기기 등록 실패: fetch failed"

**원인**:
- 네트워크 타임아웃
- Supabase 서비스 일시적 장애
- 방화벽/프록시 차단

**확인 방법**:
1. 브라우저에서 Supabase URL 접근:
   ```
   https://yqkfgwzbxeliusukxigy.supabase.co
   ```
   → Supabase 로고 페이지가 나와야 정상

2. Console에서 네트워크 오류 확인:
   ```
   [AuthManager] Login error: TypeError: fetch failed
   ```

**해결 방법**:
- 인터넷 연결 재확인
- 방화벽 설정 확인 (Supabase 도메인 허용)
- VPN 사용 시 해제 후 재시도

---

## 📊 Edge Function 로그 확인

Supabase Dashboard에서 Edge Function 로그를 실시간으로 확인할 수 있습니다.

### Supabase Dashboard 로그

1. Supabase Dashboard → **Edge Functions**
2. `login-with-device-check` 클릭
3. **Logs** 탭 선택
4. 최근 요청 및 오류 확인

**정상 로그 예시**:
```
[login-with-device-check] Request: { email: 'sw4916@naver.com', deviceId: 'abc...', deviceName: 'Windows PC' }
[login-with-device-check] User authenticated: <user_id>
[login-with-device-check] User tier: free
[login-with-device-check] Existing device: <device_id>
```

**오류 로그 예시**:
```
[login-with-device-check] Auth error: { message: 'Invalid login credentials' }
[login-with-device-check] Subscription error: { code: 'PGRST116', message: 'no rows returned' }
[login-with-device-check] Device limit exceeded: { current: 1, max: 1 }
```

---

## 🔍 수동 테스트 (cURL)

Edge Function을 직접 호출하여 테스트할 수 있습니다:

```bash
curl -X POST \
  'https://yqkfgwzbxeliusukxigy.supabase.co/functions/v1/login-with-device-check' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxa2Znd3pieGVsaXVzdWt4aWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDQ4MzMsImV4cCI6MjA3ODI4MDgzM30.a4Sfz_yt5qaYAuU-JkswwUaZE14oOsL4TqvGxQ7j6mE' \
  -d '{
    "email": "sw4916@naver.com",
    "password": "your_password_here",
    "deviceId": "test-device-123",
    "deviceName": "Test Device"
  }'
```

**성공 응답** (200 OK):
```json
{
  "token": "eyJhbGci...",
  "refresh_token": "...",
  "user": { "id": "...", "email": "sw4916@naver.com" },
  "subscription": { "tier": "free", "status": "active" },
  "device": { "deviceId": "test-device-123", "isNew": true }
}
```

**실패 응답** (401 Unauthorized):
```json
{
  "error": "Authentication failed",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "details": "Invalid login credentials"
}
```

---

## 📝 체크리스트

문제 해결 전 확인사항:

- [ ] 인터넷 연결 정상
- [ ] `.env` 파일의 Supabase URL 및 API Key 정확
- [ ] Supabase Edge Function `login-with-device-check` 배포 완료
- [ ] 이메일 인증 완료 (Supabase Dashboard → Users 확인)
- [ ] 비밀번호 정확 (6자 이상)
- [ ] 기기 한도 확인 (Free: 1대, Basic: 2대, Pro: 5대)
- [ ] 개발자 도구 Console 로그 확인
- [ ] 개발자 도구 Network 탭에서 요청/응답 확인

---

## 🚀 다음 단계

1. **개발 환경 테스트**:
   ```bash
   npm run dev
   ```
   → DevTools Console 로그 확인
   → Network 탭에서 요청/응답 분석

2. **Edge Function 로그 확인**:
   - Supabase Dashboard → Edge Functions → login-with-device-check → Logs

3. **문제 해결 후 프로덕션 빌드**:
   ```bash
   npm run build:win
   ```

4. **DevTools 비활성화** (프로덕션 배포 전):
   - `client/main.ts:96-98` 주석 제거:
     ```typescript
     // 개발자 도구 자동 열기 (개발 환경에서만)
     if (isDevelopment) {
       mainWindow.webContents.openDevTools();
     }
     ```
