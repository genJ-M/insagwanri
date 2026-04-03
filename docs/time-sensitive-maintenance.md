# 시간 기반 유지보수 계획

> 코드베이스에 하드코딩된 값 중 시간이 흐르면 바뀌어야 하는 항목 목록.
> 배포 전·정기 점검 시 이 문서를 기준으로 갱신 여부를 확인한다.

---

## 매년 8~9월 확인 → 다음해 1월 1일 적용

### 최저시급

| 항목 | 파일 | 위치 |
|------|------|------|
| `MIN_WAGE_TABLE` | `backend/src/modules/salary/salary.service.ts` | 15번째 줄 근처 |
| `MIN_WAGE_TABLE` | `web/src/app/(dashboard)/salary/page.tsx` | 198번째 줄 근처 |

**확인 방법**: 고용노동부 공고 (매년 8월 결정) → `www.moel.go.kr`
**수정 방법**: 두 파일의 `MIN_WAGE_TABLE`에 새 연도 항목 추가, 미확정 연도 값 갱신

```ts
// 예시 — 2027년 확정 시
const MIN_WAGE_TABLE = {
  ...
  2027: 10_320, // 확정값으로 교체
};
```

---

## 매년 초(1~3월) 확인 → 해당 연도 적용

### 4대보험 요율 (근로자 부담분)

| 항목 | 파일 | 위치 |
|------|------|------|
| `RATE_YEAR`, `RATES` | `backend/src/modules/salary/salary.service.ts` | 30번째 줄 근처 |
| `EMPLOYER_RATES` | `backend/src/modules/tax-documents/tax-documents.service.ts` | 10번째 줄 근처 |
| `INSURANCE_RATE_YEAR` | `web/src/app/(dashboard)/salary/page.tsx` | 20번째 줄 근처 |

**확인 방법**:
- 국민연금: 국민연금공단 (매년 7월 결정)
- 건강보험·장기요양: 건강보험공단 (매년 1월 고시)
- 고용보험: 고용노동부 (매년 1월 고시)
- 산재보험: 고용노동부 (매년 3월 업종별 고시)

**현재 요율 (2024~2026 동일)**

| 보험 | 근로자 | 사업주 |
|------|--------|--------|
| 국민연금 | 4.5% | 4.5% |
| 건강보험 | 3.545% | 3.545% |
| 장기요양 | 건강보험료 × 12.95% | 동일 |
| 고용보험 | 0.9% | 0.9% (150인 미만) |
| 산재보험 | 없음 | 0.9% (업종 평균) |

**수정 방법**: 요율 변경 시 3개 파일 동시 수정, `RATE_YEAR`도 해당 연도로 변경

```ts
// salary.service.ts 수정 예시
export const RATE_YEAR = 2027; // ← 변경
const RATES = {
  nationalPension:      0.045,   // 변경된 값으로 교체
  healthInsurance:      0.03600, // 변경된 값으로 교체
  ...
};
```

### 간이세액표 (소득세 구간·세율)

| 항목 | 파일 | 위치 |
|------|------|------|
| `estimateIncomeTax()` | `backend/src/modules/salary/salary.service.ts` | 40번째 줄 근처 |

**확인 방법**: 국세청 간이세액표 공고 (매년 2월경) → `www.nts.go.kr`
**현재 구간**: 1,060,000 / 1,500,000 / 3,000,000 / 4,500,000 / 7,600,000원
**수정 방법**: 구간 금액 및 세율 직접 수정

### 식비·교통비 비과세 한도

| 항목 | 파일 | 위치 |
|------|------|------|
| `nonTaxableLimit` (200,000원) | `backend/src/modules/salary/salary.service.ts` | 62번째 줄 근처 |

**확인 방법**: 소득세법 시행령 개정 여부 확인
**현재**: 식비 200,000원, 교통비 200,000원 (비과세 한도)

---

## 매년 3월 확인

### 산재보험 업종별 요율

| 항목 | 파일 | 위치 |
|------|------|------|
| `industrialAccident: 0.009` | `backend/src/modules/tax-documents/tax-documents.service.ts` | 16번째 줄 근처 |

