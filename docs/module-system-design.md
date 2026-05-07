# 관리왕 모듈화 시스템 설계

> 작성일: 2026-04-28  
> 상태: 설계 완료 / 구현 대기

---

## 1. 설계 원칙

1. **BASE 모듈은 불변** — 어떤 플랜/설정으로도 제거 불가
2. **플랜이 모듈의 상한을 결정** — 상위 플랜 모듈은 하위 플랜으로 구매 불가 (단, 애드온 예외)
3. **업종 프리셋은 추천만** — 플랜 범위 내에서 어떤 조합이든 자유롭게 활성/비활성 가능
4. **기존 plans/addon_purchases 테이블 재활용** — 새 테이블은 `company_modules`만 추가
5. **사이드바는 모듈 상태를 반영** — 비활성 모듈 메뉴는 잠금 아이콘 + 업그레이드 안내

---

## 2. BASE 모듈 (필수, 제거 불가)

| ID | 한국어 | 설명 |
|----|--------|------|
| `auth` | 인증 | 로그인·회원가입·JWT·OAuth |
| `users` | 사용자 관리 | 직원 프로필·권한 |
| `workspace` | 워크스페이스 | 회사 설정·로고·브랜딩 |
| `notifications` | 알림 | 이메일·푸시 알림 발송 |
| `invitations` | 초대 | 직원 초대 링크 |
| `files` | 파일 | 파일 업로드 기반 |
| `health` | 헬스체크 | 시스템 상태 모니터링 |
| `dashboard` | 대시보드 | 홈 화면 |

> BASE 모듈은 `company_modules` 테이블에 저장하지 않음.  
> Guard에서 BASE 목록에 해당하면 자동 통과.

---

## 3. 선택 모듈 카탈로그 (27개)

### 근태 그룹 (ATTENDANCE)
| ID | 한국어 | 설명 |
|----|--------|------|
| `attendance` | 출퇴근 | QR·GPS·WiFi 출퇴근 기록 |
| `attendance_methods` | 출퇴근 방식 설정 | 인증 방식 관리 |
| `locations` | 지점·사업장 | 여러 지점 위치 관리 |
| `field_visits` | 현장 방문 | 외근·현장 방문 기록 |

### 일정·업무 그룹 (WORK)
| ID | 한국어 | 설명 |
|----|--------|------|
| `tasks` | 업무 관리 | 업무 생성·할당·보고 |
| `schedules` | 스케줄 | 개인 일정 관리 |
| `calendar` | 캘린더 | 공유 캘린더 |
| `calendar_settings` | 캘린더 설정 | 반복 일정·세무 캘린더 |
| `approvals` | 전자결재 | 결재 문서·봉인·5년 보존 |
| `shift_schedule` | 팀 근무표 | 교대근무 스케줄 |
| `shift_swap` | 근무 교환 | 시프트 교환 요청 |

### HR 그룹 (HUMAN RESOURCES)
| ID | 한국어 | 설명 |
|----|--------|------|
| `vacations` | 휴가 관리 | 휴가 신청·잔여일수 |
| `contracts` | 근로계약서 | 계약서 관리·전자서명 |
| `hr_notes` | 인사 노트 | HR 메모·비공개 노트 |
| `evaluations` | 인사평가 | 평가 사이클·설문 |
| `training` | 교육 관리 | 교육 과정·수강 관리 |

### 급여·세무 그룹 (PAYROLL)
| ID | 한국어 | 설명 |
|----|--------|------|
| `salary` | 급여 관리 | 급여 계산·명세서 |
| `tax_documents` | 세무·노무 서류 | 세금 서류·자동 알림 |

### 소통 그룹 (COMMUNICATION)
| ID | 한국어 | 설명 |
|----|--------|------|
| `collaboration` | 메시지 | 채팅·채널·메시지 |
| `search` | 통합 검색 | 직원·업무·서류 검색 |

