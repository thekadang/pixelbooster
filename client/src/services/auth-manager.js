"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.authManager = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * AuthManager 클래스
 * Singleton 패턴으로 구현
 */
class AuthManager {
    constructor() {
        this.listeners = [];
        // Supabase 클라이언트 초기화
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
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
    async initializeSession() {
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
        }
        catch (error) {
            console.error('세션 초기화 에러:', error);
        }
    }
    /**
     * 인증 상태 업데이트
     */
    updateAuthState(session) {
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
    onAuthStateChange(callback) {
        this.listeners.push(callback);
        // 언마운트 함수 반환
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }
    /**
     * 리스너에게 상태 변경 알림
     */
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.authState));
    }
    /**
     * 로그인
     *
     * @param credentials - 이메일/비밀번호
     * @returns Result<Session>
     */
    async signIn(credentials) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
            });
            if (error) {
                // 에러 메시지 한글화
                const errorMessage = this.translateAuthError(error.message);
                return { success: false, error: errorMessage };
            }
            if (!data.session) {
                return { success: false, error: '세션 생성에 실패했습니다.' };
            }
            // 이메일 인증 확인
            if (!data.user.email_confirmed_at) {
                return {
                    success: false,
                    error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
                };
            }
            console.log('로그인 성공:', data.user.email);
            return { success: true, data: data.session };
        }
        catch (error) {
            console.error('로그인 에러:', error);
            return {
                success: false,
                error: `로그인 실패: ${error.message}`,
            };
        }
    }
    /**
     * 회원가입
     *
     * @param options - 이메일/비밀번호/메타데이터
     * @returns Result<User>
     */
    async signUp(options) {
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
        }
        catch (error) {
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
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) {
                return { success: false, error: error.message };
            }
            console.log('로그아웃 완료');
            return { success: true, data: undefined };
        }
        catch (error) {
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
    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'pixelbooster://reset-password',
            });
            if (error) {
                return { success: false, error: error.message };
            }
            return { success: true, data: undefined };
        }
        catch (error) {
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
    async resendEmailConfirmation(email) {
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
        }
        catch (error) {
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
    getAuthState() {
        return this.authState;
    }
    /**
     * 현재 사용자 반환
     */
    getCurrentUser() {
        return this.authState.user;
    }
    /**
     * 현재 세션 반환
     */
    getCurrentSession() {
        return this.authState.session;
    }
    /**
     * 인증 여부 확인
     */
    isAuthenticated() {
        return this.authState.isAuthenticated;
    }
    /**
     * 액세스 토큰 반환 (API 호출 시 사용)
     */
    getAccessToken() {
        return this.authState.session?.access_token || null;
    }
    /**
     * Supabase Auth 에러 메시지 한글화
     */
    translateAuthError(errorMessage) {
        const errorMap = {
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
exports.authManager = new AuthManager();
exports.default = exports.authManager;
//# sourceMappingURL=auth-manager.js.map