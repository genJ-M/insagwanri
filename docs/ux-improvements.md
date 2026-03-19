# UX 개선 필요 항목

> 작성일: 2026-03-17
> 최종 업데이트: 2026-03-18
> 목적: 사용자 테스트를 통해 발견된, 또는 발견될 가능성이 높은 UX 문제 목록
> 표기: `[ ]` 미완료 · `[x]` 완료 · `[~]` 부분 완료

---

## 우선순위 기준

- **P1 (Critical)** — 기능이 동작하지 않거나, 사용자가 목적을 달성할 수 없음
- **P2 (High)** — 혼란을 유발하거나, 중요한 피드백이 없어 사용자가 상황을 모름
- **P3 (Medium)** — 불편하지만 우회 가능. 완성도 문제
- **P4 (Low)** — 세부 polish. 있으면 좋음

---

## 1. 인증 (Auth) ✅ 완료

### 1-1. 회원가입 `/register`
| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P2 | 이메일 중복 시 에러가 이메일 필드 아래 표시 | [x] 서버 에러 → 필드 라우팅 이미 구현됨 |
| P3 | 가입 성공 후 대시보드 자동 이동 로딩 인디케이터 | [x] `isNavigating` 상태 추가, 버튼 loading 유지 |
| P3 | 회사명 2자 미만 시 에러 메시지 | [x] 프론트 validation 추가 |

### 1-2. 로그인 `/login`
| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P2 | 5회 실패 후 잠금 안내 메시지 | [x] 429 / "잠금" 키워드 감지 → 전용 에러 UI 표시 |
| P3 | 자동 로그인 여부 (Zustand persist) | [ ] 테스트 필요 |
| P4 | Enter 키 폼 제출 | [ ] form 태그 사용 중, 테스트 필요 |

### 1-3. 비밀번호 찾기 `/forgot-password`
| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 실제 이메일 발송 동작 여부 | [MANUAL] `RESEND_API_KEY` 설정 후 테스트 필수 |
| P2 | 보안 문구 개선 (존재하지 않는 이메일) | [x] "가입된 이메일인 경우 발송했습니다"로 변경 |

### 1-4. 비밀번호 재설정 `/reset-password`
| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 토큰 만료 / 이미 사용된 토큰 에러 처리 | [x] `tokenInvalid` 상태 → "링크 만료" 화면 + 재발송 버튼 |
| P3 | 변경 완료 후 로그인 페이지 이동 | [x] 정책 결정됨 (로그인 페이지로 이동) |

---

## 2. 출퇴근 `/attendance` ✅ 완료 (1개 보류)

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 출근/퇴근 버튼 성공/실패 토스트 | [x] `toast.success/error` 추가 |
| P1 | 이미 출근한 상태에서 재클릭 방지 | [x] `canClockIn = !myToday?.clockInAt` 으로 disabled 처리됨 |
| P2 | GPS 위치 수집 실패 시 auto-dismiss | [x] 3초 후 `setGeoError('')` |
| P2 | 실시간 현재 시각 표시 | [x] `useEffect` + `setInterval(1s)` |
| P2 | 관리자용 근태 목록 직원 상세 클릭 | [x] EmployeeAttendanceModal — 월별 이력 + 요약(정상/지각/결근), 월 이동 네비게이션 |
| P3 | 근태 Badge 색상 직관성 | [ ] 사용자 테스트 필요 |
| P3 | 퇴근 후 총 근무시간 표시 | [x] `Xh Ym` 형식으로 내 상태 영역에 추가 |

---

## 3. 업무 `/tasks` ✅ 완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 업무 생성 모달 담당자 목록 로드 | [x] `GET /users` 호출, 팀원 없을 때 안내 문구 |
| P1 | 업무 생성 후 목록 즉시 갱신 | [x] `invalidateQueries` 동작 확인 |
| P2 | 마감일 지난 업무 시각적 경고 | [x] 빨간 텍스트 + "(기한 초과)" |
| P2 | 업무 검색 실시간 동작 | [x] 클라이언트 사이드 필터 유지 |
| P2 | 업무 클릭 시 상세 모달 | [x] `TaskDetailModal` 구현 (상태 변경 포함) |
| P3 | 업무 상태 변경 | [x] 상세 모달에서 버튼으로 상태 변경 |
| P3 | 마감일 없는 업무 정렬 기준 | [ ] 추후 정렬 옵션 추가 고려 |
| P4 | 우선순위 Badge 색상 직관성 | [ ] 사용자 테스트 필요 |

---

