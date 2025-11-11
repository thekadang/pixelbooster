# 픽셀부스터 v0.1.1 릴리스 노트

**릴리스 날짜**: 2025-11-11
**릴리스 유형**: 패치 릴리스 (버그 수정)
**이전 버전**: v0.1.0

---

## 📋 개요

v0.1.1은 v0.1.0에서 발견된 CRITICAL 버그를 수정한 패치 릴리스입니다.

### 핵심 수정 사항
✅ **로그인 입력 필드 차단 문제 해결** - 사용자가 로그인 모달에서 이메일과 비밀번호를 입력할 수 없던 치명적인 버그 수정

---

## 🐛 수정된 버그

### 1. 로그인 입력 필드 차단 문제 (CRITICAL)

**문제**:
- 로그인 모달의 이메일 및 비밀번호 입력 필드에서 텍스트 입력이 불가능
- 입력 필드 클릭은 가능하지만 키보드 입력이 차단됨
- HTML5 validation 툴팁("이 입력란을 작성하세요")은 표시되지만 실제 입력 불가

**원인 분석**:
1. `AuthModal.jsx`의 오버레이에 직접 연결된 `onClick={onClose}` 핸들러가 입력 필드와 간섭
2. 이벤트 버블링 및 캡처 단계에서 오버레이 클릭 이벤트가 입력 필드와 충돌
3. CSS `pointer-events`, `user-select`, `z-index` 명시적 설정 부족
4. 입력 필드에 `autoFocus`, `autoComplete`, `tabIndex` 속성 누락

**해결 방법**:

#### client/src/components/AuthModal.jsx
```jsx
// ✅ 개선: 오버레이 직접 클릭만 감지
const handleOverlayClick = (e) => {
  if (e.target === e.currentTarget) {
    onClose && onClose();
  }
};

<div className="auth-modal-overlay"
     onClick={handleOverlayClick}
     onMouseDown={handleOverlayClick}>
  <div className="auth-modal-content"
       onClick={(e) => e.stopPropagation()}
       onMouseDown={(e) => e.stopPropagation()}>
```

#### client/src/components/LoginForm.jsx
```jsx
// ✅ 이메일 필드
<input
  type="email"
  autoFocus              // 자동 포커스
  autoComplete="email"   // 브라우저 자동완성
  tabIndex={0}          // 탭 순서 보장
  // ... 기존 속성
/>

// ✅ 비밀번호 필드
<input
  type="password"
  autoComplete="current-password"
  tabIndex={0}
  // ... 기존 속성
/>
```

#### client/src/components/LoginForm.css
```css
.form-input {
  pointer-events: auto;  /* ✅ 명시적 활성화 */
  user-select: text;     /* ✅ 텍스트 선택 가능 */
  cursor: text;          /* ✅ 커서 표시 */
}
```

#### client/src/components/AuthModal.css
```css
.auth-modal-content {
  z-index: 1001;         /* ✅ 오버레이(1000)보다 위 */
  pointer-events: auto;  /* ✅ 명시적 활성화 */
}
```

**영향 범위**:
- `client/src/components/AuthModal.jsx`
- `client/src/components/LoginForm.jsx`
- `client/src/components/LoginForm.css`
- `client/src/components/AuthModal.css`

**테스트 검증**:
- ✅ 로그인 버튼 클릭 → 모달 열림
- ✅ 이메일 필드 자동 포커스
- ✅ 이메일 입력 가능 확인
- ✅ Tab 키 → 비밀번호 필드 이동
- ✅ 비밀번호 입력 가능 확인
- ✅ 모달 외부 클릭 → 모달 닫힘
- ✅ 입력 필드 클릭 시 모달 유지

**문서화**:
상세한 버그 수정 문서가 생성되었습니다:
- `docs/bugfixes/login-input-blocking-fix.md`

---

## 🔐 보안 개선

### 입력 필드 접근성 개선
- 명시적 `autoComplete` 속성으로 브라우저 자동완성 보안 강화
- `autoComplete="email"` 및 `autoComplete="current-password"` 설정
- 사용자 경험 및 보안성 동시 향상

---

## 📊 변경된 파일

### 수정된 파일 (5개)
1. `package.json` - 버전 0.1.0 → 0.1.1
2. `client/src/components/AuthModal.jsx` - 오버레이 클릭 핸들러 개선
3. `client/src/components/LoginForm.jsx` - 입력 필드 속성 추가
4. `client/src/components/LoginForm.css` - CSS 방어 설정
5. `client/src/components/AuthModal.css` - z-index 설정

### 신규 파일 (2개)
1. `docs/bugfixes/login-input-blocking-fix.md` - 버그 수정 상세 문서
2. `RELEASE_NOTES_v0.1.1.md` - 이 릴리스 노트

---

## 🎯 업그레이드 가이드

### v0.1.0 → v0.1.1 업그레이드

**자동 업데이트 (권장)**:
1. 앱을 시작하면 자동으로 업데이트 확인
2. 업데이트 알림 시 "다운로드" 클릭
3. 다운로드 완료 후 앱 재시작

**수동 설치**:
1. GitHub Releases에서 `픽셀부스터 Setup 0.1.1.exe` 다운로드
2. 기존 버전 제거 (선택 사항)
3. 새 버전 설치

**개발자 업그레이드**:
```bash
# 저장소 업데이트
git pull origin main

# 의존성 재설치 (필요 시)
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build:win
```

---

## ⚠️ 알려진 제한 사항

v0.1.0과 동일한 제한 사항이 유지됩니다:
- macOS 빌드는 macOS 환경에서만 가능 (크로스 빌드 제한)
- 코드 사이닝은 인증서 구매 후 적용 예정
- Excel 로그 컬럼 한도 초과 버그 (LOW priority, 다음 릴리스에서 수정 예정)

---

## 📝 다음 릴리스 계획

### v0.1.2 (예정)
- Excel 로그 컬럼 한도 초과 버그 수정
- 추가 UI/UX 개선
- 성능 최적화

### v0.2.0 (계획 중)
- 관리자 대시보드 구현
- 추가 이미지 포맷 지원 (JXL, HEIF)
- 고급 편집 기능 (회전, 자르기, 필터)

---

## 🙏 감사의 말

이 버그를 발견하고 신속히 수정할 수 있도록 도와주신 모든 분들께 감사드립니다.

---

## 📞 지원

문제가 발생하거나 질문이 있으시면 다음으로 연락 주세요:
- GitHub Issues: https://github.com/thekadang/pixelbooster/issues
- 이메일: support@pixelbooster.com

---

**작성자**: 더카당
**프로젝트**: 픽셀부스터
**라이선스**: MIT
**웹사이트**: https://pixelbooster.com
