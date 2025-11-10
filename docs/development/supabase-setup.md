# Supabase 설정 가이드

Supabase 프로젝트 생성 및 초기 설정 방법을 안내합니다.

---

## 📋 목차

1. [Supabase 프로젝트 생성](#1-supabase-프로젝트-생성)
2. [API 키 확인](#2-api-키-확인)
3. [데이터베이스 스키마 생성](#3-데이터베이스-스키마-생성)
4. [환경 변수 설정](#4-환경 변수-설정)
5. [연결 테스트](#5-연결-테스트)

---

## 1. Supabase 프로젝트 생성

### 1.1 회원가입 및 로그인
1. https://supabase.com 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인 (권장)

### 1.2 새 프로젝트 생성
1. **Organization**: 개인 계정 선택 (또는 새로 생성)
2. **Project Name**: `thekadang-pixelbooster`
3. **Database Password**: 강력한 비밀번호 생성 ⚠️ **반드시 저장!**
4. **Region**: `Northeast Asia (Seoul)` 선택
5. **Pricing Plan**: `Free` 선택
6. "Create new project" 클릭

### 1.3 프로젝트 생성 대기
- 약 2-3분 소요
- 프로젝트가 "Active" 상태가 될 때까지 대기

---

## 2. API 키 확인

### 2.1 프로젝트 URL 및 API 키 복사

1. **Settings > API** 메뉴로 이동
2. 다음 값들을 복사:

   ```
   Project URL: https://your-project-id.supabase.co
   anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   ⚠️ **주의**:
   - `anon public` 키: 클라이언트에서 사용 (공개 가능)
   - `service_role` 키: 서버에서만 사용 (절대 노출 금지!)

### 2.2 데이터베이스 연결 문자열 복사

1. **Settings > Database** 메뉴로 이동
2. **Connection string** 섹션에서 **URI** 형식 선택
3. `[YOUR-PASSWORD]`를 실제 비밀번호로 변경하여 복사

   ```
   postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres
   ```

---

## 3. 데이터베이스 스키마 생성

### 3.1 SQL Editor 열기
1. Supabase 대시보드에서 **SQL Editor** 메뉴 클릭
2. "New query" 버튼 클릭

### 3.2 마이그레이션 SQL 실행

1. 프로젝트 루트의 `supabase/migrations/20251110_initial_schema.sql` 파일 열기
2. 전체 내용 복사
3. SQL Editor에 붙여넣기
4. "Run" 버튼 클릭 (또는 `Ctrl+Enter`)

### 3.3 실행 결과 확인

성공 시 다음 메시지가 표시됩니다:
```
Success. No rows returned.
```

**생성된 테이블 확인**:
1. **Table Editor** 메뉴로 이동
2. 다음 테이블들이 생성되었는지 확인:
   - `subscriptions`
   - `registered_devices`
   - `affiliates`
   - `affiliate_referrals`
   - `revenue_logs`
   - `subscription_tiers`
   - `feature_flags`
   - `user_events`
   - `abuse_prevention`

**초기 데이터 확인**:
1. `subscription_tiers` 테이블 클릭
2. 3개의 구독 등급이 생성되었는지 확인:
   - Free
   - Basic
   - Pro

---

## 4. 환경 변수 설정

### 4.1 .env 파일 생성

프로젝트 루트에 `.env` 파일 생성:

```bash
# 프로젝트 루트에서 실행
cp .env.example .env
```

### 4.2 환경 변수 입력

`.env` 파일을 열어 다음 값들을 입력:

```env
# Supabase 프로젝트 URL
SUPABASE_URL=https://your-project-id.supabase.co

# Supabase anon (public) 키
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service_role 키 (절대 노출 금지!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 데이터베이스 연결 문자열
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# 환경 설정
NODE_ENV=development
```

⚠️ **보안 주의사항**:
- `.env` 파일은 **절대 Git에 커밋하지 않습니다**
- `.gitignore`에 `.env`가 포함되어 있는지 확인
- `service_role` 키는 서버 코드에서만 사용

---

## 5. 연결 테스트

### 5.1 테스트 스크립트 생성

`test-supabase-connection.js` 파일 생성:

```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Supabase 연결 테스트 시작...\n');

  try {
    // 1. 연결 테스트
    console.log('1. 프로젝트 URL:', supabaseUrl);

    // 2. 구독 등급 조회 테스트
    const { data: tiers, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('❌ 오류 발생:', error.message);
      return;
    }

    console.log('✅ 연결 성공!');
    console.log('\n📊 구독 등급 목록:');
    tiers.forEach(tier => {
      console.log(`  - ${tier.display_name.ko}: $${tier.price_monthly || 0}/월`);
    });

  } catch (error) {
    console.error('❌ 연결 실패:', error.message);
  }
}

testConnection();
```

### 5.2 의존성 설치

```bash
npm install @supabase/supabase-js dotenv
```

### 5.3 테스트 실행

```bash
node test-supabase-connection.js
```

**예상 결과**:
```
🔍 Supabase 연결 테스트 시작...

1. 프로젝트 URL: https://your-project-id.supabase.co
✅ 연결 성공!

📊 구독 등급 목록:
  - 무료: $0/월
  - 베이직: $9.99/월
  - 프로: $19.99/월
```

---

## 📌 다음 단계

연결 테스트가 성공하면:
1. ✅ Supabase 프로젝트 준비 완료
2. ✅ 데이터베이스 스키마 생성 완료
3. ✅ 환경 변수 설정 완료

**다음 작업**:
- [ ] Electron 프로젝트 초기화
- [ ] 클라이언트 기본 구조 생성
- [ ] ImageProcessor 코어 로직 구현

---

## 🔧 문제 해결

### 오류 1: "Invalid API key"
- **원인**: API 키가 잘못 입력됨
- **해결**: `.env` 파일의 API 키 재확인

### 오류 2: "relation does not exist"
- **원인**: 테이블이 생성되지 않음
- **해결**: SQL 마이그레이션 파일 재실행

### 오류 3: "password authentication failed"
- **원인**: 데이터베이스 비밀번호 오류
- **해결**: `DATABASE_URL`의 비밀번호 재확인

---

## 📚 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
