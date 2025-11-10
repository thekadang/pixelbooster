/**
 * SecureStorage - 민감 데이터 암호화 저장 서비스
 *
 * 역할:
 * - JWT 토큰 암호화 저장
 * - 기기 ID 저장
 * - 사용자 설정 저장
 * - machine-id 기반 암호화
 *
 * 보안:
 * - electron-store로 데이터 암호화
 * - 기기 고유 ID를 암호화 키로 사용
 * - 평문 저장 금지
 */

import Store from 'electron-store';
import { machineIdSync } from 'node-machine-id';

// 저장 데이터 타입
interface SecureData {
  auth_token?: string;
  refresh_token?: string;
  device_id?: string;
  user_id?: string;
  last_login?: string;
  subscription_cache?: {
    tier: string;
    expires_at: string;
    cached_at: string;
  };
}

/**
 * SecureStorage 클래스
 * Singleton 패턴으로 구현
 */
class SecureStorage {
  private store: any; // electron-store 타입 이슈 우회
  private encryptionKey: string;

  constructor() {
    try {
      // 기기 고유 ID를 암호화 키로 사용
      this.encryptionKey = machineIdSync(true);

      // electron-store 초기화
      this.store = new Store<SecureData>({
        name: 'secure-data',
        encryptionKey: this.encryptionKey,
        // 파일 위치: AppData/Roaming/pixelbooster/secure-data.json
        // Windows: C:\Users\[username]\AppData\Roaming\pixelbooster\
        // macOS: ~/Library/Application Support/pixelbooster/
      });

      console.log('SecureStorage 초기화 완료');
    } catch (error) {
      console.error('SecureStorage 초기화 실패:', error);
      throw new Error('보안 저장소 초기화에 실패했습니다.');
    }
  }

  /**
   * 액세스 토큰 저장
   */
  public setAuthToken(token: string): void {
    try {
      this.store.set('auth_token', token);
      console.log('액세스 토큰 저장 완료');
    } catch (error) {
      console.error('토큰 저장 실패:', error);
      throw new Error('토큰 저장에 실패했습니다.');
    }
  }

  /**
   * 액세스 토큰 조회
   */
  public getAuthToken(): string | null {
    try {
      return this.store.get('auth_token') || null;
    } catch (error) {
      console.error('토큰 조회 실패:', error);
      return null;
    }
  }

  /**
   * 리프레시 토큰 저장
   */
  public setRefreshToken(token: string): void {
    try {
      this.store.set('refresh_token', token);
      console.log('리프레시 토큰 저장 완료');
    } catch (error) {
      console.error('리프레시 토큰 저장 실패:', error);
      throw new Error('리프레시 토큰 저장에 실패했습니다.');
    }
  }

  /**
   * 리프레시 토큰 조회
   */
  public getRefreshToken(): string | null {
    try {
      return this.store.get('refresh_token') || null;
    } catch (error) {
      console.error('리프레시 토큰 조회 실패:', error);
      return null;
    }
  }

  /**
   * 기기 ID 저장
   */
  public setDeviceId(deviceId: string): void {
    try {
      this.store.set('device_id', deviceId);
      console.log('기기 ID 저장 완료');
    } catch (error) {
      console.error('기기 ID 저장 실패:', error);
      throw new Error('기기 ID 저장에 실패했습니다.');
    }
  }

  /**
   * 기기 ID 조회
   */
  public getDeviceId(): string | null {
    try {
      return this.store.get('device_id') || null;
    } catch (error) {
      console.error('기기 ID 조회 실패:', error);
      return null;
    }
  }

  /**
   * 사용자 ID 저장
   */
  public setUserId(userId: string): void {
    try {
      this.store.set('user_id', userId);
      console.log('사용자 ID 저장 완료');
    } catch (error) {
      console.error('사용자 ID 저장 실패:', error);
      throw new Error('사용자 ID 저장에 실패했습니다.');
    }
  }

  /**
   * 사용자 ID 조회
   */
  public getUserId(): string | null {
    try {
      return this.store.get('user_id') || null;
    } catch (error) {
      console.error('사용자 ID 조회 실패:', error);
      return null;
    }
  }

  /**
   * 마지막 로그인 시간 저장
   */
  public setLastLogin(timestamp: string): void {
    try {
      this.store.set('last_login', timestamp);
    } catch (error) {
      console.error('로그인 시간 저장 실패:', error);
    }
  }

  /**
   * 마지막 로그인 시간 조회
   */
  public getLastLogin(): string | null {
    try {
      return this.store.get('last_login') || null;
    } catch (error) {
      console.error('로그인 시간 조회 실패:', error);
      return null;
    }
  }

  /**
   * 구독 정보 캐시 저장 (1시간 TTL)
   */
  public setSubscriptionCache(tier: string, expiresAt: string): void {
    try {
      this.store.set('subscription_cache', {
        tier,
        expires_at: expiresAt,
        cached_at: new Date().toISOString(),
      });
      console.log('구독 정보 캐시 저장:', tier);
    } catch (error) {
      console.error('구독 캐시 저장 실패:', error);
    }
  }

  /**
   * 구독 정보 캐시 조회 (1시간 TTL 확인)
   */
  public getSubscriptionCache(): { tier: string; expires_at: string } | null {
    try {
      const cache = this.store.get('subscription_cache');

      if (!cache) {
        return null;
      }

      // 캐시 만료 확인 (1시간)
      const cachedAt = new Date(cache.cached_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 1) {
        console.log('구독 캐시 만료됨');
        this.clearSubscriptionCache();
        return null;
      }

      return {
        tier: cache.tier,
        expires_at: cache.expires_at,
      };
    } catch (error) {
      console.error('구독 캐시 조회 실패:', error);
      return null;
    }
  }

  /**
   * 구독 캐시 삭제
   */
  public clearSubscriptionCache(): void {
    try {
      this.store.delete('subscription_cache');
      console.log('구독 캐시 삭제 완료');
    } catch (error) {
      console.error('구독 캐시 삭제 실패:', error);
    }
  }

  /**
   * 모든 데이터 삭제 (로그아웃 시)
   */
  public clear(): void {
    try {
      // 기기 ID는 유지 (재로그인 시 사용)
      const deviceId = this.getDeviceId();

      this.store.clear();

      if (deviceId) {
        this.setDeviceId(deviceId);
      }

      console.log('SecureStorage 초기화 완료');
    } catch (error) {
      console.error('SecureStorage 초기화 실패:', error);
      throw new Error('저장소 초기화에 실패했습니다.');
    }
  }

  /**
   * 완전 삭제 (앱 제거 시)
   */
  public clearAll(): void {
    try {
      this.store.clear();
      console.log('SecureStorage 완전 삭제 완료');
    } catch (error) {
      console.error('SecureStorage 삭제 실패:', error);
      throw new Error('저장소 삭제에 실패했습니다.');
    }
  }

  /**
   * 저장된 모든 키 조회 (디버깅용)
   */
  public getAllKeys(): string[] {
    try {
      return Object.keys(this.store.store);
    } catch (error) {
      console.error('키 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 키 존재 여부 확인
   */
  public has(key: keyof SecureData): boolean {
    try {
      return this.store.has(key);
    } catch (error) {
      console.error('키 확인 실패:', error);
      return false;
    }
  }
}

// Singleton 인스턴스 생성 및 export
export const secureStorage = new SecureStorage();
export default secureStorage;
