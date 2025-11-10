# MVP 개발 가이드

> 정기구독과 어필리에이트를 제외한 핵심 기능 중심의 MVP 버전 개발 가이드

**작성일**: 2025-11-10
**버전**: MVP v1.0
**목표 출시**: 4-6주 내

---

## 📋 목차

1. [MVP 범위 정의](#mvp-범위-정의)
2. [제외된 기능](#제외된-기능)
3. [구독 모델 변경](#구독-모델-변경)
4. [구독 검증 메커니즘](#구독-검증-메커니즘)
5. [업셀링 전략](#업셀링-전략)
6. [관리자 선물 기능](#관리자-선물-기능)
7. [개발 우선순위](#개발-우선순위)
8. [구현 가이드](#구현-가이드)

---

## MVP 범위 정의

### ✅ 포함되는 핵심 기능

#### 1. 사용자 인증
- [x] 이메일/비밀번호 회원가입 및 로그인
- [x] 이메일 인증
- [x] JWT 토큰 기반 인증
- [x] 비밀번호 재설정

#### 2. 이미지 변환
- [x] WebP 변환 (Free)
- [x] AVIF 변환 (Basic 이상)
- [x] 파일 단위 변환 (Free)
- [x] 폴더 단위 변환 (Basic 이상)
- [x] 배치 크기 제한 (Free: 10개, Basic: 50개, Pro: 200개)

#### 3. 기기 인증
- [x] 기기 ID 생성 및 등록
- [x] 등급별 기기 제한 (Free: 2대, Basic: 3대, Pro: 5대)
- [x] 기기 ID 변조 방지

#### 4. 등급별 기능 제한
- [x] Free: WebP만, 파일 단위, 백업/로그 없음
- [x] Basic: WebP + AVIF, 폴더 단위, 백업/로그 가능
- [x] Pro: 모든 포맷, 폴더 단위, 백업/로그/통계 가능

#### 5. 백업 및 로그 (Basic 이상)
- [x] 원본 파일 백업
- [x] Excel 작업 로그 생성
- [x] 하이퍼링크로 파일 연결

#### 6. 다국어 지원
- [x] 한국어/영어
- [x] OS 언어 자동 감지

#### 7. 관리자 대시보드
- [x] 사용자 목록 및 검색
- [x] 등급 수동 변경 (관리자 선물 기능)
- [x] 통계 대시보드 (사용자 수, 변환 횟수)

---

## 제외된 기능

### ❌ Phase 2 이후 구현 예정

#### 1. 정기구독 (Stripe 연동)
**제외 이유**: MVP는 관리자 수동 부여 방식으로 시작

**Phase 2 구현 계획**:
- Stripe Checkout 연동
- 자동 결제 갱신
- 구독 취소 및 환불
- 청구서 발행

**MVP 대체 방안**:
- 관리자 대시보드에서 수동으로 등급 부여
- `subscriptions` 테이블에 `granted_by` 컬럼 추가 (관리자 ID)
- `payment_method: 'admin_grant'` 설정

#### 2. 어필리에이트 시스템
**제외 이유**: 사용자 기반 확보 후 도입

**Phase 2 구현 계획**:
- 추천 코드 생성
- 쿠키 추적 로직
- 수수료 계산 및 지급
- 어필리에이트 대시보드

**MVP 대체 방안**:
- DB 테이블은 생성해두되 기능 비활성화
- UI에 "곧 출시 예정" 표시

#### 3. 고급 분석 기능
**제외 이유**: 기본 통계로 충분

**Phase 2 구현 계획**:
- 사용자 행동 분석
- 변환 패턴 분석
- A/B 테스트 결과 분석

#### 4. 자동 업데이트
**제외 이유**: 수동 다운로드로 시작

**Phase 2 구현 계획**:
- electron-updater 연동
- GitHub Releases 자동 배포
- 업데이트 알림 UI

---

## 구독 모델 변경

### 기존 설계 (Phase 2)
```
사용자 → Stripe Checkout → 자동 결제 → DB 업데이트
```

### MVP 설계
```
관리자 대시보드 → 수동 등급 부여 → DB 업데이트 → 클라이언트 동기화
```

### 데이터베이스 스키마 조정

#### subscriptions 테이블 (MVP 버전)
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT CHECK (tier IN ('free', 'basic', 'pro')) NOT NULL DEFAULT 'free',
  status TEXT CHECK (status IN ('free', 'active', 'expired', 'suspended')) NOT NULL DEFAULT 'free',

  -- MVP: Stripe 관련 컬럼은 NULL 허용
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- MVP: 관리자 선물 기능 ⭐
  granted_by UUID REFERENCES auth.users(id),  -- 관리자 ID
  payment_method TEXT CHECK (payment_method IN ('admin_grant', 'stripe')) DEFAULT 'admin_grant',
  grant_reason TEXT,  -- "베타 테스터", "이벤트 당첨" 등

  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_granted_by ON subscriptions(granted_by);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
```

### Edge Function 조정

#### MVP에서 필요한 Edge Functions

1. **check-subscription** (유지)
   - 구독 상태 확인
   - 만료 체크
   - Free 다운그레이드

2. **login-with-device-check** (유지)
   - 기기 인증
   - 기기 등록 수 확인

3. **register-device** (유지)
   - 새 기기 등록

4. **admin-grant-subscription** (신규 ⭐)
   - 관리자가 사용자에게 등급 부여

#### MVP에서 제외하는 Edge Functions

- ~~create-checkout-session~~ (Phase 2)
- ~~webhook-stripe~~ (Phase 2)
- ~~cancel-subscription~~ (Phase 2)
- ~~track-referral~~ (Phase 2)
- ~~process-commission~~ (Phase 2)

---

## 구독 검증 메커니즘

### 오프라인 캐시 (5일)

사용자가 인터넷 연결 없이 앱을 사용할 수 있도록 구독 정보를 로컬에 캐시합니다.

#### 검증 로직

```typescript
// client/services/SubscriptionManager.ts

class SubscriptionManager {
  private cache: SubscriptionInfo | null = null;
  private lastCheck: Date | null = null;
  private readonly ONLINE_CACHE_DURATION = 3600000;  // 1시간 (온라인)
  private readonly OFFLINE_GRACE_PERIOD = 432000000; // 5일 (오프라인)

  /**
   * 구독 확인 (온라인/오프라인 대응)
   */
  async checkSubscription(forceRefresh = false): Promise<SubscriptionInfo> {
    // 1. 온라인 상태 확인
    const isOnline = navigator.onLine;

    // 2. 캐시 유효성 검증
    if (!forceRefresh && this.cache && this.lastCheck) {
      const timeSinceCheck = Date.now() - this.lastCheck.getTime();

      if (isOnline) {
        // 온라인: 1시간 캐시
        if (timeSinceCheck < this.ONLINE_CACHE_DURATION) {
          return this.cache;
        }
      } else {
        // 오프라인: 5일 grace period
        if (timeSinceCheck < this.OFFLINE_GRACE_PERIOD) {
          return this.cache;
        } else {
          // 5일 초과: Free로 다운그레이드 ⭐
          return this.downgradeToFree('offline_grace_period_exceeded');
        }
      }
    }

    // 3. 서버에서 최신 정보 가져오기 (온라인만)
    if (isOnline) {
      try {
        const info = await this.fetchFromServer();

        // 만료 체크
        if (info.expires_at && new Date(info.expires_at) < new Date()) {
          info.status = 'expired';
          await this.downgradeToFreeOnServer(info.user_id);
        }

        // 캐시 업데이트
        this.cache = info;
        this.lastCheck = new Date();

        return info;
      } catch (error) {
        // 서버 연결 실패: 기존 캐시 사용
        if (this.cache) {
          console.warn('[SubscriptionManager] Server unreachable, using cache');
          return this.cache;
        }
        throw error;
      }
    } else {
      // 오프라인이고 캐시도 없음: Free로 시작
      if (!this.cache) {
        return this.getFreeSubscription();
      }
      return this.cache;
    }
  }

  /**
   * Free 등급으로 다운그레이드 (로컬)
   */
  private downgradeToFree(reason: string): SubscriptionInfo {
    console.warn(`[SubscriptionManager] Downgrading to Free: ${reason}`);

    const freeInfo: SubscriptionInfo = this.getFreeSubscription();

    // 캐시 업데이트
    this.cache = freeInfo;
    this.lastCheck = new Date();

    // UI 알림
    this.notifyDowngrade(reason);

    return freeInfo;
  }

  /**
   * Free 등급으로 다운그레이드 (서버)
   */
  private async downgradeToFreeOnServer(userId: string): Promise<void> {
    await supabase
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'expired',
        updated_at: new Date()
      })
      .eq('user_id', userId);

    // 이벤트 로깅
    await this.logEvent('subscription_downgraded', {
      reason: 'expired',
      previous_tier: this.cache?.tier
    });
  }

  /**
   * Free 구독 정보 생성
   */
  private getFreeSubscription(): SubscriptionInfo {
    return {
      tier: 'free',
      status: 'free',
      features: {
        formats: ['webp'],
        scopes: ['file'],
        backup: false,
        log: false,
        max_batch_size: 10
      },
      device_limit: 2,
      device_count: 0,
      expires_at: null
    };
  }

  /**
   * 다운그레이드 알림
   */
  private notifyDowngrade(reason: string): void {
    let message: string;

    if (reason === 'offline_grace_period_exceeded') {
      message = '5일 이상 오프라인 상태입니다.\n' +
                'Free 등급으로 제한됩니다.\n' +
                '인터넷 연결 후 앱을 재시작해주세요.';
    } else if (reason === 'expired') {
      message = '구독이 만료되었습니다.\n' +
                'Free 등급으로 전환됩니다.\n' +
                '계속 사용하시려면 업그레이드해주세요.';
    } else {
      message = 'Free 등급으로 전환되었습니다.';
    }

    // Electron dialog
    dialog.showMessageBox({
      type: 'warning',
      title: '구독 상태 변경',
      message,
      buttons: ['확인']
    });

    // 이벤트 발행
    emitEvent('subscription:downgraded', { reason });
  }

  /**
   * 캐시 무효화
   */
  invalidateCache(): void {
    this.cache = null;
    this.lastCheck = null;
  }
}

export const subscriptionManager = new SubscriptionManager();
```

### 앱 시작 시 검증 플로우

```typescript
// client/main/index.ts

async function initializeApp() {
  // 1. 사용자 인증 확인
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // 로그인 화면으로 이동
    mainWindow.loadURL('/#/login');
    return;
  }

  // 2. 구독 상태 확인 ⭐
  try {
    const subscription = await subscriptionManager.checkSubscription();

    console.log('[App] Subscription:', subscription.tier, subscription.status);

    // 3. 만료 또는 5일 초과 시 알림
    if (subscription.status === 'expired') {
      // UI에서 업그레이드 유도
    }

    // 4. 메인 화면 로드
    mainWindow.loadURL('/#/main');
  } catch (error) {
    console.error('[App] Failed to check subscription:', error);

    // 오류 시 Free 등급으로 시작
    mainWindow.loadURL('/#/main');
  }
}
```

---

## 업셀링 전략

### 1. 기능 잠금 UI

Pro 기능을 UI에 표시하되 비활성화하고, 클릭 시 업그레이드 유도 팝업을 띄웁니다.

#### UI 디자인

```typescript
// client/components/FormatSelector.tsx

export function FormatSelector() {
  const subscription = useSubscription();

  const formats = [
    { id: 'webp', name: 'WebP', tier: 'free' },
    { id: 'avif', name: 'AVIF', tier: 'basic', description: '20% 더 압축' },
    { id: 'jxl', name: 'JPEG XL', tier: 'pro', description: '최고 품질' }
  ];

  return (
    <div className="format-selector">
      {formats.map(format => {
        const isLocked = !canUseFormat(subscription.tier, format.tier);

        return (
          <button
            key={format.id}
            className={`format-button ${isLocked ? 'locked' : ''}`}
            onClick={() => isLocked ? showUpgradeDialog(format) : selectFormat(format.id)}
            disabled={isLocked}
          >
            <div className="format-icon">
              {isLocked && <LockIcon />}
              <img src={`/icons/${format.id}.svg`} alt={format.name} />
            </div>
            <div className="format-info">
              <h3>{format.name}</h3>
              {format.description && (
                <p className="format-description">{format.description}</p>
              )}
              {isLocked && (
                <span className="tier-badge">{format.tier.toUpperCase()}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function canUseFormat(userTier: string, requiredTier: string): boolean {
  const tierOrder = { free: 0, basic: 1, pro: 2 };
  return tierOrder[userTier] >= tierOrder[requiredTier];
}
```

#### 업그레이드 다이얼로그 (MVP 버전)

```typescript
// client/components/UpgradeDialog.tsx

export function UpgradeDialog({ format }: { format: Format }) {
  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>
        <LockIcon /> {format.name}는 {format.tier.toUpperCase()} 등급 기능입니다
      </DialogTitle>

      <DialogContent>
        <div className="feature-highlight">
          <img src={`/icons/${format.id}.svg`} alt={format.name} />
          <h3>{format.name} 변환</h3>
          <p>{format.description}</p>
        </div>

        <div className="tier-comparison">
          <TierCard tier="free" currentTier={subscription.tier} />
          <TierCard tier={format.tier} currentTier={subscription.tier} highlight />
        </div>

        {/* MVP: 곧 출시 예정 메시지 ⭐ */}
        <Alert severity="info">
          <AlertTitle>곧 출시 예정!</AlertTitle>
          유료 결제 기능이 준비 중입니다.
          베타 테스터에게는 무료로 제공될 예정이니 조금만 기다려주세요! 🎉
        </Alert>

        {/* Phase 2: 실제 결제 버튼
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpgrade}
        >
          지금 업그레이드 (₩9,900/월)
        </Button>
        */}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>나중에</Button>
        <Button onClick={handleWaitlist} variant="outlined">
          알림 신청하기
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 2. 변환 완료 메시지

Free 사용자가 변환을 완료했을 때 Pro 기능을 안내합니다.

```typescript
// client/services/ImageProcessor.ts

async function onConversionComplete(result: ConversionResult) {
  // 기본 완료 알림
  toast.success(`${result.fileCount}개 파일 변환 완료!`);

  // Free 사용자에게 업셀링 메시지 표시 ⭐
  if (subscription.tier === 'free') {
    setTimeout(() => {
      showUpsellMessage(result);
    }, 1000);
  }

  // 이벤트 발행
  emitEvent('conversion:completed', result);
}

function showUpsellMessage(result: ConversionResult) {
  // MVP: "곧 출시" 메시지
  toast.info(
    <div className="upsell-toast">
      <div className="upsell-content">
        <h4>더 작은 파일 크기를 원하시나요?</h4>
        <p>Pro 등급으로 업그레이드하고 AVIF로 20% 더 압축해 보세요!</p>
        <small>💡 곧 출시 예정 - 베타 테스터에게 무료 제공</small>
      </div>
      <button onClick={handleUpgradeClick}>
        자세히 보기
      </button>
    </div>,
    { duration: 8000, position: 'bottom-right' }
  );
}
```

### 3. 설정 화면 업셀링

```typescript
// client/pages/SettingsPage.tsx

export function SettingsPage() {
  const subscription = useSubscription();

  return (
    <div className="settings-page">
      {/* 현재 등급 표시 */}
      <CurrentTierSection subscription={subscription} />

      {/* Free 사용자에게 업그레이드 배너 표시 */}
      {subscription.tier === 'free' && (
        <UpgradeBanner>
          <h3>더 많은 기능을 사용해보세요</h3>
          <ul>
            <li>✅ AVIF 포맷 (20% 더 압축)</li>
            <li>✅ 폴더 전체 변환</li>
            <li>✅ 원본 파일 자동 백업</li>
            <li>✅ Excel 작업 로그</li>
            <li>✅ 최대 15개 배치 처리 (Basic) / 무제한 (Pro)</li>
          </ul>
          <Button onClick={showUpgradeDialog}>
            업그레이드 (준비 중)
          </Button>
        </UpgradeBanner>
      )}

      {/* 나머지 설정 항목 */}
      <GeneralSettings />
      <AdvancedSettings />
    </div>
  );
}
```

---

## 관리자 선물 기능

### 1. 관리자 대시보드 - 등급 부여

```typescript
// admin/pages/UserManagement.tsx

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  async function handleGrantSubscription(
    userId: string,
    tier: 'basic' | 'pro',
    duration: number,  // 일 수
    reason: string
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + duration);

    const { data: admin } = await supabase.auth.getUser();

    // Edge Function 호출
    const { error } = await supabase.functions.invoke('admin-grant-subscription', {
      body: {
        user_id: userId,
        tier,
        expires_at: expiresAt.toISOString(),
        granted_by: admin.user.id,
        payment_method: 'admin_grant',
        grant_reason: reason
      }
    });

    if (error) {
      toast.error(`등급 부여 실패: ${error.message}`);
      return;
    }

    toast.success(`${tier.toUpperCase()} 등급이 부여되었습니다!`);

    // 사용자 목록 새로고침
    await loadUsers();
  }

  return (
    <div className="user-management">
      <DataTable
        columns={[
          { field: 'email', headerName: '이메일' },
          { field: 'tier', headerName: '등급', renderCell: (row) => (
            <TierBadge tier={row.tier} grantedBy={row.granted_by} />
          )},
          { field: 'status', headerName: '상태' },
          { field: 'expires_at', headerName: '만료일' },
          { field: 'actions', headerName: '작업', renderCell: (row) => (
            <Button onClick={() => openGrantDialog(row)}>
              등급 변경
            </Button>
          )}
        ]}
        rows={users}
      />

      {/* 등급 부여 다이얼로그 */}
      {selectedUser && (
        <GrantSubscriptionDialog
          user={selectedUser}
          onGrant={handleGrantSubscription}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
```

### 2. 등급 부여 다이얼로그

```typescript
// admin/components/GrantSubscriptionDialog.tsx

export function GrantSubscriptionDialog({ user, onGrant, onClose }) {
  const [tier, setTier] = useState<'basic' | 'pro'>('basic');
  const [duration, setDuration] = useState(30);  // 기본 30일
  const [reason, setReason] = useState('');

  const presetReasons = [
    '베타 테스터',
    '이벤트 당첨',
    '피드백 제공',
    '버그 리포트',
    '프로모션',
    '기타'
  ];

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>
        등급 부여 - {user.email}
      </DialogTitle>

      <DialogContent>
        {/* 등급 선택 */}
        <FormControl fullWidth>
          <InputLabel>등급</InputLabel>
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <MenuItem value="basic">
              <div className="tier-option">
                <span>Basic</span>
                <small>AVIF 변환, 폴더 처리, 백업/로그</small>
              </div>
            </MenuItem>
            <MenuItem value="pro">
              <div className="tier-option">
                <span>Pro</span>
                <small>모든 포맷, 폴더 처리, 백업/로그, 통계</small>
              </div>
            </MenuItem>
          </Select>
        </FormControl>

        {/* 기간 선택 */}
        <FormControl fullWidth>
          <InputLabel>기간</InputLabel>
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            <MenuItem value={7}>7일</MenuItem>
            <MenuItem value={30}>30일 (1개월)</MenuItem>
            <MenuItem value={90}>90일 (3개월)</MenuItem>
            <MenuItem value={180}>180일 (6개월)</MenuItem>
            <MenuItem value={365}>365일 (1년)</MenuItem>
            <MenuItem value={9999}>무제한</MenuItem>
          </Select>
        </FormControl>

        {/* 사유 선택 */}
        <FormControl fullWidth>
          <InputLabel>사유</InputLabel>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {presetReasons.map(r => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {reason === '기타' && (
          <TextField
            fullWidth
            label="사유 입력"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        )}

        {/* 미리보기 */}
        <Alert severity="info">
          <strong>{user.email}</strong>님에게
          <strong> {tier.toUpperCase()} 등급</strong>을
          <strong> {duration === 9999 ? '무제한' : `${duration}일`}</strong> 동안 부여합니다.
          <br />
          <small>사유: {reason}</small>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onGrant(user.id, tier, duration, reason)}
        >
          등급 부여
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 3. 클라이언트 - "더카당의 선물" 표시

```typescript
// client/components/SubscriptionBadge.tsx

export function SubscriptionBadge({ subscription }: { subscription: SubscriptionInfo }) {
  const isGift = subscription.payment_method === 'admin_grant';

  return (
    <div className={`subscription-badge tier-${subscription.tier}`}>
      {isGift ? (
        <>
          <div className="gift-header">
            <GiftIcon />
            <span className="gift-text">더카당의 선물!</span>
          </div>
          <div className="tier-name">
            {subscription.tier.toUpperCase()} 등급입니다
          </div>
          {subscription.grant_reason && (
            <div className="grant-reason">
              {subscription.grant_reason}
            </div>
          )}
        </>
      ) : (
        <div className="tier-name">
          {subscription.tier.toUpperCase()} 등급
        </div>
      )}

      {subscription.expires_at && (
        <div className="expires-at">
          만료: {formatDate(subscription.expires_at)}
        </div>
      )}
    </div>
  );
}
```

```css
/* client/styles/subscription-badge.css */

.subscription-badge {
  padding: 16px;
  border-radius: 12px;
  border: 2px solid;
  background: linear-gradient(135deg, var(--tier-color-light), var(--tier-color-dark));
}

.subscription-badge.tier-free {
  --tier-color-light: #e3f2fd;
  --tier-color-dark: #90caf9;
  border-color: #42a5f5;
}

.subscription-badge.tier-basic {
  --tier-color-light: #f3e5f5;
  --tier-color-dark: #ce93d8;
  border-color: #ab47bc;
}

.subscription-badge.tier-pro {
  --tier-color-light: #fff3e0;
  --tier-color-dark: #ffb74d;
  border-color: #ff9800;
}

.gift-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  animation: sparkle 2s infinite;
}

.gift-text {
  font-weight: 600;
  font-size: 14px;
  color: #ff6b6b;
}

.tier-name {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}

.grant-reason {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.expires-at {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

@keyframes sparkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 4. Edge Function: admin-grant-subscription

```typescript
// server/supabase/functions/admin-grant-subscription/index.ts

import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. 관리자 권한 확인
  const authHeader = req.headers.get('Authorization')!;
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 관리자 여부 확인 (auth.users 테이블의 user_metadata 또는 별도 테이블)
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. 요청 파라미터 추출
  const {
    user_id,
    tier,
    expires_at,
    granted_by,
    payment_method,
    grant_reason
  } = await req.json();

  // 3. 구독 업데이트
  const { error: upsertError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id,
      tier,
      status: 'active',
      expires_at,
      granted_by,
      payment_method,
      grant_reason,
      updated_at: new Date()
    }, {
      onConflict: 'user_id'
    });

  if (upsertError) {
    return new Response(
      JSON.stringify({ error: upsertError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. 이벤트 로깅
  await supabaseAdmin
    .from('user_events')
    .insert({
      user_id,
      event_type: 'subscription_granted',
      event_data: {
        tier,
        expires_at,
        granted_by,
        grant_reason
      }
    });

  // 5. 성공 응답
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        user_id,
        tier,
        expires_at
      }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
```

---

## 개발 우선순위

### Sprint 1 (Week 1-2): 핵심 기능
- [x] Supabase 프로젝트 생성 및 스키마 마이그레이션
- [x] 사용자 인증 (회원가입, 로그인, 이메일 인증)
- [x] 기기 인증 시스템
- [x] WebP 변환 기능 (Sharp)
- [x] 구독 검증 메커니즘 (오프라인 5일)

### Sprint 2 (Week 3-4): 등급별 기능
- [x] AVIF 변환 기능
- [x] 폴더 단위 처리
- [x] 백업 시스템 (BackupManager)
- [x] 로그 시스템 (LogManager + ExcelJS)
- [x] 등급별 기능 제한 (Strategy Pattern)

### Sprint 3 (Week 5-6): 업셀링 및 관리자
- [x] 업셀링 UI (기능 잠금, 변환 완료 메시지)
- [x] 관리자 대시보드
- [x] 관리자 선물 기능 (admin-grant-subscription)
- [x] "더카당의 선물" UI

### Sprint 4 (Week 7-8): 마무리
- [ ] 다국어 지원 (i18next)
- [ ] 패키징 및 빌드 (electron-builder)
- [ ] 베타 테스트
- [ ] 버그 수정 및 최적화

---

## 구현 가이드

### Phase 2 대비 준비

MVP에서 제외한 기능들을 Phase 2에서 쉽게 추가할 수 있도록 준비합니다.

#### 1. 데이터베이스 준비

```sql
-- MVP: payment_method를 'admin_grant'로 기본 설정
-- Phase 2: 'stripe'로 전환

ALTER TABLE subscriptions
ALTER COLUMN payment_method SET DEFAULT 'admin_grant';

-- Phase 2 마이그레이션
-- ALTER TABLE subscriptions
-- ALTER COLUMN payment_method SET DEFAULT 'stripe';
```

#### 2. Edge Functions 준비

```typescript
// MVP: Edge Functions 디렉토리 구조는 미리 생성
server/supabase/functions/
├── admin-grant-subscription/       # MVP에서 사용 ✅
├── check-subscription/             # MVP에서 사용 ✅
├── login-with-device-check/        # MVP에서 사용 ✅
├── register-device/                # MVP에서 사용 ✅
├── create-checkout-session/        # Phase 2에서 구현 🔜
├── webhook-stripe/                 # Phase 2에서 구현 🔜
├── cancel-subscription/            # Phase 2에서 구현 🔜
├── track-referral/                 # Phase 2에서 구현 🔜
└── process-commission/             # Phase 2에서 구현 🔜
```

#### 3. UI 준비

```typescript
// client/components/UpgradeDialog.tsx

// MVP
const MVP_MODE = true;

{MVP_MODE ? (
  <Alert severity="info">
    곧 출시 예정! 베타 테스터에게 무료 제공될 예정입니다.
  </Alert>
) : (
  <Button onClick={handleStripeCheckout}>
    지금 업그레이드 (₩9,900/월)
  </Button>
)}
```

---

## 체크리스트

### MVP 완료 기준

#### 핵심 기능
- [ ] WebP 변환 (Free)
- [ ] AVIF 변환 (Basic 이상)
- [ ] 폴더 처리 (Basic 이상)
- [ ] 백업 시스템 (Basic 이상)
- [ ] 로그 시스템 (Basic 이상)

#### 구독 시스템
- [ ] 구독 검증 (온라인/오프라인)
- [ ] 5일 grace period
- [ ] 만료 시 Free 다운그레이드
- [ ] 관리자 선물 기능

#### 업셀링
- [ ] 기능 잠금 UI
- [ ] 업그레이드 다이얼로그 (곧 출시 메시지)
- [ ] 변환 완료 업셀링 메시지

#### 관리자
- [ ] 사용자 목록 및 검색
- [ ] 등급 수동 부여
- [ ] "더카당의 선물" 표시

#### 기타
- [ ] 한국어/영어 다국어
- [ ] Windows/macOS 빌드
- [ ] 베타 테스트 완료

---

**다음 문서**:
- [database-schema.md](../architecture/database-schema.md) - MVP 스키마
- [subscription-service.md](../architecture/subscription-service.md) - 구독 로직
- [extensibility-guide.md](../architecture/extensibility-guide.md) - Phase 2 확장 준비

**Phase 2 추가 예정**:
- Stripe 결제 연동
- 어필리에이트 시스템
- 자동 업데이트
- 고급 분석 기능
