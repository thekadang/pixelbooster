# Supabase 이메일 템플릿 설정 가이드

픽셀부스터의 이메일 인증 템플릿을 커스터마이징하는 방법을 안내합니다.

---

## 📧 이메일 템플릿 종류

Supabase에서 제공하는 이메일 템플릿은 다음과 같습니다:

1. **회원가입 인증 이메일** (Confirm signup)
2. **비밀번호 재설정 이메일** (Reset password)
3. **이메일 변경 인증** (Change email address)
4. **매직 링크 로그인** (Magic link)

---

## 🎨 이메일 템플릿 커스터마이징

### 1단계: Supabase Dashboard 접속

1. Supabase Dashboard → 프로젝트 선택
2. 좌측 메뉴에서 **Authentication** 클릭
3. **Email Templates** 탭 선택

### 2단계: 회원가입 인증 이메일 수정

**선택**: `Confirm signup` 템플릿

**수정 항목**:

#### 제목 (Subject)
```
픽셀부스터 - 이메일 인증을 완료해주세요 🚀
```

#### 본문 (Body)
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 32px;
      font-weight: bold;
      color: #8b5cf6;
    }
    .rocket {
      font-size: 40px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      padding: 16px 32px;
      background-color: #8b5cf6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #7c3aed;
    }
    .info-box {
      background-color: #f9f5ff;
      border-left: 4px solid #8b5cf6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 로고 -->
    <div class="logo">
      <div class="rocket">🚀</div>
      <div class="logo-text">픽셀부스터</div>
    </div>

    <!-- 인사말 -->
    <h1>환영합니다! 👋</h1>
    <p>
      픽셀부스터에 가입해 주셔서 감사합니다.<br>
      이메일 인증을 완료하면 모든 기능을 사용할 수 있습니다.
    </p>

    <!-- 인증 버튼 -->
    <div style="text-align: center;">
      <a href="{{ .ConfirmationURL }}" class="button">
        이메일 인증 완료하기
      </a>
    </div>

    <!-- 안내 사항 -->
    <div class="info-box">
      <strong>📌 유의사항</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>인증 링크는 <strong>24시간</strong> 동안 유효합니다</li>
        <li>버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣어 주세요</li>
        <li>본인이 요청하지 않은 이메일이라면 무시하셔도 됩니다</li>
      </ul>
    </div>

    <!-- 링크 복사용 -->
    <p style="font-size: 12px; color: #666; word-break: break-all;">
      링크: {{ .ConfirmationURL }}
    </p>

    <!-- 푸터 -->
    <div class="footer">
      <p>
        <strong>픽셀부스터</strong><br>
        세계를 만들어 시작하세요
      </p>
      <p style="font-size: 12px; margin-top: 10px;">
        질문이 있으시면 <a href="mailto:support@pixelbooster.com" style="color: #8b5cf6;">support@pixelbooster.com</a>으로 문의해 주세요.
      </p>
    </div>
  </div>
</body>
</html>
```

### 3단계: 비밀번호 재설정 이메일 수정

**선택**: `Reset password` 템플릿

#### 제목 (Subject)
```
픽셀부스터 - 비밀번호 재설정 요청
```

#### 본문 (Body)
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 32px;
      font-weight: bold;
      color: #8b5cf6;
    }
    .rocket {
      font-size: 40px;
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      padding: 16px 32px;
      background-color: #8b5cf6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #7c3aed;
    }
    .warning-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 로고 -->
    <div class="logo">
      <div class="rocket">🔐</div>
      <div class="logo-text">픽셀부스터</div>
    </div>

    <!-- 인사말 -->
    <h1>비밀번호 재설정</h1>
    <p>
      픽셀부스터 계정의 비밀번호 재설정 요청을 받았습니다.<br>
      아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
    </p>

    <!-- 재설정 버튼 -->
    <div style="text-align: center;">
      <a href="{{ .ConfirmationURL }}" class="button">
        비밀번호 재설정하기
      </a>
    </div>

    <!-- 경고 사항 -->
    <div class="warning-box">
      <strong>⚠️ 중요</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>이 링크는 <strong>1시간</strong> 동안만 유효합니다</li>
        <li>본인이 요청하지 않았다면 이 이메일을 무시하세요</li>
        <li>비밀번호는 타인과 절대 공유하지 마세요</li>
      </ul>
    </div>

    <!-- 링크 복사용 -->
    <p style="font-size: 12px; color: #666; word-break: break-all;">
      링크: {{ .ConfirmationURL }}
    </p>

    <!-- 푸터 -->
    <div class="footer">
      <p>
        <strong>픽셀부스터</strong><br>
        세계를 만들어 시작하세요
      </p>
      <p style="font-size: 12px; margin-top: 10px;">
        질문이 있으시면 <a href="mailto:support@pixelbooster.com" style="color: #8b5cf6;">support@pixelbooster.com</a>으로 문의해 주세요.
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 🔧 설정 완료 후 확인

### 1. Supabase Dashboard에서 테스트

1. **Email Templates** → `Send test email` 버튼 클릭
2. 테스트 이메일 주소 입력
3. 이메일 수신 확인

### 2. 실제 회원가입으로 테스트

1. 픽셀부스터 앱 실행
2. 회원가입 진행
3. 이메일 수신 확인
4. **"이메일 인증 완료하기"** 버튼 클릭
5. 앱에서 "이메일 인증 완료" 다이얼로그 표시 확인

---

## 🎯 Deep Link 동작 원리

### 이메일 링크 클릭 시 흐름

```
1. 사용자가 이메일의 "이메일 인증 완료하기" 버튼 클릭
   ↓
2. Supabase가 픽셀부스터 앱 실행 (pixelbooster://)
   ↓
3. main.ts의 handleDeepLink() 함수가 URL 파싱
   ↓
4. 이메일 인증 완료 다이얼로그 표시
   ↓
5. 사용자가 로그인 가능
```

### Deep Link URL 형식

- **회원가입 인증**: `pixelbooster://email-confirmed?token=xxx&type=signup`
- **비밀번호 재설정**: `pixelbooster://reset-password?token=xxx`

---

## ⚠️ 주의사항

### 1. Supabase 설정 확인

**Authentication → URL Configuration** 에서:
- **Site URL**: `pixelbooster://` (프로덕션)
- **Redirect URLs**: `pixelbooster://email-confirmed`, `pixelbooster://reset-password` 추가

### 2. 개발 환경 vs 프로덕션

개발 중에는 Deep Link가 작동하지 않을 수 있습니다:
- **개발**: `npm run dev` 실행 시 `localhost`로 연결됨 → Deep Link 미작동
- **프로덕션**: 빌드된 앱 설치 후 정상 작동

### 3. 이메일 템플릿 변수

Supabase에서 제공하는 기본 변수:
- `{{ .Email }}` - 사용자 이메일
- `{{ .Token }}` - 인증 토큰
- `{{ .ConfirmationURL }}` - 인증 링크 (자동 생성)
- `{{ .SiteURL }}` - 사이트 URL

---

## 📋 체크리스트

배포 전 확인사항:

- [ ] Supabase Email Templates 수정 완료
- [ ] Site URL을 `pixelbooster://`로 설정
- [ ] Redirect URLs에 `pixelbooster://email-confirmed` 추가
- [ ] 빌드된 앱으로 이메일 인증 테스트 완료
- [ ] "이메일 인증 완료" 다이얼로그 표시 확인
- [ ] 이메일 제목 및 내용 최종 검토

---

**참고 문서**:
- [Electron Deep Links 공식 문서](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [Supabase Email Templates 가이드](https://supabase.com/docs/guides/auth/auth-email-templates)