### 고급 그룹 (ADVANCED)
| ID | 한국어 | 설명 |
|----|--------|------|
| `ai` | AI 도구 | AI 어시스턴트·공지 초안 |
| `care_worker` | 요양보호사 | 케어세션·자격증 추적 (의료/요양 특화) |
| `custom_templates` | 커스텀 템플릿 | 문서 양식 커스터마이징 |
| `activity_logs_view` | 활동 로그 열람 | 관리자 감사 로그 |
| `credits` | 크레딧 | 크레딧 포인트 시스템 |

---

## 4. 플랜별 포함 모듈

### FREE (무료 체험, 14일)
- 인원: 최대 5명
- 포함: `attendance` `tasks` `calendar` `vacations` `schedules`

### BASIC — 49,000원/월 (현재 플랜 유지)
- 인원: 최대 30명
- 포함: FREE + `attendance_methods` `locations` `contracts` `salary`  
  + `shift_schedule` `shift_swap` `approvals` `collaboration`  
  + `tax_documents` `calendar_settings`

### PRO — 99,000원/월 (현재 플랜 유지)
- 인원: 최대 100명
- 포함: BASIC + `ai` `field_visits` `hr_notes` `evaluations` `training`  
  + `search` `custom_templates` `activity_logs_view` `credits`

### ENTERPRISE — 협의
- 인원: 무제한
- 포함: PRO + `care_worker` + 전체 미래 모듈

### 애드온 (단독 월 구매, 플랜 업그레이드 없이 추가 가능)
| addon_code | 모듈 | 월 금액 |
|------------|------|---------|
| `addon_care_worker` | `care_worker` | 19,900원 |
| `addon_field_visits` | `field_visits` | 6,900원 |
| `addon_ai` | `ai` | 9,900원 |
| `addon_extra_location` | `locations` +1지점 | 9,900원 |

---

## 5. 업종 프리셋 (온보딩·설정에서 선택)

플랜 범위 내에서 어떤 모듈 조합을 기본 활성화할지 추천. 강제가 아닌 "시작 설정"

| 프리셋 ID | 라벨 | 추천 모듈 |
|-----------|------|-----------|
| `office` | 일반 사무실 / IT | attendance, tasks, approvals, calendar, collaboration, ai, search |
| `food` | 카페 / 식당 | attendance, shift_schedule, shift_swap, salary, vacations, tasks |
| `construction` | 건설 / 현장 | field_visits, attendance, contracts, salary, locations, shift_schedule |
| `care` | 돌봄 / 의료 | care_worker, field_visits, attendance, training, salary, vacations |
| `retail` | 소매 / 유통 | attendance, shift_schedule, shift_swap, salary, tasks, locations |
| `public` | 공공 / 관공서 | attendance, approvals, contracts, vacations, hr_notes, evaluations, tax_documents, salary |
| `education` | 교육 / 학원 | tasks, training, calendar, vacations, salary, evaluations |
| `sales` | 영업 / 외근 | field_visits, locations, tasks, salary, calendar, collaboration |

---

## 6. 역할(Role)별 모듈 접근 범위

모듈이 활성화되어 있어도 역할에 따라 기능 일부 제한:

| 모듈 | owner | manager | employee |
|------|-------|---------|----------|
| `salary` | 전체 | 설정된 범위 | 본인만 |
| `hr_notes` | 전체 | 설정된 범위 | 열람 불가 |
| `evaluations` | 관리 + 열람 | 대상 범위 | 본인 결과만 |
| `activity_logs_view` | 전체 | 제한 | 불가 |
| `contracts` | 전체 | 생성·조회 | 본인만 |
| 나머지 | 전체 | 전체 | 일반 기능 |

---

## 7. DB 스키마

### 신규 테이블: `company_modules`

```sql
CREATE TABLE company_modules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id     VARCHAR(50) NOT NULL,   -- e.g. 'attendance', 'ai'
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        VARCHAR(20) NOT NULL DEFAULT 'plan',
  -- source: 'plan' | 'addon' | 'manual' (어드민 수동)
  addon_purchase_id UUID REFERENCES addon_purchases(id) ON DELETE SET NULL,
  UNIQUE(company_id, module_id)
);
```

