# 관리자 대시보드

더카당 픽셀부스터의 관리자 대시보드(Web) 설계 및 구현 가이드입니다.

---

## 📌 개요

관리자 대시보드는 운영자가 사용자, 수익, 어필리에이트를 효율적으로 관리할 수 있는 웹 기반 관리 시스템입니다.

### 핵심 목표
- **사용자 관리**: 구독 상태 조회 및 권한 부여/회수
- **수익 분석**: 일별/월별/사용자별 수익 통계
- **어필리에이트 관리**: 파트너 수수료율 조정 및 성과 분석
- **어뷰징 감지**: 의심스러운 행위 자동 탐지 및 대응

---

## 🏗️ 시스템 아키텍처

### 기술 스택

- **프론트엔드**: React 19 + TypeScript
- **UI 라이브러리**: Tailwind CSS + shadcn/ui
- **상태 관리**: React Query (TanStack Query)
- **라우팅**: React Router v6
- **차트**: Recharts
- **인증**: Supabase Auth (Admin Role)

### 폴더 구조

```
admin/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx           # 대시보드 홈
│   │   ├── UserManagement.tsx      # 사용자 관리
│   │   ├── RevenueManagement.tsx   # 수익 관리
│   │   └── AffiliateManagement.tsx # 어필리에이트 관리
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AdminLayout.tsx     # 레이아웃
│   │   │   ├── Sidebar.tsx         # 사이드바
│   │   │   └── Header.tsx          # 헤더
│   │   ├── Users/
│   │   │   ├── UserTable.tsx       # 사용자 테이블
│   │   │   ├── UserDetailModal.tsx # 상세 정보
│   │   │   └── GrantSubscriptionModal.tsx # 구독 부여
│   │   ├── Revenue/
│   │   │   ├── RevenueChart.tsx    # 수익 차트
│   │   │   └── RevenueStats.tsx    # 통계 카드
│   │   └── Affiliates/
│   │       ├── AffiliateTable.tsx  # 파트너 테이블
│   │       └── CommissionModal.tsx # 수수료 조정
│   ├── hooks/
│   │   ├── useUsers.ts             # 사용자 조회
│   │   ├── useRevenue.ts           # 수익 조회
│   │   └── useAffiliates.ts        # 어필리에이트 조회
│   ├── services/
│   │   └── supabase.ts             # Supabase 클라이언트
│   ├── types/
│   │   └── index.ts                # 타입 정의
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

---

## 🎨 페이지 구성

### 1. 대시보드 홈 (Dashboard.tsx)

**경로**: `/admin/dashboard`

**주요 지표 카드** (4개):
- **총 사용자 수**: 전체 가입자
- **활성 구독자**: Free 제외 (Basic + Pro)
- **이번 달 수익**: 당월 총 매출
- **총 누적 수익**: 전체 기간 매출

**차트**:
- **수익 추이 그래프** (Line Chart): 최근 6개월 월별 수익
- **구독 등급 분포** (Pie Chart): Free vs Basic vs Pro 비율

**최근 활동**:
- 최근 가입자 5명
- 최근 구독 변경 5건
- 최근 결제 실패 알림

**디자인 레이아웃**:
```
┌───────────────────────────────────────────────────────┐
│  📊 대시보드                            [로그아웃]     │
├───────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │총사용자  │ │활성구독  │ │이번달수익│ │총누적수익│    │
│  │  1,234  │ │   567   │ │ $1,234 │ │ $45,678│     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
├───────────────────────────────────────────────────────┤
│  📈 수익 추이                  🥧 구독 등급 분포      │
│  [Line Chart: 6개월]         [Pie Chart: Free/Basic/Pro] │
├───────────────────────────────────────────────────────┤
│  📋 최근 활동                                         │
│  - 2025-11-10 12:34: user@example.com 가입 (Free)   │
│  - 2025-11-10 12:20: admin@admin.com → Pro 부여      │
│  - 2025-11-10 11:45: partner@site.com 결제 성공 ($19.99) │
└───────────────────────────────────────────────────────┘
```

---

### 2. 사용자 관리 (UserManagement.tsx)

**경로**: `/admin/users`

**기능**:
- 전체 사용자 목록 조회
- 검색: 이메일, 이름
- 필터링: 구독 등급 (Free/Basic/Pro), 상태 (Active/Expired/Cancelled)
- 정렬: 가입일, 구독 만료일, 이름
- 페이지네이션: 20명씩

**테이블 컬럼**:
| 이메일 | 이름 | 구독 등급 | 구독 상태 | 만료일 | 가입일 | 액션 |
|--------|------|----------|----------|--------|--------|------|
| user@example.com | John Doe | Pro | Active | 2025-12-10 | 2025-01-15 | [보기] [수정] |

**액션**:
- **보기**: 상세 정보 모달 (기기 목록, 결제 이력)
- **수정**: 구독 등급 변경 (Free → Basic → Pro)
- **권한 부여**: 관리자가 직접 구독 선물
- **권한 회수**: 구독 취소 (즉시 만료)

**구독 부여 모달**:
```
┌─────────────────────────────────────┐
│  🎁 구독 선물하기                    │
├─────────────────────────────────────┤
│  사용자: user@example.com           │
│  현재 등급: Free                     │
│                                     │
│  선물할 등급: [Pro ▼]               │
│  기간: [1개월 ▼] [3개월] [1년]     │
│  사유: [테스트 사용자_____]         │
│                                     │
│  만료일: 2025-12-10 (자동 계산)     │
│                                     │
│  [취소] [선물하기]                  │
└─────────────────────────────────────┘
```

---

### 3. 수익 관리 (RevenueManagement.tsx)

**경로**: `/admin/revenue`

**주요 통계 카드** (6개):
- **이번 달 총 수익**: $1,234.56
- **이번 달 순수익**: $987.65 (수수료 제외)
- **평균 ARPU**: $12.34 (사용자당 평균 수익)
- **전월 대비 증가율**: +15.2%
- **환불 건수**: 2건
- **이탈률**: 3.5%

**수익 추이 차트**:
- **Line Chart**: 월별 수익 (최근 12개월)
- **Bar Chart**: 등급별 수익 (Free/Basic/Pro)
- **Area Chart**: 누적 수익

**일별 수익 테이블**:
| 날짜 | 총 수익 | 순수익 | 결제 건수 | 환불 건수 |
|------|---------|--------|----------|----------|
| 2025-11-10 | $45.99 | $32.19 | 3 | 0 |
| 2025-11-09 | $78.90 | $55.23 | 5 | 1 |

**사용자별 수익 테이블**:
| 사용자 | 구독 등급 | 이번 달 결제 | 총 결제 | 가입일 |
|--------|----------|------------|---------|--------|
| user@example.com | Pro | $19.99 | $239.88 | 2024-01-15 |

---

### 4. 어필리에이트 관리 (AffiliateManagement.tsx)

**경로**: `/admin/affiliates`

**주요 통계 카드** (4개):
- **총 파트너 수**: 45명
- **활성 파트너 수**: 32명 (최근 30일 활동)
- **이번 달 지급 수수료**: $456.78
- **총 누적 수수료**: $12,345.67

**파트너 성과 순위** (Top 10):
| 순위 | 파트너 이메일 | 추천 수 | 활성 구독 | 이번 달 수익 | 총 수익 | 수수료율 |
|------|--------------|---------|----------|-------------|---------|---------|
| 1 | partner1@site.com | 25 | 20 | $123.45 | $1,234.56 | 30% |
| 2 | partner2@blog.com | 18 | 15 | $89.90 | $890.00 | 35% |

**액션**:
- **수수료율 조정**: 30% → 35% (개별 설정)
- **추적 링크 확인**: `https://pixelbooster.com?ref=ABC123`
- **파트너 비활성화**: 어뷰징 감지 시