## 4. 업무 보고서 `/tasks/reports` ✅ 완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P2 | 보고서 수 많을 때 페이지네이션 | [x] 10개씩 "더 보기" + 총 건수 표시 |
| P2 | 기간 필터링 | [x] 시작일/종료일 필터 + 초기화 버튼 |
| P3 | 보고서 → 업무 이동 링크 | [x] 업무 제목 → `/tasks` 링크 + ExternalLink 아이콘 |
| P3 | 진행률 0~100 범위 검증 | [x] `Math.min(100, Math.max(0, pct))` 적용 |

---

## 5. 일정 `/schedule` ✅ 완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 종료 시각 > 시작 시각 validation | [x] `end_at <= start_at` 차단 + 인라인 에러 |
| P2 | 종일 일정(`is_all_day`) 체크박스 | [x] 체크 시 datetime-local → date 입력 전환 |
| P2 | 일정 색상 선택 UI | [x] 6색 프리셋 스워치 |
| P2 | 일정 클릭 → 수정 모달 | [x] `EditScheduleModal` (저장/삭제) |
| P3 | 반복 일정 설정 UI | [ ] rrule 기반 추후 고려 |
| P3 | 월 이동 성능/캐싱 | [ ] TanStack Query 캐싱으로 자동 처리됨 |

---

## 6. 메시지 `/messages` ✅ 완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 채널 없을 때 빈 화면 처리 | [x] 사이드바 "첫 채널 만들기" + 중앙 빈 상태 UI |
| P1 | 메시지 전송 후 입력창 포커스 유지 | [x] `inputRef` + 전송 성공 후 `focus()` |
| P2 | 읽지 않은 메시지 Badge 실시간 갱신 | [x] socket `message:new` → `invalidateQueries(['channels'])` |
| P2 | 긴 메시지 줄바꿈 처리 | [x] `whitespace-pre-wrap break-words` 적용 |
| P2 | 파일/이미지 첨부 기능 | [ ] S3/MinIO 연동 필요 — 추후 |
| P3 | 메시지 수정/삭제 기능 | [x] hover 시 연필·휴지통 아이콘, 인라인 편집 |
| P3 | 채널 생성 UI | [x] "+" 버튼 → 이름/유형 모달 |
| P4 | 이모지 리액션 | [ ] 추후 고려 |

---

## 7. 팀 관리 `/team` — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 초대 이메일 실제 발송 여부 | [MANUAL] `RESEND_API_KEY` 설정 후 테스트 |
| P1 | 초대 링크 만료 후 재초대 | [x] 만료 배지 + 흐림 처리, 재발송 버튼 기구현 |
| P2 | 역할 변경 confirm 다이얼로그 | [x] ConfirmDialog 모달 (역할변경·비활성화) |
| P2 | 직원 비활성화/삭제 기능 | [x] ConfirmDialog → deactivateMutation |
| P2 | 초대 취소 후 목록 갱신 | [x] invalidateQueries 기구현 확인 |
| P3 | 이메일 검색 대소문자 무시 | [x] `.toLowerCase()` 적용 |
| P3 | 팀원 50명+ 페이지네이션 | [x] PAGE_SIZE=20, 페이지 버튼 + 범위 표시 기구현 확인 |

---

## 8. AI 어시스턴트 `/ai` — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | OpenAI API 키 없을 때 안내 | [x] 인증 오류 감지 → 전용 amber 경고 UI |
| P2 | 생성 중 로딩 표시 | [x] Loader2 스피너 + "AI 생성 중..." 버튼 텍스트 |
| P2 | 일일 사용 한도 잔여량 표시 | [x] used_count / plan_limit 표시 (AiResult 타입 확장) |
| P2 | AI 결과 복사 버튼 피드백 ("복사됨") | [x] copied 상태 + Check 아이콘 기구현 확인 |
| P3 | 입력 글자 수 카운터 | [x] charCount 표시 |
| P3 | AI 요청 히스토리 | [x] GET /ai/history 엔드포인트 추가, 프론트 히스토리 패널 (생성/히스토리 탭 전환, 아코디언 확장, 페이지네이션) |
| P4 | 면책 문구 접기/펼치기 토글 | [x] disclaimerOpen 아코디언 토글 기구현 |

---

