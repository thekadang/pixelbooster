# Git 자동화 시스템

Claude Code를 통한 자동 커밋, 푸시, 롤백 시스템 가이드

---

## 🎯 개요

이 시스템은 Claude Code가 Git 작업을 자동화하여:
- ✅ **자동 커밋**: 변경사항을 분석하고 의미 있는 커밋 메시지 생성
- ✅ **자동 푸시**: GitHub 원격 저장소에 자동 백업
- ✅ **커밋 기록**: COMMIT_HISTORY.md에 모든 커밋 자동 기록
- ✅ **간편 롤백**: 커밋 해시를 말하면 해당 시점으로 복원

---

## 📋 기본 사용법

### 1. 자동 커밋

#### 명령어
```
"커밋해줘"
"변경사항 저장해줘"
"지금까지 작업 백업해줘"
"GitHub에 푸시해줘"
```

#### 프로세스
```
1. git status로 변경 파일 확인
2. 변경된 파일 분석 (문서/코드/설정)
3. 커밋 메시지 자동 생성
   - 형식: "type: [날짜 시간] 주요 내용"
   - 예: "feat: [2025-11-10 14:30] 이미지 처리 로직 구현"
4. git add . && git commit
5. COMMIT_HISTORY.md 자동 업데이트
6. git push origin main
7. 완료 메시지 출력
```

#### 예시
```
사용자: "이미지 처리 로직 구현했어. 커밋해줘."

Claude:
✅ 변경사항 감지: 3개 파일
   - client/src/core/ImageProcessor.ts (신규)
   - client/src/types/index.ts (수정)
   - task.md (수정)

📝 커밋 메시지 생성:
   "feat: [2025-11-10 14:30] 이미지 처리 로직 구현

   - ImageProcessor 클래스 생성
   - Sharp 라이브러리 통합
   - task.md 진행 상황 업데이트"

✅ 커밋 완료: abc123f
📤 GitHub 푸시 완료
📝 COMMIT_HISTORY.md 업데이트 완료

커밋 해시: abc123f
```

---

### 2. 커밋 히스토리 확인

#### 명령어
```
"커밋 히스토리 보여줘"
"지금까지 커밋 목록 확인"
"COMMIT_HISTORY.md 열어줘"
```

#### COMMIT_HISTORY.md 구조
```markdown
## 📊 통계
- 총 커밋 수: 5
- 마지막 커밋: 2025-11-10 14:30

## 🔖 커밋 목록

### 2025-11-10 14:30 [CURRENT] ⭐
커밋 해시: abc123f
주요 변경사항: 이미지 처리 로직 구현
롤백 명령: git checkout abc123f
```

---

### 3. 롤백 (시점 복원)

#### 명령어
```
"abc123f로 롤백해줘"
"2025-11-10 13:44 시점으로 돌아가줘"
"이전 커밋으로 되돌려줘"
"마지막 커밋 취소해줘"
```

#### 안전 롤백 프로세스
```
1. 현재 변경사항 확인 (git status)
   - 변경사항 있으면: "먼저 커밋하시겠습니까?"

2. 백업 브랜치 생성 (안전 장치)
   git branch backup-before-rollback-20251110143000

3. 롤백 실행
   git reset --hard <commit-hash>

4. COMMIT_HISTORY.md 업데이트
   - [CURRENT] 마커 이동
   - 롤백 기록 추가

5. 완료 메시지
   "✅ 2025-11-10 13:44 시점으로 롤백 완료"
   "백업: backup-before-rollback-20251110143000"
```

#### 예시
```
사용자: "COMMIT_HISTORY.md 보니까 51ea98d 커밋이 좋았어. 그때로 돌아가줘."

Claude:
⚠️ 롤백 전 확인
- 현재 커밋: abc123f (2025-11-10 14:30)
- 롤백 대상: 51ea98d (2025-11-10 13:44)
- 손실될 커밋: 3개

계속하시겠습니까? (y/n)

사용자: "y"

Claude:
📦 백업 브랜치 생성: backup-before-rollback-20251110143000
🔄 롤백 실행: git reset --hard 51ea98d
📝 COMMIT_HISTORY.md 업데이트
✅ 롤백 완료!

현재 상태: 2025-11-10 13:44 시점
백업: backup-before-rollback-20251110143000 (필요 시 복구 가능)
```

---

## 🔧 커밋 메시지 자동 생성 로직

### 분석 알고리즘

```typescript
function analyzeChangedFiles(files: string[]) {
  // 1. 파일 분류
  const docs = files.filter(f => f.endsWith('.md') || f.startsWith('docs/'));
  const code = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  const config = files.filter(f => /package\.json|tsconfig|\.config/.test(f));
  const newFiles = files.filter(f => isNewFile(f));

  // 2. 우선순위 결정
  if (newFiles.some(f => code.includes(f))) {
    return {
      type: 'feat',
      description: extractFeatureName(newFiles)
    };
  }

  if (docs.length > 0) {
    return {
      type: 'docs',
      description: `문서 ${docs.length}개 업데이트`
    };
  }

  // ... 나머지 로직
}
```

### 커밋 타입 규칙

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 추가 | feat: [2025-11-10 14:30] 이미지 처리 로직 구현 |
| `fix` | 버그 수정 | fix: [2025-11-10 15:00] 로그인 오류 수정 |
| `docs` | 문서 수정 | docs: [2025-11-10 15:30] API 명세서 업데이트 |
| `refactor` | 코드 리팩토링 | refactor: [2025-11-10 16:00] ImageProcessor 구조 개선 |
| `test` | 테스트 추가 | test: [2025-11-10 16:30] 이미지 변환 단위 테스트 |
| `chore` | 빌드/설정 변경 | chore: [2025-11-10 17:00] 의존성 업데이트 |

