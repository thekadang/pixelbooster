# Git 워크플로우

픽셀부스터 프로젝트의 Git 브랜치 전략 및 협업 가이드

---

## 🌳 브랜치 전략

### 브랜치 구조

```
main (프로덕션)
  └─ develop (개발 메인)
      ├─ feature/image-processing
      ├─ feature/subscription-system
      ├─ feature/ui-components
      ├─ fix/login-bug
      └─ hotfix/critical-error
```

### 브랜치 타입

| 브랜치 | 용도 | 네이밍 | 예시 |
|--------|------|--------|------|
| `main` | 프로덕션 배포용 | `main` | main |
| `develop` | 개발 메인 브랜치 | `develop` | develop |
| `feature/*` | 새 기능 개발 | `feature/<기능명>` | feature/image-processing |
| `fix/*` | 버그 수정 | `fix/<버그명>` | fix/login-error |
| `hotfix/*` | 긴급 수정 | `hotfix/<이슈>` | hotfix/critical-bug |
| `backup-*` | 자동 백업 | `backup-before-rollback-<날짜시간>` | backup-before-rollback-20251110143000 |

---

## 📝 커밋 메시지 규칙

### 형식

```
<type>: <subject>

<body> (선택사항)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type 종류

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 추가 | feat: 이미지 WEBP 변환 기능 구현 |
| `fix` | 버그 수정 | fix: 로그인 시 기기 인증 오류 수정 |
| `docs` | 문서 수정 | docs: API 명세서 업데이트 |
| `refactor` | 코드 리팩토링 | refactor: ImageProcessor 클래스 분리 |
| `test` | 테스트 추가 | test: 이미지 변환 단위 테스트 |
| `chore` | 빌드/설정 변경 | chore: 의존성 업데이트 |
| `style` | 코드 스타일 변경 | style: ESLint 규칙 적용 |

### 예시

```
✅ 좋은 예시:
feat: 이미지 WEBP 변환 기능 구현

- Sharp 라이브러리 통합
- 배치 처리 로직 추가
- 진행 상태 UI 업데이트

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>

❌ 나쁜 예시:
update code
fix bug
change files
```

---

## 🚀 기본 워크플로우

### 1. 새 기능 개발

```bash
# 1. develop 브랜치로 이동
git checkout develop
git pull origin develop

# 2. 새 기능 브랜치 생성
git checkout -b feature/image-processing

# 3. 작업 진행
# ... 코드 작성 ...

# 4. 커밋 (Claude Code 사용)
사용자: "커밋해줘"
Claude: [자동 커밋 및 푸시]

# 5. 작업 완료 후 develop에 병합
git checkout develop
git merge feature/image-processing

# 6. 원격 저장소에 푸시
git push origin develop

# 7. 기능 브랜치 삭제
git branch -d feature/image-processing
```

### 2. 버그 수정

```bash
# 1. fix 브랜치 생성
git checkout develop
git checkout -b fix/login-error

# 2. 수정 작업
# ... 버그 수정 ...

# 3. 커밋
사용자: "로그인 오류 수정 완료. 커밋해줘"
Claude: fix: 로그인 시 기기 인증 오류 수정

# 4. develop에 병합
git checkout develop
git merge fix/login-error

# 5. 푸시
git push origin develop
```

### 3. 긴급 수정 (Hotfix)

```bash
# 1. main에서 직접 hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/critical-bug

# 2. 긴급 수정
# ... 버그 수정 ...

# 3. 커밋
사용자: "긴급 버그 수정. 커밋해줘"
Claude: hotfix: 치명적 버그 긴급 수정

# 4. main에 병합
git checkout main
git merge hotfix/critical-bug

# 5. develop에도 병합 (동기화)
git checkout develop
git merge hotfix/critical-bug

# 6. 태그 생성 (버전 관리)
git tag -a v0.1.1 -m "Hotfix: 치명적 버그 수정"

# 7. 푸시
git push origin main develop
git push origin v0.1.1
```

---

## 🔄 자동화 워크플로우

### Claude Code 통합

픽셀부스터는 **Git 자동화 시스템**을 사용합니다.
자세한 내용은 [Git 자동화 가이드](git-automation.md)를 참고하세요.

#### 자동 커밋
```
사용자: "커밋해줘"
```
→ Claude가 변경사항 분석 후 자동 커밋/푸시

#### 자동 롤백
```
사용자: "51ea98d로 롤백해줘"
```
→ Claude가 안전하게 해당 시점으로 복원

#### 커밋 히스토리
```
사용자: "커밋 히스토리 보여줘"
```
→ COMMIT_HISTORY.md 내용 표시

---

## 📂 롤백 전략

### 방법 1: 특정 커밋 확인 (임시)

```bash
# 코드만 확인하고 싶을 때
git checkout <commit-hash>