**확인 방법**: 고용노동부 산재보험료율 고시 (매년 3월)
**주의**: 업종별로 다르므로 현재 0.9%는 평균치. 실제 사업장 업종에 따라 다를 수 있음.

---

## 매년 연초(1월) 확인

### 세무·노무 법정 기한

현재 아래 기한은 법정이므로 변경 가능성이 낮지만, 정부 공고 시 수정 필요.

| 기한 | 설명 | 파일 |
|------|------|------|
| 입사 후 14일 이내 | 4대보험 취득신고 | `tax-documents.service.ts`, `tax-alert.service.ts` |
| 퇴사 다음달 15일 이내 | 4대보험 상실신고 | `tax-documents.service.ts` |
| 퇴직일로부터 14일 이내 | 퇴직금 지급 기한 | `tax-documents.service.ts` |
| 다음해 3월 10일 | 연말정산 자료 제출 | `tax-documents.service.ts`, `tax-documents/page.tsx` |
| 매월 10일 | 원천세 신고납부 | `tax-documents.service.ts`, `tax-documents/page.tsx` |

---

## 분기마다 확인

### 세무 캘린더 고정 일정

| 항목 | 파일 | 위치 |
|------|------|------|
| `TAX_SCHEDULES[]` | `backend/src/modules/tax-documents/tax-documents.service.ts` | 30번째 줄 근처 |
| `TAX_DEADLINES[]` | `backend/src/modules/tax-documents/tax-alert.service.ts` | 11번째 줄 근처 |

**세무 주요 마감일** (법정, 변경 시 국세청 공고)

| 월 | 일 | 내용 |
|----|-----|------|
| 1 | 25 | 부가세 확정신고 |
| 3 | 10 | 연말정산 자료 제출 |
| 3 | 31 | 법인세 신고 |
| 4 | 25 | 부가세 예정신고 |
| 5 | 31 | 종합소득세 신고 |
| 7 | 25 | 부가세 확정신고 |
| 10 | 25 | 부가세 예정신고 |

---

## 정책 변경 시 수정 (주기 없음)

아래 항목은 사내 정책에 따라 바꿀 수 있는 값.

| 항목 | 현재값 | 파일 |
|------|--------|------|
| 할 일 목록 조회 기간 | 35일 이내 | `tax-documents.service.ts:88` |
| 세무 알림 타이밍 | D-7, D-3 | `tax-alert.service.ts:44` |
| 원천세 알림 타이밍 | D-5, D-3 | `tax-alert.service.ts:57` |
| 연차 소멸 알림 | 30일 전 | `tax-documents.service.ts`, `tax-alert.service.ts` |
| 월 소정근로시간 | 209시간 | `salary.service.ts:27`, `salary/page.tsx:203` |

---

## 점검 체크리스트

### 매년 1월 (새해 첫 배포 전)

- [ ] 최저시급 새 연도 값 확인 및 `MIN_WAGE_TABLE` 갱신 (백엔드·프론트 동시)
- [ ] 건강보험·장기요양 요율 확인 및 `RATES` / `EMPLOYER_RATES` 갱신
- [ ] 고용보험 요율 확인
- [ ] `RATE_YEAR` 및 `INSURANCE_RATE_YEAR` 현재 연도로 갱신
- [ ] 세무 캘린더 변경 사항 없는지 국세청 확인

### 매년 3월

- [ ] 산재보험 업종별 요율 고시 확인 → `industrialAccident` 값 검토
- [ ] 간이세액표 개정 여부 확인 → `estimateIncomeTax()` 구간 검토

### 매년 8~9월

- [ ] 내년 최저시급 고시 확인 → `MIN_WAGE_TABLE`에 다음해 항목 미리 추가

---

## 수정 시 함께 바꿔야 하는 파일 묶음

| 변경 항목 | 함께 수정해야 할 파일 |
|----------|----------------------|
| 4대보험 요율 | `backend/salary.service.ts` + `backend/tax-documents.service.ts` + `web/salary/page.tsx` (INSURANCE_RATE_YEAR) |
| 최저시급 | `backend/salary.service.ts` + `web/salary/page.tsx` |
| 세무 마감일 | `backend/tax-documents.service.ts` + `backend/tax-alert.service.ts` + `web/tax-documents/page.tsx` |
