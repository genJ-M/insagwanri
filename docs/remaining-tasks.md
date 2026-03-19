# 서비스 완성을 위한 잔여 작업 목록

> 작성일: 2026-03-11
> 최종 업데이트: 2026-03-15
> 참조 문서: `saas-design.md`, `admin-system-design.md`, `infra/ARCHITECTURE.md`

## 완료 표기 규칙
- `[DONE]` : 설계 또는 구현 완료. 손댈 필요 없음.
- `[ ]`    : 미완료. 작업 필요.
- `[~]`    : 부분 완료. 추가 작업 필요.
- `[MANUAL]` : 코드 외 수동 작업 필요 (콘솔/계약/법무 등). → `manual-setup.md` 참조

---

## 1. 설계 완료 현황

| 영역 | 상태 | 파일 |
|------|------|------|
| Customer 도메인 DB 설계 | [DONE] | saas-design.md |
| Customer REST API 명세 | [DONE] | saas-design.md |
| Customer 권한 구조 (RBAC) | [DONE] | saas-design.md |
| AI 정책 및 면책 문구 | [DONE] | saas-design.md |
| Admin 아키텍처 | [DONE] | admin-system-design.md |
| Admin DB 설계 (결제/구독/세무) | [DONE] | admin-system-design.md |
| Feature Flags 시스템 | [DONE] | admin-system-design.md |
| 결제/Dunning/세무 로직 | [DONE] | admin-system-design.md |
| Admin REST API 명세 | [DONE] | admin-system-design.md |
| Admin Dashboard UI 화면 설계 | [DONE] | admin-system-design.md |
| AWS 인프라 구조 | [DONE] | infra/ARCHITECTURE.md |
| Socket.io 이벤트 명세 | [DONE] | docs/realtime-event-spec.md |
| 알림 시스템 설계 (트리거/큐/이메일) | [DONE] | docs/notification-system-spec.md |
| 셀프서브 온보딩 플로우 | [DONE] | docs/onboarding-flow-spec.md |
| 파일 업로드 전략 (S3 Presigned URL) | [DONE] | docs/file-upload-spec.md |
| GPS 출퇴근 검증 정책 | [DONE] | docs/gps-attendance-spec.md |
| Customer Web 화면 설계 | [DONE] | docs/screen-design-spec.md |
| 플랜 변경 일할 정산 로직 | [DONE] | docs/onboarding-flow-spec.md §9 |

---

## 2. Customer 서비스 구현 (완료)

### Backend 모듈 (전체 완료)
auth · attendance · tasks · schedules · collaboration · ai · users · workspace · files · notifications · socket · subscriptions

### Frontend — Customer Web (전체 완료)
/login · /register · /invite · / · /attendance · /tasks · /tasks/reports · /schedule · /messages · /ai · /team · /settings · /subscription · /onboarding/plan · /onboarding/payment

---

## 3. Admin 시스템 (Phase 4 — 완료)

| 항목 | 상태 | 비고 |
|------|------|------|
| Admin Backend (NestJS :4001) | [DONE] | admin-backend/ |
| Admin Auth (TOTP MFA, 2단계) | [DONE] | |
| Companies / Plans / Payments / Coupons 모듈 | [DONE] | |
| Feature Flags (Redis TTL 5분 캐시) | [DONE] | |
| Admin Users / AuditInterceptor / RolesGuard | [DONE] | |
| IP 화이트리스트 미들웨어 | [DONE] | ADMIN_ALLOWED_IPS |
| Toss Payments 빌링키 자동결제 + Dunning | [DONE] | D+1/D+3/D+7 |
| PG 빌링키 AES-256 암호화 | [DONE] | BILLING_KEY_ENCRYPTION_KEY |
| Admin DB 마이그레이션 | [DONE] | 1741910500000-AdminSchema |
| Admin Web Dashboard (Next.js :3002) | [DONE] | admin-web/ — 9개 페이지 |
| e-세금계산서 API 연동 | [MANUAL] | 별도 영업 계약 필요 |

---

## 4. 온보딩 & 결제 UI (Phase 6 — 완료)

| 항목 | 상태 |
|------|------|
| 플랜 선택 (`/onboarding/plan`) | [DONE] |
| Toss Payments 카드 등록 (`/onboarding/payment`) | [DONE] |
| 구독 관리 (`/subscription`) | [DONE] |