### plans 테이블 업데이트
기존 `features JSONB` 컬럼을 `module_ids TEXT[]`로 보완 (또는 features 안에 module_ids 배열 추가).

---

## 8. 백엔드 구조

```
backend/src/
├── modules/
│   ├── feature-modules/           ← 신규 폴더
│   │   ├── module-catalog.constants.ts   ← 전체 모듈 정의
│   │   ├── plan-module-map.constants.ts  ← 플랜별 모듈 매핑
│   │   ├── industry-preset.constants.ts  ← 업종 프리셋
│   │   ├── entities/
│   │   │   └── company-module.entity.ts
│   │   ├── feature-modules.module.ts
│   │   ├── feature-modules.service.ts
│   │   └── feature-modules.controller.ts
│   └── (기존 모듈들)
└── common/
    ├── guards/
    │   └── module-access.guard.ts         ← 신규
    └── decorators/
        └── require-module.decorator.ts    ← 신규
```

---

## 9. 프론트엔드 구조

```
web/src/
├── types/
│   └── modules.ts                  ← 모듈 타입 정의
├── hooks/
│   └── useModules.ts               ← 활성 모듈 조회 훅
├── store/
│   └── modules.store.ts            ← Zustand 모듈 스토어
├── components/
│   └── modules/
│       ├── ModuleGate.tsx          ← 비활성 모듈 접근 차단 + 업그레이드 안내
│       ├── ModuleCard.tsx          ← 모듈 카드 (설정 페이지용)
│       └── IndustryPresetSelector.tsx ← 업종 프리셋 선택 UI
└── app/(dashboard)/
    └── settings/
        └── modules/
            └── page.tsx            ← 모듈 관리 페이지
```

---

## 10. 사이드바 변경 계획

기존 `pageKey` 기반 → `moduleKey` 추가  
비활성 모듈 메뉴: 아이템을 숨기는 대신 **잠금 아이콘 표시 + 클릭 시 업그레이드 모달**

```ts
interface NavItem {
  ...
  moduleKey?: string;       // 신규: 필요한 모듈 ID
  lockedBehavior?: 'hide' | 'lock';  // hide: 숨김, lock: 잠금 표시 (기본: hide)
}
```

---

## 11. 구현 단계 분해

### Phase 1 — 백엔드 데이터 레이어
**작업 파일:** 5개
1. `module-catalog.constants.ts` — 모듈 정의 (ID, 한국어명, 그룹, 설명)
2. `plan-module-map.constants.ts` — 플랜별 포함 모듈 배열
3. `industry-preset.constants.ts` — 업종 프리셋 8종
4. `company-module.entity.ts` — TypeORM 엔티티
5. `Migration: 1747000000000-CreateCompanyModules.ts`

**완료 기준:** 타입 에러 없이 컴파일, migration 파일 실행 가능

---

### Phase 2 — 백엔드 서비스 + API
**작업 파일:** 4개
1. `feature-modules.service.ts` — getActiveModules / isModuleActive / activateFromPlan / deactivate
2. `feature-modules.controller.ts` — GET /feature-modules, PATCH /feature-modules/:id
3. `feature-modules.module.ts`
4. `app.module.ts` 수정 — FeatureModulesModule 등록, CompanyModule 엔티티 추가

**완료 기준:** Postman으로 모듈 조회 API 응답 확인 가능

---

### Phase 3 — Guard + 데코레이터 + 핵심 컨트롤러 적용
**작업 파일:** 10개
1. `require-module.decorator.ts`
2. `module-access.guard.ts`
3. `app.module.ts` — APP_GUARD에 ModuleAccessGuard 등록
4. `attendance.controller.ts` — @RequireModule('attendance') 추가
5. `salary.controller.ts` — @RequireModule('salary')
6. `ai.controller.ts` — @RequireModule('ai')
7. `approvals.controller.ts` — @RequireModule('approvals')
8. `collaboration.controller.ts` — @RequireModule('collaboration')
9. `field-visits.controller.ts` — @RequireModule('field_visits')
10. `care-worker.controller.ts` — @RequireModule('care_worker')

