# 픽셀부스터 확장성 가이드

> 새로운 기능을 쉽게 추가하고 수정할 수 있도록 설계된 아키텍처 가이드

**작성일**: 2025-11-10
**대상**: 개발자, 시스템 아키텍트
**난이도**: ⭐⭐⭐ (중급-고급)

---

## 📋 목차

1. [확장성 설계 원칙](#확장성-설계-원칙)
2. [플러그인 아키텍처](#플러그인-아키텍처)
3. [피처 플래그 시스템](#피처-플래그-시스템)
4. [이벤트 드리븐 아키텍처](#이벤트-드리븐-아키텍처)
5. [전략 패턴 (구독 등급)](#전략-패턴-구독-등급)
6. [모듈러 모놀리스](#모듈러-모놀리스)
7. [Configuration as Data](#configuration-as-data)
8. [미래 확장 시나리오](#미래-확장-시나리오)
9. [실전 예제](#실전-예제)

---

## 확장성 설계 원칙

### 핵심 원칙

```
1. Open/Closed Principle
   확장에는 열려있고, 수정에는 닫혀있어야 함

2. Dependency Inversion
   구체적인 구현이 아닌 추상화에 의존

3. Single Responsibility
   각 모듈은 하나의 변경 이유만 가져야 함

4. Loose Coupling
   모듈 간 결합도를 낮춰 독립적 변경 가능
```

### 설계 목표

```yaml
목표:
  - 새 기능 추가 시 기존 코드 수정 최소화
  - 코드 변경 없이 설정으로 기능 제어 가능
  - A/B 테스트 및 점진적 롤아웃 지원
  - 서드파티 확장 및 플러그인 지원 준비
  - 유지보수 비용 최소화

방지해야 할 것:
  - 하드코딩된 if/else 체인
  - 기능별 분기문 증가
  - 중복 코드 발생
  - 모듈 간 강한 결합
```

---

## 플러그인 아키텍처

### 개념

새로운 변환기나 처리기를 코어 시스템 수정 없이 추가할 수 있는 구조입니다.

### 인터페이스 설계

```typescript
// shared/types/plugin.ts

/**
 * 이미지 변환 플러그인 인터페이스
 */
export interface IImageConverter {
  /** 플러그인 고유 ID */
  readonly id: string;

  /** 플러그인 표시 이름 */
  readonly name: string;

  /** 지원하는 입력 포맷 */
  readonly supportedInputFormats: string[];

  /** 지원하는 출력 포맷 */
  readonly supportedOutputFormats: string[];

  /** 변환 가능 여부 확인 */
  canConvert(input: string, output: string): boolean;

  /** 실제 변환 수행 */
  convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): Promise<ConversionResult>;

  /** 플러그인 초기화 */
  initialize?(): Promise<void>;

  /** 플러그인 정리 */
  cleanup?(): Promise<void>;
}

/**
 * 변환 옵션
 */
export interface ConversionOptions {
  quality?: number;
  width?: number;
  height?: number;
  maintain_aspect?: boolean;
  metadata?: Record<string, any>;
}

/**
 * 변환 결과
 */
export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  metadata?: {
    originalSize: number;
    newSize: number;
    compressionRatio: number;
    duration: number;
  };
}
```

### 플러그인 레지스트리

```typescript
// client/core/PluginRegistry.ts

class PluginRegistry {
  private plugins: Map<string, IImageConverter> = new Map();

  /**
   * 플러그인 등록
   */
  register(plugin: IImageConverter): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    this.plugins.set(plugin.id, plugin);
    console.log(`[PluginRegistry] Registered: ${plugin.name}`);
  }

  /**
   * 플러그인 제거
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin && plugin.cleanup) {
      plugin.cleanup();
    }
    this.plugins.delete(pluginId);
  }

  /**
   * 변환 가능한 플러그인 찾기
   */
  findConverter(inputFormat: string, outputFormat: string): IImageConverter | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.canConvert(inputFormat, outputFormat)) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * 모든 플러그인 목록
   */
  getAllPlugins(): IImageConverter[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 지원 포맷 목록
   */
  getSupportedFormats(): {
    input: Set<string>;
    output: Set<string>;
  } {
    const input = new Set<string>();
    const output = new Set<string>();

    for (const plugin of this.plugins.values()) {
      plugin.supportedInputFormats.forEach(f => input.add(f));
      plugin.supportedOutputFormats.forEach(f => output.add(f));
    }

    return { input, output };
  }
}

export const pluginRegistry = new PluginRegistry();
```

### 기본 변환기 구현

```typescript
// client/plugins/WebPConverter.ts

import sharp from 'sharp';

export class WebPConverter implements IImageConverter {
  readonly id = 'webp-converter';
  readonly name = 'WebP Converter';
  readonly supportedInputFormats = ['jpg', 'jpeg', 'png', 'bmp', 'tiff'];
  readonly supportedOutputFormats = ['webp'];

  canConvert(input: string, output: string): boolean {
    const inputLower = input.toLowerCase();
    const outputLower = output.toLowerCase();

    return this.supportedInputFormats.includes(inputLower) &&
           this.supportedOutputFormats.includes(outputLower);
  }

  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    try {
      const inputStats = await fs.stat(inputPath);
      const originalSize = inputStats.size;

      let pipeline = sharp(inputPath);

      // 리사이징 옵션 처리
      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: options.maintain_aspect ? 'inside' : 'fill'
        });
      }

      // WebP 변환
      await pipeline
        .webp({ quality: options.quality || 80 })
        .toFile(outputPath);

      const outputStats = await fs.stat(outputPath);
      const newSize = outputStats.size;
      const duration = Date.now() - startTime;

      return {
        success: true,
        outputPath,
        metadata: {
          originalSize,
          newSize,
          compressionRatio: (1 - newSize / originalSize) * 100,
          duration
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async initialize(): Promise<void> {
    console.log('[WebPConverter] Initialized');
  }

  async cleanup(): Promise<void> {
    console.log('[WebPConverter] Cleaned up');
  }
}
```

### AVIF 변환기 추가 예제

```typescript
// client/plugins/AVIFConverter.ts

export class AVIFConverter implements IImageConverter {
  readonly id = 'avif-converter';
  readonly name = 'AVIF Converter';
  readonly supportedInputFormats = ['jpg', 'jpeg', 'png', 'bmp', 'tiff'];
  readonly supportedOutputFormats = ['avif'];

  canConvert(input: string, output: string): boolean {
    const inputLower = input.toLowerCase();
    const outputLower = output.toLowerCase();

    return this.supportedInputFormats.includes(inputLower) &&
           this.supportedOutputFormats.includes(outputLower);
  }

  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // AVIF 변환 로직 (WebP와 유사)
    const startTime = Date.now();

    try {
      const inputStats = await fs.stat(inputPath);
      const originalSize = inputStats.size;

      let pipeline = sharp(inputPath);

      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: options.maintain_aspect ? 'inside' : 'fill'
        });
      }

      await pipeline
        .avif({ quality: options.quality || 80 })
        .toFile(outputPath);

      const outputStats = await fs.stat(outputPath);
      const newSize = outputStats.size;
      const duration = Date.now() - startTime;

      return {
        success: true,
        outputPath,
        metadata: {
          originalSize,
          newSize,
          compressionRatio: (1 - newSize / originalSize) * 100,
          duration
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### 플러그인 초기화

```typescript
// client/core/AppInitializer.ts

import { pluginRegistry } from './PluginRegistry';
import { WebPConverter } from '../plugins/WebPConverter';
import { AVIFConverter } from '../plugins/AVIFConverter';

export async function initializePlugins(): Promise<void> {
  // 기본 플러그인 등록
  const webpConverter = new WebPConverter();
  await webpConverter.initialize?.();
  pluginRegistry.register(webpConverter);

  const avifConverter = new AVIFConverter();
  await avifConverter.initialize?.();
  pluginRegistry.register(avifConverter);

  // 지원 포맷 로깅
  const formats = pluginRegistry.getSupportedFormats();
  console.log('[App] Supported input formats:', Array.from(formats.input));
  console.log('[App] Supported output formats:', Array.from(formats.output));
}
```

### 플러그인 사용

```typescript
// client/services/ImageProcessor.ts

import { pluginRegistry } from '../core/PluginRegistry';

export class ImageProcessor {
  async processImage(
    inputPath: string,
    outputFormat: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // 입력 포맷 추출
    const inputFormat = path.extname(inputPath).slice(1);

    // 적합한 플러그인 찾기
    const converter = pluginRegistry.findConverter(inputFormat, outputFormat);

    if (!converter) {
      throw new Error(
        `No converter found for ${inputFormat} → ${outputFormat}`
      );
    }

    // 변환 수행
    const outputPath = this.generateOutputPath(inputPath, outputFormat);
    const result = await converter.convert(inputPath, outputPath, options);

    return result;
  }

  private generateOutputPath(inputPath: string, outputFormat: string): string {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${name}.${outputFormat}`);
  }
}
```

---

## 피처 플래그 시스템

### 개념

코드 배포 없이 기능을 켜고 끌 수 있으며, A/B 테스트와 점진적 롤아웃을 지원합니다.

### 데이터베이스 스키마

```sql
-- database-schema.md에 이미 정의됨
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,                    -- 'batch_processing', 'ai_upscaling'
  name JSONB NOT NULL,                         -- {"ko": "배치 처리", "en": "Batch Processing"}
  description JSONB,
  min_tier_id UUID REFERENCES subscription_tiers(id),  -- 최소 요구 등급
  is_enabled BOOLEAN DEFAULT false,            -- 전역 활성화 여부
  config JSONB,                                -- 기능별 설정
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 사용자별 피처 플래그 오버라이드
CREATE TABLE user_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL,
  config JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,         -- A/B 테스트 종료일
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_flag_id)
);
```

### 피처 플래그 매니저

```typescript
// client/core/FeatureFlagManager.ts

interface FeatureFlag {
  id: string;
  key: string;
  name: Record<string, string>;
  isEnabled: boolean;
  minTier?: string;
  config?: Record<string, any>;
}

class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private userOverrides: Map<string, boolean> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 300000; // 5분

  /**
   * 서버에서 피처 플래그 가져오기
   */
  async fetchFlags(forceRefresh = false): Promise<void> {
    if (!forceRefresh && this.lastFetch &&
        Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION) {
      return;
    }

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*');

    if (error) throw error;

    // 캐시 업데이트
    this.flags.clear();
    flags.forEach(flag => {
      this.flags.set(flag.key, {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        isEnabled: flag.is_enabled,
        minTier: flag.min_tier_id,
        config: flag.config
      });
    });

    // 사용자별 오버라이드 가져오기
    await this.fetchUserOverrides();

    this.lastFetch = new Date();
  }

  /**
   * 사용자별 오버라이드 가져오기
   */
  private async fetchUserOverrides(): Promise<void> {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const { data: overrides } = await supabase
      .from('user_feature_flags')
      .select('feature_flag_id, is_enabled')
      .eq('user_id', user.data.user.id)
      .or('expires_at.is.null,expires_at.gt.now()');

    this.userOverrides.clear();
    overrides?.forEach(override => {
      this.userOverrides.set(override.feature_flag_id, override.is_enabled);
    });
  }

  /**
   * 기능 활성화 여부 확인
   */
  async isEnabled(flagKey: string): Promise<boolean> {
    await this.fetchFlags();

    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    // 사용자별 오버라이드 확인
    if (this.userOverrides.has(flag.id)) {
      return this.userOverrides.get(flag.id)!;
    }

    // 전역 설정 확인
    if (!flag.isEnabled) return false;

    // 구독 등급 확인
    if (flag.minTier) {
      const subscription = await subscriptionManager.checkSubscription();
      return this.canAccessTier(subscription.tier, flag.minTier);
    }

    return true;
  }

  /**
   * 기능 설정 가져오기
   */
  async getConfig(flagKey: string): Promise<Record<string, any> | null> {
    await this.fetchFlags();
    const flag = this.flags.get(flagKey);
    return flag?.config || null;
  }

  /**
   * 모든 활성 기능 목록
   */
  async getEnabledFlags(): Promise<string[]> {
    await this.fetchFlags();
    const enabled: string[] = [];

    for (const [key, flag] of this.flags) {
      if (await this.isEnabled(key)) {
        enabled.push(key);
      }
    }

    return enabled;
  }

  private canAccessTier(userTier: string, requiredTier: string): boolean {
    const tierOrder = ['free', 'basic', 'pro'];
    const userIndex = tierOrder.indexOf(userTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    return userIndex >= requiredIndex;
  }
}

export const featureFlagManager = new FeatureFlagManager();
```

### UI에서 사용

```typescript
// client/components/ConversionSettings.tsx

import { featureFlagManager } from '../core/FeatureFlagManager';

export function ConversionSettings() {
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    async function checkFeatures() {
      const batch = await featureFlagManager.isEnabled('batch_processing');
      const ai = await featureFlagManager.isEnabled('ai_upscaling');

      setBatchEnabled(batch);
      setAiEnabled(ai);
    }

    checkFeatures();
  }, []);

  return (
    <div className="settings">
      {batchEnabled && (
        <div className="feature">
          <h3>배치 처리</h3>
          <p>여러 파일을 한 번에 변환하세요</p>
          <BatchProcessingControls />
        </div>
      )}

      {aiEnabled && (
        <div className="feature">
          <h3>AI 업스케일링</h3>
          <p>AI를 사용한 고급 이미지 품질 향상</p>
          <AIUpscalingControls />
        </div>
      )}
    </div>
  );
}
```

### 백엔드에서 사용

```typescript
// server/supabase/functions/convert-request/index.ts

import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { userId, featureKey } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 피처 플래그 확인
  const { data: flag } = await supabase
    .from('feature_flags')
    .select('*, user_feature_flags!inner(is_enabled)')
    .eq('key', featureKey)
    .eq('user_feature_flags.user_id', userId)
    .single();

  if (!flag || !flag.is_enabled) {
    return new Response(
      JSON.stringify({ error: 'Feature not available' }),
      { status: 403 }
    );
  }

  // 기능 수행...
});
```

### A/B 테스트 시나리오

```typescript
// admin/services/ABTestService.ts

/**
 * A/B 테스트 생성
 */
async function createABTest(
  featureKey: string,
  percentage: number  // 0-100
): Promise<void> {
  // 1. 모든 사용자 가져오기
  const { data: users } = await supabaseAdmin
    .from('auth.users')
    .select('id');

  // 2. 랜덤으로 사용자 선택 (percentage%)
  const selectedUsers = users
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(users.length * percentage / 100));

  // 3. 피처 플래그 가져오기
  const { data: flag } = await supabaseAdmin
    .from('feature_flags')
    .select('id')
    .eq('key', featureKey)
    .single();

  // 4. 사용자별 오버라이드 생성
  const overrides = selectedUsers.map(user => ({
    user_id: user.id,
    feature_flag_id: flag.id,
    is_enabled: true,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후
  }));

  await supabaseAdmin
    .from('user_feature_flags')
    .insert(overrides);

  console.log(`A/B test created: ${percentage}% of users (${selectedUsers.length})`);
}

/**
 * A/B 테스트 결과 분석
 */
async function analyzeABTest(featureKey: string): Promise<{
  controlGroup: { count: number; avgUsage: number };
  testGroup: { count: number; avgUsage: number };
}> {
  // user_events 테이블에서 사용 패턴 분석
  const { data: events } = await supabaseAdmin
    .from('user_events')
    .select(`
      user_id,
      event_type,
      user_feature_flags!inner(is_enabled)
    `)
    .eq('event_type', `feature_${featureKey}_used`);

  // 컨트롤 그룹 vs 테스트 그룹 비교
  const controlGroup = events.filter(e => !e.user_feature_flags.is_enabled);
  const testGroup = events.filter(e => e.user_feature_flags.is_enabled);

  return {
    controlGroup: {
      count: controlGroup.length,
      avgUsage: calculateAvgUsage(controlGroup)
    },
    testGroup: {
      count: testGroup.length,
      avgUsage: calculateAvgUsage(testGroup)
    }
  };
}
```

---

## 이벤트 드리븐 아키텍처

### 개념

컴포넌트 간 결합도를 낮추고, 비동기 처리와 확장성을 향상시킵니다.

### 이벤트 버스 구현

```typescript
// client/core/EventBus.ts

type EventHandler<T = any> = (data: T) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * 이벤트 리스너 등록
   */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    // 구독 해제 함수 반환
    return () => this.off(event, handler);
  }

  /**
   * 일회성 이벤트 리스너
   */
  once<T = any>(event: string, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = async (data) => {
      await handler(data);
      this.off(event, wrappedHandler);
    };

    this.on(event, wrappedHandler);
  }

  /**
   * 이벤트 리스너 제거
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 이벤트 발행 (동기)
   */
  emit<T = any>(event: string, data?: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${event}:`, error);
      }
    });
  }

  /**
   * 이벤트 발행 (비동기)
   */
  async emitAsync<T = any>(event: string, data?: T): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    await Promise.all(
      Array.from(handlers).map(async handler => {
        try {
          await handler(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for ${event}:`, error);
        }
      })
    );
  }

  /**
   * 모든 리스너 제거
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 활성 이벤트 목록
   */
  getEvents(): string[] {
    return Array.from(this.listeners.keys());
  }
}

export const eventBus = new EventBus();
```

### 이벤트 타입 정의

```typescript
// shared/types/events.ts

/**
 * 앱 전체 이벤트 타입
 */
export interface AppEvents {
  // 변환 관련
  'conversion:started': { id: string; inputPath: string; outputFormat: string };
  'conversion:progress': { id: string; progress: number };
  'conversion:completed': { id: string; result: ConversionResult };
  'conversion:failed': { id: string; error: string };

  // 구독 관련
  'subscription:changed': { oldTier: string; newTier: string };
  'subscription:expired': { tier: string };
  'subscription:renewed': { tier: string };

  // 기기 관련
  'device:registered': { deviceId: string };
  'device:limit-exceeded': { currentCount: number; limit: number };

  // 로그 관련
  'log:created': { logPath: string };
  'log:export': { format: string };

  // UI 관련
  'ui:theme-changed': { theme: 'light' | 'dark' };
  'ui:language-changed': { language: string };

  // 오류 관련
  'error:critical': { error: Error; context: string };
  'error:network': { error: Error };
}

/**
 * 타입 안전한 이벤트 발행
 */
export function emitEvent<K extends keyof AppEvents>(
  event: K,
  data: AppEvents[K]
): void {
  eventBus.emit(event, data);
}

/**
 * 타입 안전한 이벤트 구독
 */
export function onEvent<K extends keyof AppEvents>(
  event: K,
  handler: (data: AppEvents[K]) => void | Promise<void>
): () => void {
  return eventBus.on(event, handler);
}
```

### 사용 예제 1: 변환 진행 상황

```typescript
// client/services/ImageProcessor.ts

import { emitEvent } from '../../shared/types/events';

export class ImageProcessor {
  async processImage(inputPath: string, outputFormat: string): Promise<void> {
    const conversionId = generateId();

    // 시작 이벤트
    emitEvent('conversion:started', {
      id: conversionId,
      inputPath,
      outputFormat
    });

    try {
      // 변환 수행
      const result = await this.convert(inputPath, outputFormat, (progress) => {
        // 진행 상황 이벤트
        emitEvent('conversion:progress', {
          id: conversionId,
          progress
        });
      });

      // 완료 이벤트
      emitEvent('conversion:completed', {
        id: conversionId,
        result
      });
    } catch (error) {
      // 실패 이벤트
      emitEvent('conversion:failed', {
        id: conversionId,
        error: error.message
      });
    }
  }
}
```

```typescript
// client/components/ConversionProgress.tsx

import { onEvent } from '../../shared/types/events';

export function ConversionProgress() {
  const [conversions, setConversions] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // 이벤트 구독
    const unsubscribeStart = onEvent('conversion:started', ({ id }) => {
      setConversions(prev => new Map(prev).set(id, 0));
    });

    const unsubscribeProgress = onEvent('conversion:progress', ({ id, progress }) => {
      setConversions(prev => new Map(prev).set(id, progress));
    });

    const unsubscribeComplete = onEvent('conversion:completed', ({ id }) => {
      setConversions(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      toast.success('변환 완료!');
    });

    const unsubscribeFailed = onEvent('conversion:failed', ({ id, error }) => {
      setConversions(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      toast.error(`변환 실패: ${error}`);
    });

    // 클린업
    return () => {
      unsubscribeStart();
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeFailed();
    };
  }, []);

  return (
    <div className="progress-list">
      {Array.from(conversions).map(([id, progress]) => (
        <ProgressBar key={id} id={id} progress={progress} />
      ))}
    </div>
  );
}
```

### 사용 예제 2: 구독 변경 처리

```typescript
// client/services/SubscriptionManager.ts

import { emitEvent } from '../../shared/types/events';

class SubscriptionManager {
  async upgradeSubscription(newTier: string): Promise<void> {
    const currentSubscription = await this.checkSubscription();
    const oldTier = currentSubscription.tier;

    // Stripe 결제 처리...

    // 구독 변경 이벤트
    emitEvent('subscription:changed', {
      oldTier,
      newTier
    });
  }
}
```

```typescript
// client/services/LogManager.ts

import { onEvent } from '../../shared/types/events';

class LogManager {
  constructor() {
    // 구독 변경 시 로그 기록
    onEvent('subscription:changed', async ({ oldTier, newTier }) => {
      await this.logEvent('subscription_changed', {
        old_tier: oldTier,
        new_tier: newTier,
        timestamp: new Date()
      });
    });
  }
}
```

```typescript
// client/services/AnalyticsService.ts

import { onEvent } from '../../shared/types/events';

class AnalyticsService {
  constructor() {
    // 구독 변경 시 분석 데이터 전송
    onEvent('subscription:changed', async ({ oldTier, newTier }) => {
      await this.trackEvent('subscription_upgrade', {
        from: oldTier,
        to: newTier,
        user_id: await this.getUserId()
      });
    });
  }
}
```

### 사용 예제 3: 오류 처리

```typescript
// client/core/ErrorHandler.ts

import { onEvent } from '../../shared/types/events';

class ErrorHandler {
  constructor() {
    // 치명적 오류 처리
    onEvent('error:critical', async ({ error, context }) => {
      console.error('[Critical Error]', context, error);

      // 오류 리포팅 서비스에 전송 (Sentry 등)
      await this.reportError(error, context);

      // 사용자에게 알림
      dialog.showErrorBox(
        '치명적 오류',
        `오류가 발생했습니다: ${error.message}\n\n앱을 재시작해주세요.`
      );
    });

    // 네트워크 오류 처리
    onEvent('error:network', async ({ error }) => {
      console.warn('[Network Error]', error);

      // 오프라인 모드로 전환
      await this.switchToOfflineMode();

      // 사용자에게 알림
      toast.warning('네트워크 연결이 끊어졌습니다. 오프라인 모드로 전환합니다.');
    });
  }
}
```

---

## 전략 패턴 (구독 등급)

### 개념

구독 등급별로 다른 동작을 수행하되, 하드코딩된 if/else 체인을 피합니다.

### 전략 인터페이스

```typescript
// shared/types/strategy.ts

/**
 * 구독 등급별 전략 인터페이스
 */
export interface ISubscriptionStrategy {
  /** 등급 이름 */
  readonly tier: string;

  /** 변환 가능 여부 */
  canConvert(format: string): boolean;

  /** 배치 크기 제한 */
  getMaxBatchSize(): number;

  /** 백업 기능 사용 가능 여부 */
  canUseBackup(): boolean;

  /** 로그 기능 사용 가능 여부 */
  canUseLog(): boolean;

  /** 변환 전 검증 */
  validateConversion(files: string[], format: string): Promise<ValidationResult>;

  /** 변환 후 후처리 */
  postProcess(result: ConversionResult): Promise<void>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}
```

### 구독 등급별 전략 구현

```typescript
// client/strategies/FreeStrategy.ts

export class FreeStrategy implements ISubscriptionStrategy {
  readonly tier = 'free';

  canConvert(format: string): boolean {
    return ['webp'].includes(format.toLowerCase());
  }

  getMaxBatchSize(): number {
    return 10;
  }

  canUseBackup(): boolean {
    return false;
  }

  canUseLog(): boolean {
    return false;
  }

  async validateConversion(files: string[], format: string): Promise<ValidationResult> {
    const errors: string[] = [];

    // 포맷 검증
    if (!this.canConvert(format)) {
      errors.push(`Free 등급은 ${format} 포맷을 지원하지 않습니다. (WebP만 가능)`);
    }

    // 파일 수 검증
    if (files.length > this.getMaxBatchSize()) {
      errors.push(`Free 등급은 최대 ${this.getMaxBatchSize()}개 파일만 변환 가능합니다.`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async postProcess(result: ConversionResult): Promise<void> {
    // Free 등급은 후처리 없음
  }
}
```

```typescript
// client/strategies/BasicStrategy.ts

export class BasicStrategy implements ISubscriptionStrategy {
  readonly tier = 'basic';

  canConvert(format: string): boolean {
    return ['webp', 'avif'].includes(format.toLowerCase());
  }

  getMaxBatchSize(): number {
    return 50;
  }

  canUseBackup(): boolean {
    return true;
  }

  canUseLog(): boolean {
    return true;
  }

  async validateConversion(files: string[], format: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.canConvert(format)) {
      errors.push(`Basic 등급은 ${format} 포맷을 지원하지 않습니다. (WebP, AVIF만 가능)`);
    }

    if (files.length > this.getMaxBatchSize()) {
      errors.push(`Basic 등급은 최대 ${this.getMaxBatchSize()}개 파일만 변환 가능합니다.`);
    }

    // 대용량 파일 경고
    const largeFiles = files.filter(f => {
      const stats = fs.statSync(f);
      return stats.size > 50 * 1024 * 1024; // 50MB
    });

    if (largeFiles.length > 0) {
      warnings.push(`50MB 이상의 파일이 ${largeFiles.length}개 있습니다. 변환 시간이 오래 걸릴 수 있습니다.`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async postProcess(result: ConversionResult): Promise<void> {
    // 백업 생성
    if (this.canUseBackup()) {
      await backupManager.backup(result.inputPath);
    }

    // 로그 기록
    if (this.canUseLog()) {
      await logManager.log(result);
    }
  }
}
```

```typescript
// client/strategies/ProStrategy.ts

export class ProStrategy implements ISubscriptionStrategy {
  readonly tier = 'pro';

  canConvert(format: string): boolean {
    return true; // 모든 포맷 지원
  }

  getMaxBatchSize(): number {
    return 200;
  }

  canUseBackup(): boolean {
    return true;
  }

  canUseLog(): boolean {
    return true;
  }

  async validateConversion(files: string[], format: string): Promise<ValidationResult> {
    const warnings: string[] = [];

    // Pro는 모든 포맷 지원
    if (files.length > this.getMaxBatchSize()) {
      return {
        valid: false,
        errors: [`최대 ${this.getMaxBatchSize()}개 파일만 변환 가능합니다.`]
      };
    }

    // 대용량 파일 경고
    const largeFiles = files.filter(f => {
      const stats = fs.statSync(f);
      return stats.size > 100 * 1024 * 1024; // 100MB
    });

    if (largeFiles.length > 0) {
      warnings.push(`100MB 이상의 파일이 ${largeFiles.length}개 있습니다.`);
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async postProcess(result: ConversionResult): Promise<void> {
    // 백업 생성
    await backupManager.backup(result.inputPath);

    // 상세 로그 기록
    await logManager.logDetailed(result);

    // 통계 업데이트
    await analyticsService.track('conversion_completed', {
      format: result.outputFormat,
      size: result.metadata.newSize,
      compression_ratio: result.metadata.compressionRatio
    });
  }
}
```

### 전략 팩토리

```typescript
// client/core/StrategyFactory.ts

import { FreeStrategy } from '../strategies/FreeStrategy';
import { BasicStrategy } from '../strategies/BasicStrategy';
import { ProStrategy } from '../strategies/ProStrategy';

class StrategyFactory {
  private strategies: Map<string, ISubscriptionStrategy> = new Map([
    ['free', new FreeStrategy()],
    ['basic', new BasicStrategy()],
    ['pro', new ProStrategy()]
  ]);

  /**
   * 구독 등급에 맞는 전략 반환
   */
  getStrategy(tier: string): ISubscriptionStrategy {
    const strategy = this.strategies.get(tier.toLowerCase());

    if (!strategy) {
      console.warn(`Unknown tier: ${tier}, falling back to free`);
      return this.strategies.get('free')!;
    }

    return strategy;
  }

  /**
   * 새로운 전략 등록 (확장 가능)
   */
  registerStrategy(tier: string, strategy: ISubscriptionStrategy): void {
    this.strategies.set(tier.toLowerCase(), strategy);
  }
}

export const strategyFactory = new StrategyFactory();
```

### 전략 사용

```typescript
// client/services/ImageProcessor.ts

import { strategyFactory } from '../core/StrategyFactory';
import { subscriptionManager } from './SubscriptionManager';

export class ImageProcessor {
  async processImages(files: string[], outputFormat: string): Promise<void> {
    // 현재 구독 정보 가져오기
    const subscription = await subscriptionManager.checkSubscription();

    // 전략 선택
    const strategy = strategyFactory.getStrategy(subscription.tier);

    // 변환 전 검증
    const validation = await strategy.validateConversion(files, outputFormat);

    if (!validation.valid) {
      throw new Error(validation.errors?.join('\n'));
    }

    if (validation.warnings) {
      // 경고 표시
      const proceed = await dialog.showMessageBox({
        type: 'warning',
        message: validation.warnings.join('\n'),
        buttons: ['계속', '취소']
      });

      if (proceed.response !== 0) return;
    }

    // 변환 수행
    for (const file of files) {
      const result = await this.convertFile(file, outputFormat);

      // 전략별 후처리
      await strategy.postProcess(result);
    }
  }
}
```

---

## 모듈러 모놀리스

### 개념

마이크로서비스의 복잡성 없이, 명확한 경계를 가진 모듈로 구성된 단일 애플리케이션입니다.

### 디렉토리 구조

```
client/
├── modules/
│   ├── conversion/              # 변환 모듈
│   │   ├── ConversionService.ts
│   │   ├── ConversionUI.tsx
│   │   ├── types.ts
│   │   └── index.ts             # Public API
│   │
│   ├── subscription/            # 구독 모듈
│   │   ├── SubscriptionManager.ts
│   │   ├── SubscriptionUI.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── device/                  # 기기 인증 모듈
│   │   ├── DeviceManager.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── log/                     # 로그 모듈
│   │   ├── LogManager.ts
│   │   ├── LogUI.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── backup/                  # 백업 모듈
│   │   ├── BackupManager.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── analytics/               # 분석 모듈
│       ├── AnalyticsService.ts
│       ├── types.ts
│       └── index.ts
│
└── core/                        # 코어 인프라
    ├── EventBus.ts
    ├── PluginRegistry.ts
    ├── FeatureFlagManager.ts
    └── StrategyFactory.ts
```

### 모듈 경계 규칙

```typescript
// 각 모듈의 index.ts는 Public API만 노출

// ✅ Good: modules/conversion/index.ts
export { ConversionService } from './ConversionService';
export type { ConversionOptions, ConversionResult } from './types';
// ConversionUI는 외부에 노출하지 않음 (내부 구현)

// ❌ Bad: 내부 구현 노출
export { InternalHelper } from './internal/InternalHelper';
```

```typescript
// 다른 모듈 사용 시 Public API만 import

// ✅ Good
import { ConversionService } from '../modules/conversion';
import type { ConversionOptions } from '../modules/conversion';

// ❌ Bad: 내부 구현 직접 import
import { ConversionService } from '../modules/conversion/ConversionService';
import { InternalHelper } from '../modules/conversion/internal/InternalHelper';
```

### 모듈 간 통신

```typescript
// 모듈 간 직접 호출 대신 이벤트 사용

// ❌ Bad: 직접 의존
class LogManager {
  constructor(private conversionService: ConversionService) {}

  async logConversion() {
    const result = await this.conversionService.getLastResult();
    // ...
  }
}

// ✅ Good: 이벤트 기반
class LogManager {
  constructor() {
    onEvent('conversion:completed', async ({ result }) => {
      await this.logConversion(result);
    });
  }
}
```

### 모듈 독립성 체크리스트

```yaml
모듈_독립성_체크:
  - [ ] 모듈 내부 구현이 외부에 노출되지 않음
  - [ ] index.ts에서 Public API만 export
  - [ ] 다른 모듈의 내부 구현에 직접 의존하지 않음
  - [ ] 모듈 간 통신은 이벤트나 명확한 인터페이스를 통해서만
  - [ ] 각 모듈은 독립적으로 테스트 가능
  - [ ] 한 모듈의 변경이 다른 모듈에 영향을 주지 않음
```

---

## Configuration as Data

### 개념

하드코딩된 값을 데이터베이스나 설정 파일로 이동하여, 코드 변경 없이 설정 변경이 가능합니다.

### 하드코딩 예제 (❌ Bad)

```typescript
// ❌ Bad: 하드코딩된 구독 등급
class SubscriptionValidator {
  canConvert(tier: string, format: string): boolean {
    if (tier === 'free') {
      return format === 'webp';
    } else if (tier === 'basic') {
      return ['webp', 'avif'].includes(format);
    } else if (tier === 'pro') {
      return true;
    }
    return false;
  }

  getMaxBatchSize(tier: string): number {
    if (tier === 'free') return 10;
    if (tier === 'basic') return 50;
    if (tier === 'pro') return 200;
    return 0;
  }
}
```

### Configuration as Data 예제 (✅ Good)

```typescript
// ✅ Good: 데이터베이스에서 설정 로드

interface TierConfig {
  id: string;
  name: string;
  features: {
    formats: string[];
    max_batch_size: number;
    backup: boolean;
    log: boolean;
  };
}

class SubscriptionValidator {
  private tierConfigs: Map<string, TierConfig> = new Map();

  async loadConfigs(): Promise<void> {
    const { data: tiers } = await supabase
      .from('subscription_tiers')
      .select('*');

    tiers.forEach(tier => {
      this.tierConfigs.set(tier.name, {
        id: tier.id,
        name: tier.name,
        features: tier.features
      });
    });
  }

  canConvert(tier: string, format: string): boolean {
    const config = this.tierConfigs.get(tier);
    if (!config) return false;

    return config.features.formats.includes(format);
  }

  getMaxBatchSize(tier: string): number {
    const config = this.tierConfigs.get(tier);
    return config?.features.max_batch_size || 0;
  }
}
```

### 설정 업데이트 (코드 변경 없음)

```sql
-- 관리자 대시보드에서 실행
-- Pro 등급의 배치 크기 증가
UPDATE subscription_tiers
SET features = jsonb_set(features, '{max_batch_size}', '500')
WHERE name = 'pro';

-- 새 포맷 추가
UPDATE subscription_tiers
SET features = jsonb_set(
  features,
  '{formats}',
  features->'formats' || '["jxl"]'::jsonb
)
WHERE name = 'pro';
```

### 설정 핫 리로드

```typescript
// client/core/ConfigManager.ts

class ConfigManager {
  private configs: Map<string, any> = new Map();
  private reloadInterval: NodeJS.Timeout | null = null;

  /**
   * 주기적으로 설정 리로드
   */
  startAutoReload(intervalMs: number = 300000): void {
    this.reloadInterval = setInterval(async () => {
      await this.reloadConfigs();
    }, intervalMs);
  }

  stopAutoReload(): void {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }
  }

  async reloadConfigs(): Promise<void> {
    console.log('[ConfigManager] Reloading configurations...');

    // 구독 등급 설정
    const { data: tiers } = await supabase
      .from('subscription_tiers')
      .select('*');

    this.configs.set('tiers', tiers);

    // 피처 플래그
    const { data: flags } = await supabase
      .from('feature_flags')
      .select('*');

    this.configs.set('feature_flags', flags);

    // 이벤트 발행
    emitEvent('config:reloaded', { timestamp: new Date() });
  }

  get<T>(key: string): T | undefined {
    return this.configs.get(key);
  }
}

export const configManager = new ConfigManager();
```

---

## 미래 확장 시나리오

### 1. 클라우드 스토리지 연동

```typescript
// 추가될 플러그인: CloudStoragePlugin

interface ICloudStorage {
  readonly id: string;
  readonly name: string;

  connect(credentials: any): Promise<void>;
  upload(localPath: string, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  list(remotePath: string): Promise<string[]>;
}

class DropboxStorage implements ICloudStorage {
  readonly id = 'dropbox';
  readonly name = 'Dropbox';

  async connect(credentials: any): Promise<void> {
    // Dropbox API 연동
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    // 업로드 로직
  }
}

class GoogleDriveStorage implements ICloudStorage {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';

  async connect(credentials: any): Promise<void> {
    // Google Drive API 연동
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    // 업로드 로직
  }
}

// 사용
cloudStorageRegistry.register(new DropboxStorage());
cloudStorageRegistry.register(new GoogleDriveStorage());
```

### 2. AI 기능 (업스케일링)

```typescript
// 추가될 플러그인: AIUpscalerPlugin

interface IAIUpscaler {
  readonly id: string;
  readonly name: string;
  readonly supportedModels: string[];

  upscale(
    inputPath: string,
    outputPath: string,
    options: UpscaleOptions
  ): Promise<UpscaleResult>;
}

interface UpscaleOptions {
  scale: number;           // 2x, 4x, 8x
  model: string;           // 'general', 'photo', 'anime'
  denoise: number;         // 0-1
  preserve_details: boolean;
}

class RealESRGANUpscaler implements IAIUpscaler {
  readonly id = 'real-esrgan';
  readonly name = 'Real-ESRGAN';
  readonly supportedModels = ['general', 'anime'];

  async upscale(
    inputPath: string,
    outputPath: string,
    options: UpscaleOptions
  ): Promise<UpscaleResult> {
    // Real-ESRGAN 실행
    // Python 스크립트 호출 또는 ONNX 모델 사용
  }
}

// subscription_tiers 테이블에 추가
UPDATE subscription_tiers
SET features = jsonb_set(features, '{ai_upscaling}', 'true')
WHERE name = 'pro';
```

### 3. 배치 작업 스케줄링

```typescript
// 추가될 모듈: scheduler

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;        // cron 표현식
  task: () => Promise<void>;
  enabled: boolean;
}

class JobScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();

  register(job: ScheduledJob): void {
    this.jobs.set(job.id, job);

    // node-cron 사용
    if (job.enabled) {
      cron.schedule(job.schedule, job.task);
    }
  }

  enable(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = true;
      cron.schedule(job.schedule, job.task);
    }
  }

  disable(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = false;
      // cron job 정지
    }
  }
}

// 사용 예제
jobScheduler.register({
  id: 'nightly-backup',
  name: '야간 자동 백업',
  schedule: '0 2 * * *',  // 매일 오전 2시
  task: async () => {
    await backupManager.backupAll();
  },
  enabled: true
});
```

### 4. 팀 구독 (멀티 유저)

```sql
-- 새 테이블 추가
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 팀 구독 등급 추가
INSERT INTO subscription_tiers (name, display_name, features, price_monthly, device_limit)
VALUES (
  'team',
  '{"ko": "팀", "en": "Team"}'::jsonb,
  '{
    "formats": ["webp", "avif", "jxl"],
    "max_batch_size": 500,
    "backup": true,
    "log": true,
    "ai_upscaling": true,
    "cloud_storage": true,
    "max_team_members": 10
  }'::jsonb,
  99.00,
  50
);
```

```typescript
// 추가될 모듈: team

class TeamManager {
  async createTeam(name: string, ownerId: string): Promise<Team> {
    // 팀 생성
  }

  async inviteMember(teamId: string, email: string): Promise<void> {
    // 멤버 초대 (이메일 발송)
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    // 멤버 제거
  }

  async getTeamUsage(teamId: string): Promise<TeamUsage> {
    // 팀 전체 사용량 조회
  }
}
```

### 5. 플러그인 마켓플레이스

```typescript
// 추가될 모듈: marketplace

interface PluginPackage {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  price: number;
  downloadUrl: string;
  rating: number;
}

class PluginMarketplace {
  async searchPlugins(query: string): Promise<PluginPackage[]> {
    // 플러그인 검색
  }

  async downloadPlugin(pluginId: string): Promise<string> {
    // 플러그인 다운로드 및 로컬 저장
  }

  async installPlugin(packagePath: string): Promise<void> {
    // 플러그인 설치 및 등록
    const plugin = await this.loadPlugin(packagePath);
    pluginRegistry.register(plugin);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    // 플러그인 제거
    pluginRegistry.unregister(pluginId);
  }

  private async loadPlugin(packagePath: string): Promise<IImageConverter> {
    // 플러그인 로드 (동적 import)
    const module = await import(packagePath);
    return new module.default();
  }
}
```

---

## 실전 예제

### 예제 1: 새 포맷 추가 (JXL)

#### 1단계: 플러그인 구현

```typescript
// client/plugins/JXLConverter.ts

export class JXLConverter implements IImageConverter {
  readonly id = 'jxl-converter';
  readonly name = 'JPEG XL Converter';
  readonly supportedInputFormats = ['jpg', 'jpeg', 'png'];
  readonly supportedOutputFormats = ['jxl'];

  canConvert(input: string, output: string): boolean {
    return this.supportedInputFormats.includes(input.toLowerCase()) &&
           this.supportedOutputFormats.includes(output.toLowerCase());
  }

  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // JXL 변환 로직
    // (Sharp는 아직 JXL을 직접 지원하지 않으므로, cjxl 명령어 사용)

    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    const startTime = Date.now();
    const inputStats = await fs.stat(inputPath);

    try {
      await execFileAsync('cjxl', [
        inputPath,
        outputPath,
        '--quality', (options.quality || 90).toString()
      ]);

      const outputStats = await fs.stat(outputPath);
      const duration = Date.now() - startTime;

      return {
        success: true,
        outputPath,
        metadata: {
          originalSize: inputStats.size,
          newSize: outputStats.size,
          compressionRatio: (1 - outputStats.size / inputStats.size) * 100,
          duration
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

#### 2단계: 플러그인 등록

```typescript
// client/core/AppInitializer.ts

import { JXLConverter } from '../plugins/JXLConverter';

export async function initializePlugins(): Promise<void> {
  // 기존 플러그인
  pluginRegistry.register(new WebPConverter());
  pluginRegistry.register(new AVIFConverter());

  // 새 플러그인 추가
  const jxlConverter = new JXLConverter();
  await jxlConverter.initialize?.();
  pluginRegistry.register(jxlConverter);
}
```

#### 3단계: 데이터베이스 설정 업데이트

```sql
-- Pro 등급에 JXL 포맷 추가
UPDATE subscription_tiers
SET features = jsonb_set(
  features,
  '{formats}',
  features->'formats' || '["jxl"]'::jsonb
)
WHERE name = 'pro';
```

#### 결과

- ✅ 코드 수정 없이 새 포맷 지원
- ✅ 기존 변환 로직 재사용
- ✅ 데이터베이스 설정으로 등급별 제어
- ✅ UI는 자동으로 새 포맷 표시

---

### 예제 2: A/B 테스트 (AI 업스케일링)

#### 1단계: 피처 플래그 생성

```sql
-- AI 업스케일링 피처 플래그
INSERT INTO feature_flags (key, name, description, min_tier_id, is_enabled, config)
VALUES (
  'ai_upscaling',
  '{"ko": "AI 업스케일링", "en": "AI Upscaling"}'::jsonb,
  '{"ko": "AI를 사용한 고급 이미지 품질 향상", "en": "Advanced image quality enhancement using AI"}'::jsonb,
  (SELECT id FROM subscription_tiers WHERE name = 'pro'),
  false,  -- 전역적으로는 비활성화
  '{
    "models": ["general", "anime"],
    "max_scale": 4,
    "gpu_required": false
  }'::jsonb
);
```

#### 2단계: A/B 테스트 설정 (50% 사용자)

```typescript
// admin/scripts/setup-ab-test.ts

import { createABTest } from '../services/ABTestService';

async function main() {
  await createABTest('ai_upscaling', 50);  // 50% 사용자에게 활성화
  console.log('A/B test created for AI upscaling');
}

main();
```

#### 3단계: 클라이언트 코드 (변경 없음)

```typescript
// client/components/ConversionSettings.tsx

export function ConversionSettings() {
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    async function checkAI() {
      // 피처 플래그 시스템이 자동으로 A/B 테스트 처리
      const enabled = await featureFlagManager.isEnabled('ai_upscaling');
      setAiEnabled(enabled);
    }
    checkAI();
  }, []);

  return (
    <div>
      {aiEnabled && (
        <div className="ai-upscaling">
          <h3>AI 업스케일링 (Beta)</h3>
          <AIUpscalingControls />
        </div>
      )}
    </div>
  );
}
```

#### 4단계: 결과 분석 후 전체 롤아웃

```typescript
// admin/scripts/analyze-and-rollout.ts

import { analyzeABTest } from '../services/ABTestService';

async function main() {
  const results = await analyzeABTest('ai_upscaling');

  console.log('Control group:', results.controlGroup);
  console.log('Test group:', results.testGroup);

  // 결과가 긍정적이면 전체 롤아웃
  if (results.testGroup.avgUsage > results.controlGroup.avgUsage * 1.2) {
    await supabaseAdmin
      .from('feature_flags')
      .update({ is_enabled: true })
      .eq('key', 'ai_upscaling');

    console.log('AI upscaling rolled out to all Pro users');
  }
}

main();
```

#### 결과

- ✅ 코드 변경 없이 A/B 테스트 수행
- ✅ 사용자 경험 데이터 수집
- ✅ 점진적 롤아웃 가능
- ✅ 문제 발생 시 즉시 롤백 가능

---

### 예제 3: 새 구독 등급 추가 (Enterprise)

#### 1단계: 데이터베이스에 등급 추가

```sql
INSERT INTO subscription_tiers (
  name,
  display_name,
  features,
  price_monthly,
  device_limit,
  sort_order,
  is_active
)
VALUES (
  'enterprise',
  '{"ko": "엔터프라이즈", "en": "Enterprise"}'::jsonb,
  '{
    "formats": ["webp", "avif", "jxl"],
    "scopes": ["file", "folder"],
    "backup": true,
    "log": true,
    "max_batch_size": 1000,
    "ai_upscaling": true,
    "cloud_storage": true,
    "priority_support": true,
    "api_access": true,
    "custom_branding": true
  }'::jsonb,
  299.00,
  100,  -- 100대 기기
  4,    -- sort_order
  true
);
```

#### 2단계: 전략 클래스 추가

```typescript
// client/strategies/EnterpriseStrategy.ts

export class EnterpriseStrategy implements ISubscriptionStrategy {
  readonly tier = 'enterprise';

  canConvert(format: string): boolean {
    return true;  // 모든 포맷
  }

  getMaxBatchSize(): number {
    return 1000;
  }

  canUseBackup(): boolean {
    return true;
  }

  canUseLog(): boolean {
    return true;
  }

  async validateConversion(files: string[], format: string): Promise<ValidationResult> {
    // Enterprise는 제한 없음
    return { valid: true };
  }

  async postProcess(result: ConversionResult): Promise<void> {
    // 모든 기능 활성화
    await backupManager.backup(result.inputPath);
    await logManager.logDetailed(result);
    await analyticsService.track('conversion_completed', result);

    // 우선 지원팀에 알림
    if (result.success) {
      await notificationService.notifySupport('conversion_success', result);
    }
  }
}
```

#### 3단계: 전략 팩토리에 등록

```typescript
// client/core/StrategyFactory.ts

class StrategyFactory {
  private strategies: Map<string, ISubscriptionStrategy> = new Map([
    ['free', new FreeStrategy()],
    ['basic', new BasicStrategy()],
    ['pro', new ProStrategy()],
    ['enterprise', new EnterpriseStrategy()]  // 새 전략 추가
  ]);

  // ... 나머지 코드 동일
}
```

#### 4단계: UI 업데이트 (자동)

```typescript
// client/components/PricingPage.tsx

export function PricingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);

  useEffect(() => {
    async function fetchTiers() {
      // 데이터베이스에서 자동으로 로드
      const { data } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      setTiers(data || []);
    }
    fetchTiers();
  }, []);

  return (
    <div className="pricing-grid">
      {tiers.map(tier => (
        <PricingCard key={tier.id} tier={tier} />
      ))}
    </div>
  );
}
```

#### 결과

- ✅ 코드 수정 최소화 (전략 클래스 1개 추가)
- ✅ UI 자동 업데이트 (데이터베이스 기반)
- ✅ 기존 로직 재사용
- ✅ 새 등급만의 특별 기능 추가 가능

---

## 마무리

### 확장 가능한 시스템 체크리스트

```yaml
✅ 플러그인_시스템:
  - [ ] IImageConverter 인터페이스 구현
  - [ ] PluginRegistry에 등록
  - [ ] 새 변환기 추가 시 기존 코드 수정 불필요

✅ 피처_플래그:
  - [ ] feature_flags 테이블 활용
  - [ ] FeatureFlagManager로 중앙 관리
  - [ ] A/B 테스트 가능
  - [ ] 코드 배포 없이 기능 제어

✅ 이벤트_시스템:
  - [ ] EventBus로 모듈 간 통신
  - [ ] 강한 결합 제거
  - [ ] 새 리스너 추가 시 기존 코드 수정 불필요

✅ 전략_패턴:
  - [ ] 구독 등급별 ISubscriptionStrategy 구현
  - [ ] StrategyFactory로 전략 선택
  - [ ] if/else 체인 제거

✅ 모듈러_모놀리스:
  - [ ] 명확한 모듈 경계
  - [ ] Public API만 노출
  - [ ] 독립적 테스트 가능

✅ Configuration_as_Data:
  - [ ] 하드코딩된 값 제거
  - [ ] subscription_tiers 테이블 활용
  - [ ] 설정 핫 리로드 지원
```

### 추가 학습 자료

- **플러그인 패턴**: [Martin Fowler - Plugin](https://martinfowler.com/articles/plugins.html)
- **이벤트 드리븐**: [Event-Driven Architecture Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-integrating-microservices/event-driven-architecture.html)
- **전략 패턴**: [Refactoring Guru - Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
- **Feature Flags**: [LaunchDarkly - Feature Flag Best Practices](https://launchdarkly.com/blog/feature-flag-best-practices/)

---

**다음 읽을 문서**:
- [subscription-service.md](./subscription-service.md) - 구독 서비스 구현
- [security-architecture.md](./security-architecture.md) - 보안 아키텍처
- [system-overview.md](./system-overview.md) - 전체 시스템 개요

**관련 구현**:
- `client/core/PluginRegistry.ts`
- `client/core/EventBus.ts`
- `client/core/FeatureFlagManager.ts`
- `client/core/StrategyFactory.ts`
