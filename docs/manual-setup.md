# 수동 설정 가이드 (코드로 처리 불가한 항목)

> 이 문서는 AWS 콘솔, 외부 서비스 계약, 법무 검토 등
> 코드 배포만으로는 완료되지 않는 항목을 정리한 목록입니다.

---

## 1. 배포 플랫폼

### Vercel (Customer Web)
- vercel.com → "Add New Project" → GitHub 저장소 연결
- Root Directory: `web/`
- Framework Preset: Next.js (자동 감지)
- Environment Variables 추가:
  ```
  NEXT_PUBLIC_API_URL=https://api.gwanriwang.com
  SENTRY_AUTH_TOKEN=...
  SENTRY_DSN=...
  ```
- 커스텀 도메인: `gwanriwang.com` 연결 후 DNS CNAME 설정

---

## 2. AWS 인프라

### GitHub Secrets 등록 (CI/CD 동작에 필수)
`.github/SECRETS.md` 파일 참조.
아래 Secrets를 GitHub → Settings → Secrets and Variables → Actions에 등록:

| Secret | 값 |
|--------|-----|
| `AWS_ACCESS_KEY_ID` | CI/CD 전용 IAM 사용자 키 |
| `AWS_SECRET_ACCESS_KEY` | 위 IAM 사용자 시크릿 |
| `AWS_REGION` | `ap-northeast-2` |
| `ECR_REPOSITORY` | `gwanriwang-backend` |
| `ECS_CLUSTER` | `gwanriwang-cluster` |
| `ECS_SERVICE` | `gwanriwang-backend-service` |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |

### RDS 자동 백업
- AWS 콘솔 → RDS → 인스턴스 선택 → Maintenance & backups
- Backup retention period: **7일**
- Backup window: 새벽 4시 KST (19:00 UTC)

### S3 Lifecycle Policy (Export 파일 자동 삭제)
- AWS 콘솔 → S3 → `gwanriwang-private` 버킷 → Management → Lifecycle rules
- Rule 이름: `delete-exports-after-7days`
- Prefix: `exports/`
- Expiration: 7 days

### CloudWatch 결제 알람
- AWS 콘솔 → CloudWatch → Alarms → Create alarm
- 추천 알람:
  - 결제 실패율: `payments.failed / payments.total > 0.05` (5% 초과 시)
  - 에러율: 5xx 응답 > 1% 시 SNS → 이메일 발송
  - CPU 사용률: ECS 태스크 > 80% 시 알람

### DB 인덱스 생성 확인
- 프로덕션 배포 후 migration:run 실행 확인:
  ```bash
  # ECS Migration 태스크 실행 후
  psql -h <RDS_HOST> -U postgres -d gwanriwang -c "\d+ companies"
  # 또는 RDS Performance Insights에서 인덱스 사용 여부 모니터링
  ```

---

## 3. 외부 서비스 계정 발급

### Toss Payments
- https://developers.tosspayments.com 에서 가입
- 상점 등록 → 심사 통과 → 시크릿 키 발급
- `.env`에 `TOSS_PAYMENTS_SECRET_KEY` 설정
- 빌링키 발급 테스트 후 실 계정으로 전환
- **빌링키 암호화 키**: `openssl rand -hex 32` 로 64자리 hex 생성 → `BILLING_KEY_ENCRYPTION_KEY` 환경변수

### Resend (이메일)
- https://resend.com 에서 가입
- 발신 도메인 `gwanriwang.com` DNS 인증 (SPF, DKIM 레코드 추가)
- API Key 발급 → `RESEND_API_KEY` 환경변수

### Sentry
- https://sentry.io 에서 프로젝트 생성 (Backend용, Frontend용 각 1개)
- DSN 복사 → 각 `.env`에 `SENTRY_DSN` 설정
- Auth Token 발급 → GitHub Secret `SENTRY_AUTH_TOKEN` 등록

### e-세금계산서 (영업 계약 필요)
- 후보 업체: 케이세인, 아이스크림미디어, 비즈인포
- 계약 후 API 키 발급 → `admin-backend/.env`에 추가
- `TaxInvoice` 엔티티 및 `tax_invoices` 테이블은 이미 구현됨
- 발급 로직만 해당 업체 SDK에 맞게 연결하면 됨

---

## 4. 보안 & 법무

### 개인정보처리방침 / 이용약관
- 법무법인 또는 법률 서비스(로아컨설팅 등)에 검토 의뢰
- 필수 포함 항목:
  - 수집 항목: 이메일, 이름, GPS 위치(출퇴근 시), 결제 정보
  - 보존 기간: 출퇴근 기록 3년, 결제 정보 5년
  - 제3자 제공: Toss Payments, AWS, Sentry
- 완료 후 `/privacy`, `/terms` 페이지로 Customer Web에 연결

### GPS 개인정보보호법 준수
- 개인정보 처리방침에 GPS 데이터 수집 목적 명시
- 근로자 동의 절차: 회원가입 시 별도 GPS 수집 동의 체크박스 추가 권장
- GPS 데이터 저장 기간 정책 명문화 (3년 후 삭제 또는 익명화)

---

## 5. 운영 준비

### 로드 테스트
- 추천 도구: k6 또는 Artillery
- 시나리오: 오전 9시 동시 출퇴근 (피크 300명 동시 요청)
- 목표: p99 응답시간 < 500ms, 에러율 < 0.1%
- 실행 시점: 프로덕션 배포 전 스테이징 환경에서 1회 이상

### Admin 초기 계정 생성
- Admin Backend 배포 후 SUPER_ADMIN 계정을 시드 스크립트로 생성:
  ```bash
  # admin-backend에서
  npm run seed
  ```
- 첫 로그인 시 TOTP MFA 설정 필수 (QR 코드 스캔)
- 초기 비밀번호는 즉시 변경

### VPN 설정 (Admin 접근 제한)
- AWS VPN Client 또는 사무실 고정 IP 확인
- `admin-backend/.env`의 `ADMIN_ALLOWED_IPS`에 VPN CIDR 또는 고정 IP 추가
  ```
  ADMIN_ALLOWED_IPS=10.0.0.0/8,203.xxx.xxx.xxx
  ```