---

## 5. 모바일 앱 (Phase 5 — 완료)

| 항목 | 상태 |
|------|------|
| Expo 프로젝트 초기 설정 (mobile/) | [DONE] |
| 인증 / 근태(GPS) / 업무 / 채팅 / 프로필 화면 | [DONE] |
| Expo Push Notifications (usePushNotifications) | [DONE] |
| GPS 출퇴근 (expo-location Accuracy.High) | [DONE] |

---

## 6. 보안 검증 & 운영 준비 (Phase 7 — 완료)

| 항목 | 상태 | 비고 |
|------|------|------|
| 멀티테넌트 격리 통합 테스트 | [DONE] | test/multitenant-isolation.spec.ts — 14/14 로컬 통과 확인 (2026-03-15) |
| 출퇴근 기록 3년 보관 아카이브 | [DONE] | AttendanceArchiveService, migration 1741910403000 |
| Redis Adapter (Socket.io 멀티서버) | [DONE] | RedisIoAdapter, src/adapters/redis-io.adapter.ts |

---

## 7. 개발 환경 & 운영 (완료)

- [DONE] docker-compose.yml (PostgreSQL, Redis, MinIO, admin-backend)
- [DONE] .env.example (Customer + Admin)
- [DONE] TypeORM Migration 파일
- [DONE] 마스터 데이터 시드
- [DONE] GitHub Actions CI/CD (ci, deploy-staging, deploy-production)
- [DONE] ECR / ECS Task Definition (migration 태스크 포함)
- [DONE] Sentry (Backend + Frontend)
- [DONE] Winston 구조화 로깅 + CloudWatch
- [MANUAL] Vercel 프로젝트 연결
- [MANUAL] CloudWatch 결제 실패율 알람

---

## 8. 보안 체크리스트

| 항목 | 상태 |
|------|------|
| 멀티테넌트 격리 통합 테스트 | [DONE] |
| Rate Limiting (IP Throttler + 계정 잠금) | [DONE] |
| PG 빌링키 AES-256 암호화 저장 | [DONE] |
| Admin VPN/IP 화이트리스트 | [DONE] |
| TOTP MFA (SUPER_ADMIN) | [DONE] |
| HTTPS 강제 (HSTS 헤더) | [DONE] |
| JWT 시크릿 분리 (Access/Refresh 별도) | [DONE] |
| Refresh Token Hash 저장 | [DONE] |
| Soft Delete 패턴 (deleted_at) | [DONE] |
| 개인정보처리방침 / 이용약관 법무 검토 | [MANUAL] |
| GPS 데이터 개인정보보호법 준수 명문화 | [MANUAL] |

---

## 9. 성능 & 운영 준비

| 항목 | 상태 | 비고 |
|------|------|------|
| Entity 인덱스 설계 | [DONE] | |
| DB 인덱스 실제 생성 확인 | [MANUAL] | migration:run 후 DB 직접 확인 |
| Feature Flags Redis 캐시 | [DONE] | TTL 5분 |
| 구독 갱신 스케줄러 | [DONE] | DunningScheduler 3종 |
| S3 Lifecycle Policy (Export 7일 TTL) | [MANUAL] | AWS 콘솔 |
| RDS 자동 백업 (7일 보존) | [MANUAL] | AWS 콘솔 |
| 출퇴근 기록 3년 보관 아카이브 | [DONE] | 매일 02:00 스케줄러 |
| 로드 테스트 | [MANUAL] | 피크 시간대 시뮬레이션 |

---

## 10. 미결 의사결정

| 항목 | 선택지 | 비고 |
|------|--------|------|
| 이메일 발송 서비스 | **Resend** | 구현 완료 |
| 이미지 스토리지 | AWS S3 / Cloudflare R2 | R2 추천, 설정 필요 |
| 반복 일정 처리 | **rrule 라이브러리** | 구현 완료 |
| e-세금계산서 연동 | 케이세인 / 아이스크림 / 비즈인포 | 영업 계약 필요 |
| 모노레포 도구 | 현재 단일 레포 (Turborepo 전환 가능) | |
| 모바일 배포 | **EAS Build** | 앱스토어 배포 시 필요 |
