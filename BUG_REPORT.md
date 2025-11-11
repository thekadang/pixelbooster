# 버그 리포트

## 수정 완료된 버그

### 1. 로그인 시 기기 등록 실패 (CRITICAL) ✅ 해결
**증상**: 로그인 시 "new row violates row-level security policy for table registered_devices" 에러 발생

**원인**: Supabase RLS 정책이 `service_role`만 기기 등록을 허용하도록 설정되어 있어, Edge Function에서 인증된 사용자가 기기를 등록할 수 없었음

**해결책**: RLS 정책을 수정하여 인증된 사용자가 자신의 기기를 등록할 수 있도록 변경
- 파일: `supabase/migrations/20251111_fix_rls_policy.sql`
- 정책: `"Authenticated users can insert own devices"`

**검증**: 2025-11-10 18:48:00에 로그인 및 기기 등록 성공 확인

---

## 발견된 새로운 버그

### 2. Excel 로그 기록 실패 (NON-CRITICAL) ✅ 해결
**증상**: 이미지 변환 후 로그 기록 시 "Out of bounds. Excel supports columns from 1 to 16384" 에러 발생

**영향도**:
- 이미지 변환 자체는 정상 작동
- 백업도 정상 작동
- 로그 기록만 실패

**원인 분석**:
1. `row.getCell('inputPath')` 등 **key 방식**으로 셀 접근 시 문제 발생
2. ExcelJS에서 key 방식이 항상 안정적이지 않음
3. 특히 하이퍼링크 설정 및 스타일 적용 시 컬럼 인덱스 오류

**해결책**:
- **컬럼 번호 직접 접근** 방식으로 변경 (1-based index)
- `row.getCell(4)` (inputPath = D열), `row.getCell(5)` (outputPath = E열)
- `row.getCell(11)` (status = K열)
- `sequentialId` 변수명 명확화 (currentId → sequentialId)

**수정 파일**: `client/src/services/log-manager.ts` (Line 296-383)

**검증**: TypeScript 컴파일 성공 ✅ (2025-11-11)

**우선순위**: LOW → **RESOLVED**

---

## 테스트 결과 요약

### Phase 6: 버그 수정 및 안정화 🐛
- [x] 로그인/회원가입 기능 테스트 ✅
- [x] 기기 등록 시스템 테스트 ✅
- [x] 이미지 변환 기본 기능 테스트 ✅
- [x] 백업 시스템 테스트 ✅
- [x] 로그 시스템 버그 수정 ✅ (Excel 컬럼 접근 방식 개선)
- [ ] 로그 시스템 재테스트 (수정 사항 검증 필요)

### 성공한 기능
1. ✅ 로그인 및 인증
2. ✅ 기기 등록 (새 기기 등록 성공)
3. ✅ 구독 정보 조회 (Free tier)
4. ✅ 이미지 변환 (WEBP 변환 성공)
5. ✅ 파일 백업 (원본 백업 성공)
6. ✅ Excel 로그 버그 수정 완료

### 재테스트 필요
1. 🔄 Excel 로그 기록 (수정 후 검증 필요)

---

**작성일**: 2025-11-11 03:49
**작성자**: Claude Code
**버전**: v0.1.0
