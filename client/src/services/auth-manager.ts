/**
 * AuthManager - Supabase Auth 연동 서비스
 *
 * 역할:
 * - 로그인/회원가입/로그아웃 처리
 * - JWT 토큰 관리
 * - 세션 유지
 * - 이메일 인증 처리
 *
 * 보안:
 * - anon key만 사용 (service_role key는 서버에만)
 * - RLS로 보호된 데이터 접근
 * - 토큰은 SecureStorage에 암호화 저장
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import DeviceManager from './device-manager';

// Result 타입 패턴
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// 인증 정보 타입
interface AuthCredentials {
  email: string;
  password: string;
}

// 회원가입 옵션
interface SignUpOptions {
  email: string;
  password: string;
  metadata?: {
    fullName?: string;
    [key: string]: any;
  };
}

// 인증 상태
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

/**
 * AuthManager 클래스
 * Singleton 패턴으로 구현
 */
class AuthManager {
  private supabase: SupabaseClient;
  private authState: AuthState;
  private listeners: Array<(state: AuthState) => void> = [];

  constructor() {
    // Supabase 클라이언트 초기화
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 초기 상태
    this.authState = {
      user: null,
      session: null,
      isAuthenticated: false,
    };

    // 세션 복원 시도
    this.initializeSession();

    // 세션 변경 감지
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('인증 상태 변경:', event);
      this.updateAuthState(session);
    });
  }

  /**
   * 초기 세션 복원
   */
  private async initializeSession(): Promise<void> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('세션 복원 실패:', error);
        return;
      }

      if (session) {
        this.updateAuthState(session);
        console.log('세션 복원 완료:', session.user.email);
      }
    } catch (error) {
      console.error('세션 초기화 에러:', error);
    }
  }

  /**
   * 인증 상태 업데이트
   */
  private updateAuthState(session: Session | null): void {
    this.authState = {
      user: session?.user || null,
      session: session,
      isAuthenticated: !!session,
    };

    // 리스너에게 알림
    this.notifyListeners();
  }

  /**
   * 상태 변경 리스너 등록
   */
  public onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.listeners.push(callback);

    // 언마운트 함수 반환
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * 리스너에게 상태 변경 알림
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  /**
   * 로그인 (기기 인증 포함)
   *
   * @param credentials - 이메일/비밀번호
   * @returns Result<Session>
   */
  public async signIn(credentials: AuthCredentials): Promise<Result<Session>> {
    try {
      // 1. 기기 ID 및 이름 가져오기
      const deviceId = await DeviceManager.getDeviceId();
      const deviceName = DeviceManager.generateDeviceName();

      console.log('[AuthManager] Device info:', { deviceId, deviceName });

      // 2. Edge Function 호출 (login-with-device-check)
      const supabaseUrl = process.env.SUPABASE_URL!;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/login-with-device-check`;

      console.log('[AuthManager] Calling Edge Function:', edgeFunctionUrl);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          deviceId,
          deviceName,
        }),
      });

      console.log('[AuthManager] Edge Function response status:', response.status);

      // 응답 본문 파싱 시도
      let result: any;
      try {
        result = await response.json();
        console.log('[AuthManager] Edge Function result:', result);
      } catch (parseError) {
        console.error('[AuthManager] Failed to parse response:', parseError);
        return {
          success: false,
          error: `서버 응답 파싱 실패 (상태: ${response.status})`,
        };
      }

      if (!response.ok) {
        // 에러 처리
        console.error('[AuthManager] Edge Function error:', {
          status: response.status,
          error: result.error,
          message: result.message,
          details: result.details,
        });

        if (result.error === 'Device limit exceeded') {
          // 기기 한도 초과
          return {
            success: false,
            error: result.message || '기기 한도를 초과했습니다.',
          };
        }

        // 기타 에러 - 더 상세한 메시지 제공
        const errorMessage = result.message || result.error || '로그인에 실패했습니다.';
        const errorDetails = result.details ? `\n상세: ${result.details}` : '';

        return {
          success: false,
          error: `${this.translateAuthError(errorMessage)}${errorDetails}`
        };
      }

      // 3. 성공 - 세션 설정
      const { token, refresh_token, user, subscription, device } = result;

      // Supabase 세션 설정
      const { data: sessionData, error: sessionError } = await this.supabase.auth.setSession({
        access_token: token,
        refresh_token: refresh_token,
      });

      if (sessionError || !sessionData.session) {
        console.error('[AuthManager] Session setting failed:', sessionError);
        return { success: false, error: '세션 설정에 실패했습니다.' };
      }

      console.log('[AuthManager] Login successful:', {
        email: user.email,
        tier: subscription.tier,
        deviceId: device.deviceId,
        isNewDevice: device.isNew,
      });

      return { success: true, data: sessionData.session };
    } catch (error: any) {
      console.error('[AuthManager] Login error:', error);

      // 네트워크 오류 판별
      if (error.message && error.message.includes('fetch')) {
        return {
          success: false,
          error: '서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.',
        };
      }

      // 기타 오류
      return {
        success: false,
        error: `기기 등록 실패: ${error.message || '알 수 없는 오류'}`,
      };
    }
  }

  /**
   * 회원가입
   *
   * @param options - 이메일/비밀번호/메타데이터
   * @returns Result<User>
   */
  public async signUp(options: SignUpOptions): Promise<Result<User>> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: options.email,
        password: options.password,
        options: {
          data: options.metadata || {},
          emailRedirectTo: 'pixelbooster://email-confirmed',
        },
      });

      if (error) {
        const errorMessage = this.translateAuthError(error.message);
        return { success: false, error: errorMessage };
      }

      if (!data.user) {
        return { success: false, error: '사용자 생성에 실패했습니다.' };
      }

      console.log('회원가입 성공:', data.user.email);
      return { success: true, data: data.user };
    } catch (error: any) {
      console.error('회원가입 에러:', error);
      return {
        success: false,
        error: `회원가입 실패: ${error.message}`,
      };
    }
  }

  /**
   * 로그아웃
   */
  public async signOut(): Promise<Result<void>> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      console.log('로그아웃 완료');
      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('로그아웃 에러:', error);
      return {
        success: false,
        error: `로그아웃 실패: ${error.message}`,
      };
    }
  }

  /**
   * 비밀번호 재설정 이메일 전송
   */
  public async resetPassword(email: string): Promise<Result<void>> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'pixelbooster://reset-password',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('비밀번호 재설정 에러:', error);
      return {
        success: false,
        error: `비밀번호 재설정 실패: ${error.message}`,
      };
    }
  }

  /**
   * 이메일 인증 재전송
   */
  public async resendEmailConfirmation(email: string): Promise<Result<void>> {
    try {
      const { error } = await this.supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: 'pixelbooster://email-confirmed',
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('이메일 재전송 에러:', error);
      return {
        success: false,
        error: `이메일 재전송 실패: ${error.message}`,
      };
    }
  }

  /**
   * 현재 인증 상태 반환
   */
  public getAuthState(): AuthState {
    return this.authState;
  }

  /**
   * 현재 사용자 반환
   */
  public getCurrentUser(): User | null {
    return this.authState.user;
  }

  /**
   * 현재 세션 반환
   */
  public getCurrentSession(): Session | null {
    return this.authState.session;
  }

  /**
   * 인증 여부 확인
   */
  public isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * 액세스 토큰 반환 (API 호출 시 사용)
   */
  public getAccessToken(): string | null {
    return this.authState.session?.access_token || null;
  }

  /**
   * Supabase Auth 에러 메시지 한글화
   */
  private translateAuthError(errorMessage: string): string {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'Email not confirmed': '이메일 인증이 필요합니다.',
      'User already registered': '이미 등록된 이메일입니다.',
      'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
      'Signup requires a valid password': '올바른 비밀번호를 입력해주세요.',
      'Invalid email': '유효하지 않은 이메일 형식입니다.',
    };

    return errorMap[errorMessage] || errorMessage;
  }
}

// Singleton 인스턴스 생성 및 export
export const authManager = new AuthManager();
export default authManager;