**수수료율 조정 모달**:
```
┌─────────────────────────────────────┐
│  💰 수수료율 조정                    │
├─────────────────────────────────────┤
│  파트너: partner1@site.com          │
│  현재 수수료율: 30%                  │
│                                     │
│  새 수수료율: [35__]%               │
│  조정 사유: [성과 우수_____]        │
│                                     │
│  ⚠️ 변경 즉시 적용됩니다.           │
│                                     │
│  [취소] [적용하기]                  │
└─────────────────────────────────────┘
```

---

## 🔐 인증 및 권한

### 관리자 인증

**Supabase RLS 정책**:
```sql
-- 관리자 전용 테이블 접근
CREATE POLICY "Only admins can access"
  ON subscriptions FOR ALL
  USING (
    auth.role() = 'service_role'
    OR
    auth.uid() IN (
      SELECT id FROM auth.users WHERE email LIKE '%@admin.pixelbooster.com'
    )
  );
```

**로그인 플로우**:
1. 관리자가 이메일/비밀번호로 로그인
2. Supabase Auth에서 토큰 발급
3. `auth.users` 테이블에서 role 확인 (admin 여부)
4. RLS 정책에 따라 관리자 데이터 접근 허용

**프론트엔드 라우터 가드**:
```typescript
// src/App.tsx
import { useAuth } from './hooks/useAuth';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/admin/login" />;
  if (!isAdmin) return <Navigate to="/unauthorized" />;

  return <>{children}</>;
}
```