# 최신으로 돌아오기
git checkout main
```

### 방법 2: 완전히 되돌리기

```bash
# 백업 생성 (안전 장치)
git branch backup-before-rollback-$(date +%Y%m%d%H%M%S)

# 되돌리기
git reset --hard <commit-hash>

# 원격 저장소에 강제 푸시 (주의!)
git push --force origin main
```

### 방법 3: 특정 파일만 복원

```bash
# 특정 커밋의 파일을 현재로 가져오기
git checkout <commit-hash> -- <file-path>

# 예시
git checkout 51ea98d -- CLAUDE.md
```

자세한 롤백 가이드는 [COMMIT_HISTORY.md](../../COMMIT_HISTORY.md)를 참고하세요.

---

## 🔒 보호 규칙

### main 브랜치 보호

```bash
# main 브랜치에 직접 push 금지
# → develop에서 작업 후 병합

# ❌ 금지
git checkout main
# ... 작업 ...
git push origin main

# ✅ 올바른 방법
git checkout develop
# ... 작업 ...
git push origin develop
# → 나중에 병합
```

### Force Push 제한

```bash
# ⚠️ force push는 신중하게
git push --force origin main

# 대신 이렇게:
git pull --rebase origin main
git push origin main
```

---

## 🏷️ 태그 (버전 관리)

### 시맨틱 버저닝

```
v<major>.<minor>.<patch>

예시:
v0.1.0 - 초기 버전
v0.1.1 - 버그 수정
v0.2.0 - 새 기능 추가
v1.0.0 - 정식 출시
```

### 태그 생성

```bash
# 새 버전 태그
git tag -a v0.1.0 -m "초기 릴리스"

# 태그 푸시
git push origin v0.1.0

# 모든 태그 푸시
git push origin --tags

# 태그 목록 확인
git tag
```

---

## 🤝 협업 규칙

### Pull Request 프로세스

1. **브랜치 생성**: feature/* 또는 fix/*
2. **작업 완료**: 커밋 및 푸시
3. **PR 생성**: develop 또는 main으로
4. **코드 리뷰**: 팀원 검토
5. **병합**: 승인 후 Squash and Merge
6. **브랜치 삭제**: 병합 후 브랜치 정리

### 코드 리뷰 체크리스트

- [ ] 코드가 컨벤션을 따르는가?
- [ ] 테스트가 통과하는가?
- [ ] 문서가 업데이트되었는가?
- [ ] 불필요한 파일이 포함되지 않았는가?
- [ ] 커밋 메시지가 명확한가?

---

## 🆘 문제 해결

### "push rejected" 오류

```bash
# 원격 저장소가 로컬보다 최신
git pull --rebase origin main
git push origin main
```

### "merge conflict" 오류

```bash
# 충돌 발생
git status  # 충돌 파일 확인

# 충돌 해결
# ... 파일 수정 ...

# 해결 완료
git add .
git commit -m "fix: 병합 충돌 해결"
```

### "detached HEAD" 상태

```bash
# git checkout <commit-hash> 후 발생
git checkout main  # 최신으로 복귀
```

---

## 📊 유용한 Git 명령어

### 히스토리 확인

```bash
# 커밋 히스토리
git log --oneline

# 그래프로 보기
git log --graph --oneline --all

# 특정 파일의 히스토리
git log -- <file-path>
```

### 변경사항 확인

```bash
# 현재 상태
git status

# 변경 내용
git diff

# 스테이징된 변경
git diff --staged
```

### 브랜치 관리

```bash
# 브랜치 목록
git branch

# 원격 브랜치 포함
git branch -a

# 브랜치 삭제
git branch -d <branch-name>

# 강제 삭제
git branch -D <branch-name>
```

---

## 🔗 관련 문서

- **[Git 자동화 시스템](git-automation.md)** - 자동 커밋/푸시/롤백
- **[COMMIT_HISTORY.md](../../COMMIT_HISTORY.md)** - 커밋 기록 및 롤백 가이드
- **[코딩 컨벤션](conventions.md)** - 커밋 메시지 규칙

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
