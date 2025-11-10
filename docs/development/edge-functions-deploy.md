# Edge Functions 배포 가이드

Supabase Edge Functions를 배포하고 관리하는 방법을 설명합니다.

---

## 📋 배포 순서

### 1단계: Supabase CLI 설치

```bash
# npm을 통한 설치
npm install -g supabase

# 또는 Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2단계: Supabase 프로젝트 연결

```bash
# 프로젝트 루트에서 실행
cd F:\The kadang\code_project\claude\thekadang_pixelbooster

# Supabase 로그인
supabase login

# 프로젝트 연결 (Project ID 필요)
supabase link --project-ref <YOUR_PROJECT_ID>

# Project ID 확인 방법:
# 1. Supabase 대시보드 접속
# 2. Settings > General > Reference ID
```

### 3단계: Edge Function 배포

```bash
# login-with-device-check 함수 배포
supabase functions deploy login-with-device-check

# 모든 함수 한번에 배포
supabase functions deploy

# 특정 함수만 배포 (여러 개)
supabase functions deploy function1 function2
```

### 4단계: 환경 변수 설정

Edge Functions는 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 환경 변수로 필요로 합니다.

```bash
# 환경 변수 설정 (자동으로 설정됨, 확인용)
supabase secrets list

# 필요 시 수동 설정
supabase secrets set SUPABASE_URL=<your-supabase-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 환경 변수 확인
supabase secrets list
```

---

## 🔍 배포 확인

### 함수 URL 확인

배포 후 함수 URL은 다음 형식입니다:

```
https://<PROJECT_REF>.supabase.co/functions/v1/login-with-device-check
```

### 로컬 테스트

로컬에서 Edge Function을 테스트할 수 있습니다:

```bash
# 로컬 Supabase 환경 시작
supabase start

# Edge Function 로컬 실행
supabase functions serve login-with-device-check

# 다른 터미널에서 테스트
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/login-with-device-check' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "password": "password123",
    "deviceId": "test-device-id-123",
    "deviceName": "Test Device"
  }'
```

### 프로덕션 테스트

```bash
# cURL을 사용한 프로덕션 테스트
curl -i --location --request POST \
  'https://<PROJECT_REF>.supabase.co/functions/v1/login-with-device-check' \
  --header 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "password": "password123",
    "deviceId": "abc123def456",
    "deviceName": "My MacBook Pro"
  }'
```

---

## 📝 로그 확인

### 실시간 로그 스트리밍

```bash
# 특정 함수 로그 확인
supabase functions logs login-with-device-check --follow

# 모든 함수 로그 확인
supabase functions logs --follow
```

### Supabase 대시보드에서 로그 확인

1. Supabase 대시보드 접속
2. **Edge Functions** 메뉴
3. **login-with-device-check** 선택
4. **Logs** 탭 확인

---

## 🔄 업데이트 및 재배포

### 코드 수정 후 재배포

```bash
# 1. 코드 수정
# 2. 재배포
supabase functions deploy login-with-device-check

# 3. 로그 확인
supabase functions logs login-with-device-check --follow
```

---

## 🛠️ 문제 해결

### 문제 1: "Project not linked"

```bash
# 해결: 프로젝트 연결
supabase link --project-ref <YOUR_PROJECT_ID>
```

### 문제 2: "Missing environment variables"

```bash
# 해결: 환경 변수 설정
supabase secrets set SUPABASE_URL=<your-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
```

### 문제 3: "Function invocation failed"

```bash
# 1. 로그 확인
supabase functions logs login-with-device-check

# 2. 로컬 테스트
supabase functions serve login-with-device-check
```

### 문제 4: CORS 오류

```typescript
// index.ts에서 CORS 헤더 확인
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 프로덕션에서는 특정 origin으로 제한
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

## 📦 함수 관리

### 함수 목록 확인

```bash
supabase functions list
```

### 함수 삭제

```bash
supabase functions delete login-with-device-check
```

---

## 🔒 보안 주의사항

### 1. service_role 키 보호

- `SUPABASE_SERVICE_ROLE_KEY`는 **절대 클라이언트 코드에 포함하지 마세요**.
- Edge Function 내부에서만 사용합니다.

### 2. CORS 설정

프로덕션에서는 CORS를 특정 origin으로 제한:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### 3. Rate Limiting

향후 Rate Limiting을 추가하여 API 남용 방지:

```typescript
// 예시: _shared/rate-limiter.ts 파일 생성
export function checkRateLimit(userId: string, endpoint: string): boolean {
  // 구현
}
```

---

## 📚 참고 문서

- [Supabase Edge Functions 공식 문서](https://supabase.com/docs/guides/functions)
- [Deno 공식 문서](https://deno.land/manual)
- [프로젝트 보안 아키텍처](../architecture/security-architecture.md)

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
**담당자**: 백엔드 개발자