---

## 📊 API 엔드포인트

### 1. 사용자 관리

**GET `/admin/users`**
```json
{
  "page": 1,
  "limit": 20,
  "filter": {
    "tier": "pro",
    "status": "active"
  }
}

Response:
{
  "success": true,
  "data": {
    "users": [...],
    "total": 123,
    "page": 1
  }
}
```

**POST `/admin/grant-subscription`**
```json
{
  "userId": "uuid",
  "tier": "pro",
  "duration": "1_month",
  "reason": "Beta tester"
}

Response:
{
  "success": true,
  "data": {
    "subscriptionId": "uuid",
    "expiresAt": "2025-12-10T00:00:00Z"
  }
}
```

---

### 2. 수익 관리

**GET `/admin/revenue/stats`**
```json
{
  "startDate": "2025-11-01",
  "endDate": "2025-11-30"
}

Response:
{
  "success": true,
  "data": {
    "totalRevenue": 1234.56,
    "netRevenue": 987.65,
    "avgARPU": 12.34,
    "refundCount": 2,
    "churnRate": 0.035
  }
}
```

**GET `/admin/revenue/daily`**
```json
{
  "month": "2025-11"
}

Response:
{
  "success": true,
  "data": [
    {
      "date": "2025-11-01",
      "totalRevenue": 45.99,
      "netRevenue": 32.19,
      "paymentCount": 3,
      "refundCount": 0
    },
    ...
  ]
}
```

---

### 3. 어필리에이트 관리

**GET `/admin/affiliates`**
```json
{
  "page": 1,
  "limit": 20,
  "sortBy": "total_revenue",
  "order": "desc"
}

Response:
{
  "success": true,
  "data": {
    "affiliates": [
      {
        "id": "uuid",
        "email": "partner1@site.com",
        "trackingCode": "ABC123",
        "commissionRate": 30.00,
        "referralCount": 25,
        "activeSubscriptions": 20,
        "thisMonthRevenue": 123.45,
        "totalRevenue": 1234.56
      },
      ...
    ],
    "total": 45
  }
}
```

**PATCH `/admin/affiliates/:id/commission`**
```json
{
  "newCommissionRate": 35.00,
  "reason": "성과 우수"
}

Response:
{
  "success": true,
  "data": {
    "affiliateId": "uuid",
    "oldRate": 30.00,
    "newRate": 35.00
  }
}
```

---

## 🔍 어뷰징 감지 시스템

### 감지 규칙

1. **동일 IP 다중 가입**
   - 24시간 내 동일 IP에서 5회 이상 회원가입
   - severity: `medium`

2. **즉시 취소 패턴**
   - 구독 후 24시간 이내 취소 (환불 요청)
   - severity: `high`

3. **기기 한도 초과 시도**
   - 1시간 내 10회 이상 기기 등록 시도
   - severity: `critical`

4. **추천 순환 (Circular Referral)**
   - 파트너 A → 사용자 B → 파트너 B → 사용자 A
   - severity: `high`

### 자동 대응

- **low**: 로그만 기록
- **medium**: 관리자 알림 + 로그
- **high**: 자동 계정 정지 (24시간) + 관리자 알림
- **critical**: 즉시 계정 차단 + 긴급 알림

### 어뷰징 대시보드

**위치**: `/admin/abuse`

**의심 활동 목록**:
| 날짜 | 사용자 | IP 주소 | 이벤트 | 심각도 | 상태 | 액션 |
|------|--------|---------|--------|--------|------|------|
| 2025-11-10 | user@suspicious.com | 123.456.789.0 | 동일 IP 다중 가입 | Medium | 미해결 | [확인] [정지] |
| 2025-11-09 | partner@fake.com | 111.222.333.0 | 순환 추천 | High | 해결됨 | [보기] |

---

## 🧪 테스트 시나리오