**완료 기준:** 비활성 모듈 API 호출 시 403 응답

---

### Phase 4 — 프론트엔드 상태 관리 + 사이드바
**작업 파일:** 5개
1. `web/src/types/modules.ts`
2. `web/src/hooks/useModules.ts`
3. `web/src/store/modules.store.ts`
4. `web/src/components/modules/ModuleGate.tsx`
5. `web/src/components/layout/Sidebar.tsx` — moduleKey 연동

**완료 기준:** 비활성 모듈 메뉴 잠금 표시, ModuleGate 차단 동작

---

### Phase 5 — 모듈 관리 설정 페이지 UI
**작업 파일:** 4개
1. `web/src/components/modules/ModuleCard.tsx`
2. `web/src/components/modules/IndustryPresetSelector.tsx`
3. `web/src/app/(dashboard)/settings/modules/page.tsx`
4. 기존 settings 페이지 탭에 "모듈" 탭 추가

**완료 기준:** owner가 모듈 활성/비활성 토글 가능, 업종 프리셋 일괄 적용 가능

---

### Phase 6 — 온보딩 + 구독 연동 + 랜딩 업데이트
**작업 파일:** 5개
1. 온보딩 스텝에 업종 선택 UI 추가 (기존 onboarding 페이지 수정)
2. 구독 플랜 변경 시 모듈 자동 활성/비활성 훅 (`subscriptions.service.ts`)
3. `landing-pricing.ts` — PLANS에 modules 배열 추가
4. `PricingWizard.tsx` — 모듈 목록 표시 추가
5. 어드민 백엔드 — 회사별 모듈 현황 관리 페이지

**완료 기준:** 플랜 가입 시 해당 플랜 모듈 자동 활성화, 랜딩에서 플랜별 모듈 확인 가능

---

## 12. 작업 우선순위

```
Phase 1 (기반) → Phase 2 (API) → Phase 3 (Guard)
                                        ↓
                              Phase 4 (프론트 상태)
                                        ↓
                              Phase 5 (설정 UI)
                                        ↓
                              Phase 6 (온보딩·랜딩)
```

Phase 3까지 완료하면 실제 접근 제어가 동작.  
Phase 5까지 완료하면 관리자가 UI로 모듈을 관리 가능.

---

## 13. 마이그레이션 전략

기존 회사 데이터 처리:
- 현재 가입된 회사 → 플랜에 따라 `company_modules` 자동 생성 (seed script)
- 플랜 정보 없는 회사 → FREE 플랜 모듈 기본 활성화

```sql
-- 기존 회사에 FREE 플랜 모듈 일괄 적용 예시
INSERT INTO company_modules (company_id, module_id, source)
SELECT c.id, m.module_id, 'plan'
FROM companies c
CROSS JOIN (VALUES
  ('attendance'), ('tasks'), ('calendar'), ('vacations'), ('schedules')
) AS m(module_id)
ON CONFLICT (company_id, module_id) DO NOTHING;
```

---

## 14. 주요 결정 사항

| 결정 | 이유 |
|------|------|
| BASE 모듈은 DB에 저장 안 함 | Guard에서 상수로 체크 → 쿼리 불필요, 성능↑ |
| company_modules에 UNIQUE(company_id, module_id) | 중복 방지, upsert 패턴 가능 |
| 잠금 시 hide 기본, lock 선택 | UX 연구상 잠금 표시가 업그레이드 전환율↑ |
| addon은 기존 addon_purchases 재활용 | 결제 로직 중복 방지 |
| 업종 프리셋은 강제 아닌 추천 | 사업 특성이 다양해 경직된 구조 지양 |
