# 알림 시스템 설계 명세

> B2B SaaS 직원 관리 플랫폼 — 알림 시스템
> 작성일: 2026-03-11
> 결정 사항: Resend (이메일) / Expo Push (모바일) / BullMQ (큐) / DB 저장 (인앱)

---

## 목차

1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [알림 채널 유형](#2-알림-채널-유형)
3. [DB 테이블 설계](#3-db-테이블-설계)
4. [알림 트리거 전체 목록](#4-알림-트리거-전체-목록)
5. [이메일 템플릿 목록](#5-이메일-템플릿-목록)
6. [BullMQ 큐 설계](#6-bullmq-큐-설계)
7. [사용자 알림 설정](#7-사용자-알림-설정)
8. [NestJS 구현 구조](#8-nestjs-구현-구조)
9. [Expo Push 연동](#9-expo-push-연동)
10. [Resend 이메일 연동](#10-resend-이메일-연동)
11. [알림 REST API](#11-알림-rest-api)

---

## 1. 시스템 아키텍처

```
이벤트 발생 (업무 배정, 결제 실패, 멘션 등)
      │
      ▼
NotificationService.dispatch(event)
      │
      ├─ DB 저장 (notifications 테이블)          ← 항상 먼저
      ├─ 소켓 이벤트 발행 (notification:new)      ← 앱 열려있을 때
      │
      └─ BullMQ Job 추가
             │
             ├─ [email-queue]   → Resend API
             └─ [push-queue]    → Expo Push API → FCM / APNs
```

**원칙**
1. DB 저장 실패 시 소켓/푸시/이메일 모두 발행하지 않음
2. 소켓은 동기, 이메일/푸시는 BullMQ를 통해 비동기 처리
3. 이메일/푸시 실패 시 최대 3회 자동 재시도 (지수 백오프)
4. 사용자 알림 설정에 따라 채널별 발송 여부 결정

---

## 2. 알림 채널 유형

| 채널 | 도구 | 조건 |
|------|------|------|
| **인앱 알림** | DB + 소켓 `notification:new` | 항상 생성 |
| **모바일 푸시** | Expo Push → FCM/APNs | Expo Push Token 등록된 경우 |
| **이메일** | Resend + React Email | 트리거별 발송 여부 다름 (표 참조) |

---

## 3. DB 테이블 설계

### notifications (인앱 알림 저장)

```sql
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  user_id       UUID NOT NULL REFERENCES users(id),

  -- 알림 내용
  type          VARCHAR(50) NOT NULL,   -- 아래 타입 코드 참조
  title         VARCHAR(200) NOT NULL,
  body          TEXT NOT NULL,

  -- 이동 대상 (딥링크)
  ref_type      VARCHAR(20),            -- task | task_report | message | schedule | payment
  ref_id        UUID,                   -- 해당 리소스 ID

  -- 상태
  is_read       BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 인덱스
  -- idx_notifications_user_unread: (user_id, is_read) WHERE is_read = false
  -- idx_notifications_user_created: (user_id, created_at DESC)
  -- 90일 초과 레코드 자동 삭제 크론 (매일 02:00)
);
```

### device_tokens (Expo Push Token 저장)

```sql
CREATE TABLE device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  company_id    UUID NOT NULL REFERENCES companies(id),

  token         VARCHAR(200) NOT NULL,     -- ExponentPushToken[xxx]
  platform      VARCHAR(10) NOT NULL,      -- ios | android
  device_name   VARCHAR(100),              -- "홍길동의 iPhone"
  app_version   VARCHAR(20),

  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, token)
);
```

### notification_settings (사용자별 알림 설정)

```sql
CREATE TABLE notification_settings (
  user_id            UUID PRIMARY KEY REFERENCES users(id),
  company_id         UUID NOT NULL REFERENCES companies(id),

  -- 채널별 on/off
  push_enabled       BOOLEAN NOT NULL DEFAULT true,
  email_enabled      BOOLEAN NOT NULL DEFAULT true,

  -- 기능별 on/off (push)
  push_task          BOOLEAN NOT NULL DEFAULT true,
  push_message       BOOLEAN NOT NULL DEFAULT true,
  push_schedule      BOOLEAN NOT NULL DEFAULT true,
  push_attendance    BOOLEAN NOT NULL DEFAULT true,   -- 관리자 전용

  -- 기능별 on/off (email)
  email_task         BOOLEAN NOT NULL DEFAULT false,  -- 이메일은 중요 알림만
  email_weekly_report BOOLEAN NOT NULL DEFAULT true,

  -- 방해 금지 시간 (KST 기준)
  dnd_enabled        BOOLEAN NOT NULL DEFAULT false,
  dnd_start_time     TIME DEFAULT '22:00',
  dnd_end_time       TIME DEFAULT '08:00',

  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. 알림 트리거 전체 목록

### 4-1. Customer 앱 내 알림

#### 업무(Task) 관련

| 트리거 | type 코드 | 수신자 | 인앱 | 푸시 | 이메일 |
|--------|----------|--------|:----:|:----:|:------:|
| 업무 배정됨 | `task_assigned` | assignee | ✅ | ✅ | ❌ |
| 업무 기한 D-1 | `task_due_soon` | assignee | ✅ | ✅ | ❌ |
| 내 업무가 완료됨 | `task_completed` | creator | ✅ | ✅ | ❌ |
| 업무 우선순위 urgent 변경 | `task_urgent` | assignee | ✅ | ✅ | ❌ |

**업무 기한 D-1 스케줄러**
```
매일 09:00 KST 실행
WHERE due_date = CURRENT_DATE + 1
  AND status NOT IN ('done', 'cancelled')
  AND assignee_id IS NOT NULL
```

#### 보고서(Report) 관련

| 트리거 | type 코드 | 수신자 | 인앱 | 푸시 | 이메일 |
|--------|----------|--------|:----:|:----:|:------:|
| 보고서에 피드백 등록 | `report_feedback` | 보고서 작성자 | ✅ | ✅ | ❌ |

#### 메시지(Chat) 관련

| 트리거 | type 코드 | 수신자 | 인앱 | 푸시 | 이메일 |
|--------|----------|--------|:----:|:----:|:------:|
| @멘션 받음 | `message_mention` | 멘션된 사람 | ✅ | ✅ | ❌ |
| 공지 채널 새 메시지 | `channel_announcement` | 채널 멤버 전체 | ✅ | ✅ | ❌ |
| DM 받음 | `message_dm` | DM 상대방 | ✅ | ✅ | ❌ |

**멘션 감지 로직**
```
메시지 content에서 @[name] 또는 @[userId] 패턴 파싱
→ 해당 사용자 ID 추출 → 알림 생성
```

#### 스케줄(Schedule) 관련

| 트리거 | type 코드 | 수신자 | 인앱 | 푸시 | 이메일 |
|--------|----------|--------|:----:|:----:|:------:|
| 일정 시작 N분 전 | `schedule_reminder` | 참석 대상 | ✅ | ✅ | ❌ |
| 새 일정 등록 (전사 공개) | `schedule_new` | 전 직원 | ✅ | ✅ | ❌ |

**리마인더 스케줄러**
```
매 5분마다 실행
WHERE start_at BETWEEN now() AND now() + notify_before_min * interval '1 minute'
  AND reminder_sent = false
→ reminder_sent = true 업데이트 후 알림 발송
```

#### 근태(Attendance) 관련 (관리자 전용)

| 트리거 | type 코드 | 수신자 | 인앱 | 푸시 | 이메일 |
|--------|----------|--------|:----:|:----:|:------:|
| 직원 지각 감지 | `attendance_late` | owner, manager | ✅ | ✅ | ❌ |
| 직원 미출근 (오전 11시 기준) | `attendance_absent` | owner, manager | ✅ | ✅ | ❌ |

**미출근 감지 스케줄러**
```
매일 11:00 KST 실행
근무일인 직원 중 clock_in_at IS NULL인 경우
→ attendance_records에 status = 'absent' 기록 + 관리자 알림
```

---

### 4-2. Admin → 고객 이메일 알림

> Admin 시스템이 발송하는 이메일. 고객 앱 내 인앱 알림/푸시 없음.

#### 결제/구독 관련

| 트리거 | 이메일 템플릿 | 수신자 | 발송 시점 |
|--------|-------------|--------|---------|
| 구독 갱신 예고 | `billing-renewal-notice` | billing_email | 갱신 D-3 09:00 |
| 결제 성공 | `billing-payment-success` | billing_email | 결제 완료 즉시 |
| 결제 실패 (1차) | `billing-payment-failed-1` | billing_email | 실패 즉시 |
| 결제 실패 (2차, D+1) | `billing-payment-failed-2` | billing_email + owner | 재시도 실패 |
| 결제 실패 (3차, D+3) | `billing-payment-failed-3` | billing_email + owner | 재시도 실패, 긴급 |
| 서비스 정지 예고 (D+7) | `billing-suspension-warning` | billing_email + owner | 최종 실패 후 |
| 서비스 정지 | `service-suspended` | owner | 정지 처리 즉시 |
| 서비스 복구 | `service-reactivated` | owner | 복구 즉시 |
| 환불 처리 완료 | `billing-refund-completed` | billing_email | 환불 즉시 |
| 세금계산서 발행 | `tax-invoice-issued` | tax_invoice_email | 발행 완료 즉시 |

#### 계정/온보딩 관련

| 트리거 | 이메일 템플릿 | 수신자 | 발송 시점 |
|--------|-------------|--------|---------|
| 회원가입 이메일 인증 | `auth-email-verify` | 가입자 | 가입 즉시 |
| 직원 초대 | `user-invite` | 초대받은 이메일 | 초대 즉시 |
| 비밀번호 재설정 | `auth-password-reset` | 요청자 | 요청 즉시 |
| owner 비밀번호 초기화 (Admin) | `auth-password-admin-reset` | owner | Admin 처리 즉시 |
| 무료 체험 만료 D-7 | `trial-expiring-7d` | owner | 체험 만료 7일 전 |
| 무료 체험 만료 D-1 | `trial-expiring-1d` | owner | 체험 만료 1일 전 |
| 무료 체험 만료 | `trial-expired` | owner | 만료 당일 |
| 구독 해지 확인 | `subscription-canceled` | owner | 해지 처리 즉시 |
| 데이터 삭제 예고 (해지 후 90일) | `data-deletion-warning` | owner | 해지 후 83일째 |

---

## 5. 이메일 템플릿 목록

### 5-1. React Email 컴포넌트 구조

```
apps/customer-backend/src/modules/notifications/
└── emails/
    ├── components/
    │   ├── EmailLayout.tsx       # 공통 레이아웃 (로고, 푸터)
    │   ├── EmailButton.tsx       # CTA 버튼
    │   └── EmailDivider.tsx
    ├── auth-email-verify.tsx
    ├── user-invite.tsx
    ├── auth-password-reset.tsx
    ├── billing-renewal-notice.tsx
    ├── billing-payment-success.tsx
    ├── billing-payment-failed-1.tsx
    ├── billing-payment-failed-2.tsx
    ├── billing-payment-failed-3.tsx
    ├── billing-suspension-warning.tsx
    ├── billing-refund-completed.tsx
    ├── service-suspended.tsx
    ├── service-reactivated.tsx
    ├── tax-invoice-issued.tsx
    ├── trial-expiring-7d.tsx
    ├── trial-expiring-1d.tsx
    ├── trial-expired.tsx
    ├── subscription-canceled.tsx
    └── data-deletion-warning.tsx
```

### 5-2. 공통 이메일 레이아웃 변수

모든 템플릿이 공통으로 받는 props:
```typescript
interface BaseEmailProps {
  companyName: string;      // 고객사 이름
  recipientName: string;    // 수신자 이름
  supportEmail: string;     // 'support@gwanriwang.com'
  year: number;             // 저작권 연도
}
```

### 5-3. 주요 템플릿 변수 명세

#### `billing-payment-failed-{1,2,3}` (긴급도 3단계)

```typescript
interface PaymentFailedEmailProps extends BaseEmailProps {
  invoiceNumber: string;          // INV-2026-03-000123
  failureReason: string;          // "카드 한도 초과"
  totalAmountKrw: number;         // 165000
  retryScheduledAt: string;       // "2026-03-12 00:05"
  updatePaymentUrl: string;       // 결제 수단 변경 페이지 URL
  urgencyLevel: 1 | 2 | 3;       // 이메일 톤 조절용
}
```

#### `user-invite`

```typescript
interface UserInviteEmailProps extends BaseEmailProps {
  inviterName: string;            // "홍길동"
  inviteUrl: string;              // 초대 수락 URL (토큰 포함, 48시간 유효)
  expiresAt: string;              // "2026-03-13 10:30"
  planName: string;               // "Pro 플랜"
}
```

#### `billing-renewal-notice`

```typescript
interface RenewalNoticeEmailProps extends BaseEmailProps {
  nextBillingAt: string;          // "2026-03-14"
  planName: string;
  totalAmountKrw: number;
  paymentMethodSummary: string;   // "신한카드 (****1234)"
  manageSubscriptionUrl: string;
}
```

---

## 6. BullMQ 큐 설계

### 6-1. 큐 목록

| 큐 이름 | 처리 내용 | Worker 수 | 재시도 |
|---------|---------|----------|--------|
| `email-queue` | Resend API 이메일 발송 | 2 | 최대 3회, 지수 백오프 |
| `push-queue` | Expo Push 알림 발송 | 2 | 최대 3회 |
| `notification-scheduler` | 기한 D-1, 리마인더 등 스케줄 | 1 | 재시도 없음 (다음 실행에서 처리) |

### 6-2. Job 데이터 구조

```typescript
// email-queue Job
interface EmailJob {
  templateName: string;           // 'billing-payment-failed-1'
  to: string;                     // 수신 이메일
  subject: string;
  props: Record<string, unknown>; // 템플릿별 변수
  notificationId?: string;        // 연관 알림 ID (로깅용)
}

// push-queue Job
interface PushJob {
  userId: string;
  title: string;
  body: string;
  data: {                         // 딥링크용
    refType?: string;
    refId?: string;
    notificationId: string;
  };
  notificationId: string;
}
```

### 6-3. 큐 설정

```typescript
// BullMQ 공통 설정
const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,          // 2초 → 4초 → 8초
  },
  removeOnComplete: { age: 86400 },  // 완료 Job 24시간 후 삭제
  removeOnFail: { age: 604800 },     // 실패 Job 7일 후 삭제
};

// DND(방해금지) 체크
// push-queue Worker에서 dispatch 전 사용자 notification_settings 확인
// dnd_enabled = true이고 현재 시각이 dnd 시간대이면 Job을 즉시 처리하지 않고
// dnd_end_time까지 delay 설정 후 재스케줄
```

### 6-4. 스케줄 큐 (BullMQ Scheduler)

```typescript
// 반복 실행 Job 등록
await notificationScheduler.add(
  'task-due-soon',
  {},
  { repeat: { cron: '0 9 * * *', tz: 'Asia/Seoul' } }   // 매일 09:00 KST
);

await notificationScheduler.add(
  'attendance-absent-check',
  {},
  { repeat: { cron: '0 11 * * 1-5', tz: 'Asia/Seoul' } } // 평일 11:00 KST
);

await notificationScheduler.add(
  'schedule-reminder',
  {},
  { repeat: { cron: '*/5 * * * *' } }                    // 5분마다
);

await notificationScheduler.add(
  'trial-expiring',
  {},
  { repeat: { cron: '0 9 * * *', tz: 'Asia/Seoul' } }   // 매일 09:00 KST
);

await notificationScheduler.add(
  'renewal-notice',
  {},
  { repeat: { cron: '0 9 * * *', tz: 'Asia/Seoul' } }   // 매일 09:00 KST (D-3)
);
```

---

## 7. 사용자 알림 설정

### 7-1. 기본값 정책

| 설정 | 기본값 | 이유 |
|------|--------|------|
| 인앱 알림 | 항상 ON (설정 불가) | 핵심 UX, off 허용 안 함 |
| 푸시 알림 전체 | ON | 중요 알림 놓침 방지 |
| 이메일 알림 | 트리거별 (표 참조) | 이메일 알림은 선택적 |
| 방해 금지 | OFF | 사용자가 직접 설정 |

### 7-2. 알림 설정 우선순위

```
1. 사용자 DND 시간 → DND 시간이면 푸시 지연 (이메일은 그대로 발송)
2. 기능별 설정 (push_task, push_message 등)
3. 전체 채널 설정 (push_enabled, email_enabled)
```

### 7-3. 알림 그루핑 (과도한 알림 방지)

- **공지 채널**: 연속으로 3개 이상 메시지 발송 시 "N개의 새 메시지" 1건으로 묶어서 푸시
- **지각 알림**: 하루에 1번만 (중복 방지)
- **일정 리마인더**: 동일 일정 중복 발송 방지 (`schedules.reminder_sent` 플래그)

---

## 8. NestJS 구현 구조

### 8-1. 모듈 구조

```
src/modules/notifications/
├── notifications.module.ts
├── notifications.service.ts        # 핵심 dispatch 로직
├── notifications.controller.ts     # 인앱 알림 REST API
├── dto/
│   ├── notification-query.dto.ts
│   └── notification-settings.dto.ts
├── entities/
│   ├── notification.entity.ts
│   ├── device-token.entity.ts
│   └── notification-settings.entity.ts
├── queues/
│   ├── email.queue.ts              # BullMQ 큐 정의
│   ├── email.processor.ts          # Worker
│   ├── push.queue.ts
│   └── push.processor.ts
├── schedulers/
│   ├── notification.scheduler.ts   # 스케줄 Job 등록
│   └── notification-scheduler.processor.ts
├── emails/                         # React Email 템플릿
│   ├── components/
│   └── [templates].tsx
└── templates/
    └── email-renderer.service.ts   # @react-email/render 래핑
```

### 8-2. NotificationService 핵심 인터페이스

```typescript
// notifications.service.ts

interface DispatchOptions {
  userId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  body: string;
  refType?: 'task' | 'task_report' | 'message' | 'schedule' | 'payment';
  refId?: string;
  // 이메일 발송이 필요한 경우
  email?: {
    to: string;
    templateName: string;
    props: Record<string, unknown>;
  };
}

@Injectable()
export class NotificationsService {
  async dispatch(options: DispatchOptions): Promise<void> {
    // 1. DB 저장 (인앱 알림)
    const notification = await this.notificationsRepo.save({...});

    // 2. 소켓 이벤트 발행 (즉시, 동기)
    this.socketService.emitToUser(options.userId, 'notification:new', {
      id: notification.id,
      type: options.type,
      title: options.title,
      body: options.body,
      refType: options.refType,
      refId: options.refId,
      isRead: false,
      createdAt: notification.createdAt,
    });

    // 3. 알림 설정 조회
    const settings = await this.getSettings(options.userId);

    // 4. 푸시 알림 큐 추가
    if (settings.push_enabled && this.isPushEnabled(settings, options.type)) {
      const tokens = await this.getActiveTokens(options.userId);
      if (tokens.length > 0) {
        await this.pushQueue.add('send-push', {
          userId: options.userId,
          title: options.title,
          body: options.body,
          data: { refType: options.refType, refId: options.refId, notificationId: notification.id },
          notificationId: notification.id,
        });
      }
    }

    // 5. 이메일 큐 추가
    if (options.email) {
      await this.emailQueue.add('send-email', {
        templateName: options.email.templateName,
        to: options.email.to,
        subject: options.title,
        props: options.email.props,
        notificationId: notification.id,
      });
    }
  }
}
```

### 8-3. 사용 예시 — 업무 배정 시

```typescript
// tasks.service.ts
async assignTask(taskId: string, assigneeId: string, assignedBy: User) {
  await this.tasksRepo.update(taskId, { assigneeId });

  await this.notificationsService.dispatch({
    userId: assigneeId,
    companyId: assignedBy.companyId,
    type: 'task_assigned',
    title: '새 업무가 배정되었습니다',
    body: `${assignedBy.name}님이 '${task.title}' 업무를 배정했습니다`,
    refType: 'task',
    refId: taskId,
    // 이메일 없음 (task_assigned는 이메일 미발송)
  });
}
```

### 8-4. 패키지

```bash
# BullMQ
pnpm add @nestjs/bullmq bullmq

# Resend + React Email
pnpm add resend @react-email/render @react-email/components react react-dom

# Expo Push
pnpm add expo-server-sdk
```

---

## 9. Expo Push 연동

### 9-1. 서버 사이드 발송

```typescript
// push.processor.ts
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

@Processor('push-queue')
export class PushProcessor {
  private expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

  @Process('send-push')
  async handlePush(job: Job<PushJob>) {
    const { userId, title, body, data } = job.data;

    const tokens = await this.deviceTokensRepo.findActiveByUser(userId);
    const messages: ExpoPushMessage[] = tokens
      .filter(t => Expo.isExpoPushToken(t.token))
      .map(t => ({
        to: t.token,
        title,
        body,
        data,
        sound: 'default',
        badge: 1,                    // 미읽음 배지 (실제는 서버에서 카운트)
      }));

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const receipts = await this.expo.sendPushNotificationsAsync(chunk);
      // 토큰 무효화 처리 (DeviceNotRegistered 에러)
      this.handleInvalidTokens(receipts, tokens);
    }
  }

  private async handleInvalidTokens(receipts, tokens) {
    receipts.forEach((receipt, i) => {
      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        // 해당 토큰 비활성화
        this.deviceTokensRepo.deactivate(tokens[i].token);
      }
    });
  }
}
```

### 9-2. 클라이언트 토큰 등록 (React Native)

```typescript
// hooks/usePushNotifications.ts
import * as Notifications from 'expo-notifications';

export async function registerPushToken(api: ApiClient) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PROJECT_ID,
  })).data;

  // 서버에 토큰 등록
  await api.post('/notifications/device-token', {
    token,
    platform: Platform.OS,   // 'ios' | 'android'
    deviceName: Device.deviceName,
  });
}
```

---

## 10. Resend 이메일 연동

### 10-1. 이메일 렌더러 서비스

```typescript
// email-renderer.service.ts
import { render } from '@react-email/render';

@Injectable()
export class EmailRendererService {
  async renderTemplate(templateName: string, props: Record<string, unknown>): Promise<string> {
    const templates: Record<string, React.ComponentType<any>> = {
      'billing-payment-failed-1': BillingPaymentFailed1Email,
      'billing-renewal-notice': BillingRenewalNoticeEmail,
      'user-invite': UserInviteEmail,
      // ... 전체 목록
    };

    const Template = templates[templateName];
    if (!Template) throw new Error(`Unknown template: ${templateName}`);

    return render(<Template {...props} />);
  }
}
```

### 10-2. 이메일 프로세서

```typescript
// email.processor.ts
import { Resend } from 'resend';

@Processor('email-queue')
export class EmailProcessor {
  private resend = new Resend(process.env.RESEND_API_KEY);

  @Process('send-email')
  async handleEmail(job: Job<EmailJob>) {
    const html = await this.emailRendererService.renderTemplate(
      job.data.templateName,
      job.data.props
    );

    await this.resend.emails.send({
      from: '관리왕 <noreply@gwanriwang.com>',
      to: job.data.to,
      subject: job.data.subject,
      html,
    });
  }
}
```

### 10-3. 발신 도메인 설정

```
도메인: gwanriwang.com
발신 주소 유형:
  noreply@gwanriwang.com   — 자동 알림 (결제, 인증 등)
  support@gwanriwang.com   — 수신 가능한 지원 이메일 (이메일 푸터 표기용)

Resend 도메인 인증:
  - DNS TXT 레코드 (SPF)
  - DNS TXT 레코드 (DKIM)
  - DNS CNAME (추적 도메인, 선택)
```

---

## 11. 알림 REST API

### Base URL
```
/v1/notifications
Authorization: Bearer <customer_jwt>
```

### 엔드포인트

```
GET    /notifications                     인앱 알림 목록 (페이지네이션)
GET    /notifications/unread-count        미읽음 알림 개수
PATCH  /notifications/:id/read            단건 읽음 처리
PATCH  /notifications/read-all            전체 읽음 처리
DELETE /notifications/:id                 알림 삭제

GET    /notifications/settings            알림 설정 조회
PATCH  /notifications/settings            알림 설정 수정

POST   /notifications/device-token        Expo Push Token 등록
DELETE /notifications/device-token/:token 토큰 삭제 (로그아웃 시)
```

### 알림 목록 응답

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "task_assigned",
      "title": "새 업무가 배정되었습니다",
      "body": "홍길동님이 '3월 보고서 작성' 업무를 배정했습니다",
      "refType": "task",
      "refId": "uuid",
      "isRead": false,
      "createdAt": "2026-03-11T10:30:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "unreadCount": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 알림 설정 수정 요청

```json
{
  "pushEnabled": true,
  "pushTask": true,
  "pushMessage": true,
  "pushSchedule": false,
  "dndEnabled": true,
  "dndStartTime": "22:00",
  "dndEndTime": "08:00"
}
```

---

## 부록. 알림 타입 코드 전체 목록

```typescript
export type NotificationType =
  // 업무
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_completed'
  | 'task_urgent'
  // 보고서
  | 'report_feedback'
  // 메시지
  | 'message_mention'
  | 'message_dm'
  | 'channel_announcement'
  // 스케줄
  | 'schedule_reminder'
  | 'schedule_new'
  // 근태 (관리자)
  | 'attendance_late'
  | 'attendance_absent';
```