---

## 🛡️ 안전 장치

### 1. 변경사항 보호

```bash
# 커밋되지 않은 변경사항 감지
git status

# 결과:
"Changes not staged for commit:
  modified: client/src/core/processor.ts"

Claude:
⚠️ 커밋되지 않은 변경사항이 있습니다!
롤백 시 이 변경사항이 손실될 수 있습니다.

선택하세요:
1) 현재 변경사항을 커밋하고 롤백
2) 변경사항을 임시 저장하고 롤백 (git stash)
3) 변경사항을 버리고 롤백 (주의!)
4) 취소
```

### 2. 자동 백업

```bash
# 중요한 작업 전 자동 백업
git branch backup-before-rollback-$(date +%Y%m%d%H%M%S)

# 백업 브랜치 목록
git branch | grep backup

# 결과:
backup-before-rollback-20251110133000
backup-before-rollback-20251110140000
backup-before-rollback-20251110143000
```

### 3. 확인 프롬프트

```
위험한 작업:
- force push
- reset --hard
- 여러 커밋 삭제

→ 항상 사용자 확인 필요
```

---

## 📊 사용 시나리오

### 시나리오 1: 정상 개발 흐름

```
1. 기능 개발
   사용자: "이미지 처리 로직 구현 완료"

2. 자동 커밋
   사용자: "커밋해줘"
   Claude: ✅ feat: [2025-11-10 14:30] 이미지 처리 로직 구현

3. 계속 개발
   사용자: "로그 시스템 구현 완료"

4. 또 커밋
   사용자: "커밋해줘"
   Claude: ✅ feat: [2025-11-10 15:00] 로그 시스템 구현
```

### 시나리오 2: 문제 발견 후 롤백

```
1. 문제 발견
   사용자: "방금 구현한 로그 시스템에 버그가 있어"

2. 커밋 히스토리 확인
   사용자: "커밋 히스토리 보여줘"
   Claude: [COMMIT_HISTORY.md 내용 표시]

3. 이전 시점으로 롤백
   사용자: "abc123f로 롤백해줘" (이미지 처리 구현 시점)
   Claude: ✅ 롤백 완료, 백업 생성됨

4. 문제 수정 후 재개발
   사용자: "로그 시스템 다시 구현할게"
```

### 시나리오 3: 세션 종료 전

```
세션 종료 감지
   ↓
Claude: "커밋되지 않은 변경사항이 5개 파일에 있습니다."
        "저장하시겠습니까? (y/n)"
   ↓
사용자: "y"
   ↓
Claude: ✅ 자동 커밋 완료
        📤 GitHub 푸시 완료
        "안전하게 저장되었습니다. 다음 세션에서 이어서 작업하세요."
```

---

## 🔄 롤백 고급 기능

### 1. 특정 파일만 복원

```bash
# 특정 커밋의 파일만 가져오기
git checkout <commit-hash> -- <file-path>

# 예시
git checkout 51ea98d -- docs/architecture/database-schema.md
```

### 2. 롤백 취소 (reflog 사용)

```bash
# 이전 HEAD 위치 확인
git reflog

# 결과:
abc123f HEAD@{0}: reset: moving to 51ea98d
def456g HEAD@{1}: commit: feat: 로그 시스템 구현

# 롤백 취소
git reset --hard HEAD@{1}
```

### 3. 선택적 커밋 복원 (cherry-pick)

```bash
# 특정 커밋만 현재 브랜치에 적용
git cherry-pick <commit-hash>

# 예시: 롤백 후 특정 커밋의 내용만 가져오기
git cherry-pick def456g
```

---

## ⚡ 성능 최적화

### 대용량 파일 처리

```bash
# .gitignore에 추가
node_modules/
*.log
dist/
build/
```

### 커밋 주기

- **소규모 변경**: 파일 1-3개 → 즉시 커밋
- **중규모 변경**: 파일 4-10개 → 작업 완료 후 커밋
- **대규모 변경**: 파일 10개 이상 → 논리적 단위로 분할 커밋

---

## 🆘 문제 해결

### "push rejected" 오류

```bash
# 원인: 원격 저장소가 로컬보다 최신
# 해결:
git pull --rebase origin main
git push origin main
```

### "detached HEAD" 상태

```bash
# 원인: git checkout <commit-hash> 실행 후
# 해결:
git checkout main
```

### 백업 브랜치 정리

```bash
# 오래된 백업 브랜치 삭제
git branch -D backup-before-rollback-20251110133000
```

---

## 📝 베스트 프랙티스

1. **자주 커밋**: 작은 단위로 자주 커밋하여 롤백 지점 확보
2. **의미 있는 메시지**: 자동 생성된 메시지 확인 후 필요 시 수정 요청
3. **롤백 전 백업**: 중요한 작업은 항상 백업 브랜치 생성
4. **히스토리 확인**: 정기적으로 COMMIT_HISTORY.md 확인
5. **강제 푸시 주의**: 협업 프로젝트에서는 force push 지양

---

## 🔗 관련 문서

- [Git 워크플로우](git-workflow.md) - 전체 Git 브랜치 전략
- [코딩 컨벤션](conventions.md) - 커밋 메시지 규칙
- [COMMIT_HISTORY.md](../../COMMIT_HISTORY.md) - 실제 커밋 기록

---

**작성일**: 2025-11-10
**마지막 업데이트**: 2025-11-10