## 9. 설정 `/settings` — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 비밀번호 변경 복잡도 체크리스트 | [x] PwChecklist 컴포넌트 (8자·영문·숫자·특수문자) |
| P1 | GPS 좌표 유효성 검사 (위도 -90~90, 경도 -180~180) | [x] handleSave에서 범위 검증 + 에러 표시 |
| P2 | 저장 토스트 중복 표시 | [x] react-hot-toast id: 'settings-save' dedup, SaveToast 커스텀 컴포넌트 제거 |
| P2 | 현재 위치 가져오기 실패 에러 표시 | [x] locError 상태 + 권한 거부/타임아웃 메시지 |
| P2 | 비밀번호 표시/숨기기 필드별 독립 토글 | [x] showPwFields 객체로 필드별 독립 토글 |
| P2 | 알림 설정 섹션 비활성화 처리 | [x] disabled:true + "준비 중" 라벨 기구현 확인 |
| P3 | 회사 로고 업로드 | [x] ImageUploader 컴포넌트, POST /files/upload-url → PUT S3 → POST /files/confirm, workspace.dto logoUrl 추가 |
| P3 | 프로필 이미지 업로드 | [x] ImageUploader 컴포넌트, users.dto profileImageUrl 추가, 프로필 섹션 아바타 교체 |
| P3 | GPS 반경 슬라이더 참고 설명 | [x] 💡 권장 반경 안내 텍스트 기구현 확인 |
| P4 | 미저장 상태 페이지 이탈 경고 | [x] useUnsavedChanges 훅 (beforeunload), 설정 4개 섹션 적용 + 미저장 인디케이터 텍스트 |

---

## 10. 구독/결제 `/subscription` — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 카드 등록/삭제 실제 동작 | [MANUAL] Toss Payments 테스트 키 필요 |
| P1 | 결제 실패 시 사용자 안내 | [x] past_due / suspended 전용 UI + 대시보드 배너 |
| P2 | 카드 삭제 confirm 다이얼로그 | [x] deleteTargetId 상태 → confirm 모달 |
| P2 | 무료 체험 중 플랜 업그레이드 흐름 | [x] 대시보드 trialing 배너 + 회원가입→/onboarding/plan |
| P2 | 플랜 변경 시점 및 요금 안내 | [x] active 구독 시 일할 계산 안내 텍스트 |
| P3 | 인보이스 날짜 형식 통일 | [x] formatDate() 헬퍼로 통일 |
| P3 | 남은 체험 기간 음수 방지 | [x] Math.max(0, daysRemaining) |

---

## 11. 온보딩 `/onboarding` — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 플랜 선택 → 결제 → 완료 흐름 E2E | [x] 코드 완성. Toss 테스트키 발급 후 E2E 테스트 필요 [MANUAL] |
| P2 | 첫 로그인 감지 → 온보딩 자동 유도 | [x] 회원가입 → /onboarding/plan 자동 이동 |
| P3 | 온보딩 뒤로 가기 상태 유지 | [x] sessionStorage로 billingCycle·selectedPlanId·couponCode 유지, 결제 성공 시 정리 |

---

## 12. 공통 UX — 미완료

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P1 | 토큰 만료 시 자동 갱신 인터셉터 | [x] `api.ts` 401 → refresh → 재시도 (기구현 확인) |
| P1 | 네트워크 오류 공통 에러 처리 | [x] 네트워크 단절/타임아웃 toast, 5xx toast (id dedup) |
| P2 | 데이터 로딩 스켈레톤 | [x] Skeleton.tsx 공통 컴포넌트, 대시보드·업무·팀·보고서 적용 |
| P2 | 모바일 반응형 레이아웃 | [~] Sidebar overlay 구현. 각 페이지 375px 테스트 필요 |
| P2 | 모바일 사이드바 햄버거 메뉴 | [x] Sidebar fixed overlay + 백드롭, Header 햄버거 연결 |
| P3 | 페이지 이동 시 스크롤 초기화 | [x] Next.js App Router Link 기본 동작으로 자동 처리 |
| P3 | 빈 상태 UI 공통 컴포넌트 | [x] EmptyState.tsx 공통 컴포넌트 생성 (icon·title·desc·action) |
| P4 | 페이지별 `<title>` metadata | [x] usePageTitle 훅 + 전체 10개 대시보드 페이지 적용 |
| P4 | 브랜드 favicon | [ ] 디자인 에셋 필요 [MANUAL] |

---

## 빠른 수정 가능 항목

```
[x] 출퇴근 성공 토스트 메시지 추가
[x] 역할 변경 confirm 다이얼로그 추가
[x] 카드 삭제 confirm 다이얼로그 추가
[x] 일정 종료 시각 > 시작 시각 validation
[x] GPS 좌표 범위 validation (위도 -90~90, 경도 -180~180)
[x] 비밀번호 변경 폼에 체크리스트 추가 (settings)
[x] 팀원 검색 대소문자 무시 (.toLowerCase())
[x] 마감일 지난 업무 빨간색 표시
[x] 구독 남은 기간 음수 방지 (Math.max(0, days))
[x] 실시간 시계 (attendance 페이지)
```