### 1. 구독 선물 플로우
```
1. 관리자가 user@example.com 검색
2. [수정] 버튼 클릭 → 구독 선물 모달 열기
3. Pro 등급, 1개월 선택, 사유 입력
4. [선물하기] 클릭
5. subscriptions 테이블 업데이트:
   - tier: 'pro'
   - status: 'active'
   - expires_at: +1 month
   - payment_method: 'admin_grant'
   - granted_by: admin_uuid
   - grant_reason: '테스트 사용자'
6. 사용자가 앱 재시작 시 Pro 기능 활성화
```

### 2. 수수료율 조정 플로우
```
1. 관리자가 어필리에이트 관리 페이지 진입
2. partner1@site.com [수수료율 조정] 클릭
3. 30% → 35% 변경, 사유: '성과 우수'
4. affiliates 테이블 업데이트:
   - commission_rate: 35.00
5. 다음 결제부터 35% 수수료 적용
```

### 3. 어뷰징 감지 플로우
```
1. 동일 IP (123.456.789.0)에서 24시간 내 6회 회원가입
2. 시스템이 자동으로 abuse_prevention 테이블에 기록:
   - event_type: 'multiple_signups_same_ip'
   - severity: 'medium'
   - is_resolved: false
3. 관리자 대시보드에 알림 표시
4. 관리자가 확인 후 [정지] 클릭
5. 해당 계정 status → 'suspended'
6. is_resolved → true, resolved_by → admin_uuid
```

---

## 📈 구현 우선순위

### Phase 1: 기본 관리 기능
- [ ] 프로젝트 초기화 (Vite + React + TypeScript)
- [ ] Supabase 연동 및 인증
- [ ] Dashboard 페이지 (통계 카드)
- [ ] UserManagement 페이지 (테이블)
- [ ] 구독 선물 기능

### Phase 2: 수익 분석
- [ ] RevenueManagement 페이지
- [ ] 수익 차트 (Recharts)
- [ ] 일별/월별 통계 API
- [ ] CSV 내보내기 기능

### Phase 3: 어필리에이트 관리
- [ ] AffiliateManagement 페이지
- [ ] 파트너 테이블
- [ ] 수수료율 조정 모달
- [ ] 추천 내역 상세 보기

### Phase 4: 어뷰징 감지
- [ ] 어뷰징 규칙 엔진
- [ ] 자동 대응 로직
- [ ] 어뷰징 대시보드
- [ ] 실시간 알림 시스템

---

## 🛠️ 구현 가이드

### Supabase 클라이언트 설정

**파일**: `admin/src/services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: true,
    storageKey: 'admin-auth',
    storage: window.localStorage
  }
});
```

---

### React Query Hook: useUsers

**파일**: `admin/src/hooks/useUsers.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export interface User {
  id: string;
  email: string;
  created_at: string;
  subscription: {
    tier: 'free' | 'basic' | 'pro';
    status: string;
    expires_at: string | null;
  };
}

export function useUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['users', page, limit],
    queryFn: async () => {
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const { data, error, count } = await supabase
        .from('auth.users')
        .select('*, subscriptions(*)', { count: 'exact' })
        .range(start, end)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        users: data,
        total: count || 0,
        page
      };
    }
  });
}
```

---

### 구독 선물 기능

**파일**: `admin/src/components/Users/GrantSubscriptionModal.tsx`

```typescript
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';

interface GrantSubscriptionRequest {
  userId: string;
  tier: 'basic' | 'pro';
  duration: '1_month' | '3_months' | '1_year';
  reason: string;
}

export function useGrantSubscription() {
  return useMutation({
    mutationFn: async (request: GrantSubscriptionRequest) => {
      const { userId, tier, duration, reason } = request;

      // 만료일 계산
      const durationMap = {
        '1_month': 30,
        '3_months': 90,
        '1_year': 365
      };
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationMap[duration]);

      // subscriptions 테이블 upsert
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          tier,
          status: 'active',
          expires_at: expiresAt.toISOString(),
          payment_method: 'admin_grant',
          granted_by: (await supabase.auth.getUser()).data.user?.id,
          grant_reason: reason
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  });
}
```

---

## 📚 참고 자료

- [React Query (TanStack Query)](https://tanstack.com/query/latest)
- [Recharts Documentation](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

**마지막 업데이트**: 2025-11-10
**작성자**: Claude Code
**상태**: 설계 완료 ✅
