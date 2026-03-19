# 실시간 이벤트 명세 (Socket.io)

> B2B SaaS 직원 관리 플랫폼 — 실시간 통신 설계
> 작성일: 2026-03-11
> 결정 사항: 채널룸 + 사용자룸 / DB 저장 우선 / Redis Adapter / 채팅+알림만 소켓

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [Room 구조](#2-room-구조)
3. [인증 미들웨어](#3-인증-미들웨어)
4. [이벤트 네이밍 컨벤션](#4-이벤트-네이밍-컨벤션)
5. [이벤트 전체 명세](#5-이벤트-전체-명세)
6. [메시지 신뢰성 전략](#6-메시지-신뢰성-전략)
7. [실시간 처리 범위](#7-실시간-처리-범위)
8. [NestJS 구현 구조](#8-nestjs-구현-구조)
9. [클라이언트 연결 전략](#9-클라이언트-연결-전략)
10. [에러 처리](#10-에러-처리)

---

## 1. 아키텍처 개요

```
클라이언트 (Web / Mobile)
     │  WebSocket (wss://)
     ▼
AWS ALB (Sticky Session 비활성, Redis Adapter로 대체)
     │
  ┌──▼──────────────────────────┐
  │       ECS Fargate            │
  │  NestJS 서버 A  │ NestJS 서버 B │
  └──────────┬───────────┬──────┘
             │  Redis Pub/Sub    │
             └───────────────────┘
                     │
             ElastiCache Redis
             (Socket.io Redis Adapter)
```

**핵심 원칙**
- 소켓은 "신호(signal)" 역할만 담당 — 실제 데이터는 REST API에서 조회
- 메시지는 반드시 DB 저장 후 소켓 이벤트 발행 (DB 저장 실패 시 이벤트 미발행)
- Redis Adapter로 다중 서버 인스턴스에서 이벤트 정상 전달 보장

---

## 2. Room 구조

### 2-1. Room 유형

| Room 이름 | 형식 | 가입 시점 | 용도 |
|-----------|------|----------|------|
| 사용자 룸 | `user:{userId}` | 소켓 연결 시 자동 | 개인 알림, 업무 배정, 멘션 |
| 채널 룸 | `channel:{channelId}` | 채널 입장 시 | 채팅 메시지, 읽음 처리 |

### 2-2. Room 가입/탈퇴 흐름

```
소켓 연결 (handshake + JWT 검증)
    ↓
서버: socket.join(`user:${userId}`)          // 자동 가입
    ↓
클라이언트: emit('channel:join', { channelId })
    ↓
서버: 멤버 검증 후 socket.join(`channel:${channelId}`)
    ↓
클라이언트: emit('channel:leave', { channelId })
    ↓
서버: socket.leave(`channel:${channelId}`)
```

### 2-3. 룸 명명 규칙

```
user:{uuid}          예) user:550e8400-e29b-41d4-a716-446655440000
channel:{uuid}       예) channel:7c9e6679-7425-40de-944b-e07fc1f90ae7
```

---

## 3. 인증 미들웨어

### 3-1. Handshake 인증

```typescript
// 클라이언트 연결 시 Authorization 헤더 또는 query 파라미터로 JWT 전달
// Option 1: auth 객체 (권장)
const socket = io('wss://api.gwanriwang.com', {
  auth: { token: accessToken }
});

// Option 2: query (모바일 fallback)
const socket = io('wss://api.gwanriwang.com', {
  query: { token: accessToken }
});
```

### 3-2. 서버 인증 미들웨어

```typescript
// src/modules/socket/socket.middleware.ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token ?? socket.handshake.query.token;
  if (!token) return next(new Error('UNAUTHORIZED'));

  try {
    const payload = jwtService.verify(token);
    socket.data.userId = payload.sub;
    socket.data.companyId = payload.companyId;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('TOKEN_EXPIRED'));  // 클라이언트에서 refresh 후 재연결
  }
});
```

### 3-3. 채널 입장 권한 검증

```typescript
// 채널 join 시 DB에서 채널 멤버 여부 확인
// company_id 일치 + channel_members 테이블 조회
// 권한 없으면 'error' 이벤트 emit 후 join 거부
```

---

## 4. 이벤트 네이밍 컨벤션

```
{resource}:{action}

resource: message, channel, notification, attendance, task
action:   new, update, delete, read, join, leave, error
```

**예시**
```
message:new          새 메시지 수신
message:update       메시지 수정
message:delete       메시지 삭제
channel:read         채널 읽음 처리
channel:join         채널 입장
channel:leave        채널 퇴장
notification:new     새 인앱 알림
attendance:updated   근태 상태 변경 (관리자 대시보드용)
task:assigned        업무 배정 알림
```

---

## 5. 이벤트 전체 명세

### 5-1. 연결/해제 이벤트

#### `connect` (시스템)
클라이언트 → 서버. 소켓 연결 완료 후 자동 발생.

**서버 처리**
1. JWT 검증 (미들웨어)
2. `user:{userId}` 룸 자동 가입
3. 서버 → 클라이언트: `connected` 이벤트

```json
// 서버 → 클라이언트: connected
{
  "userId": "uuid",
  "companyId": "uuid"
}
```

---

#### `disconnect` (시스템)
연결 해제 시 서버가 자동으로 모든 룸에서 제거.

---

### 5-2. 채널 이벤트

#### `channel:join` (클라이언트 → 서버)
채팅 화면 진입 시 해당 채널 룸 구독.

```json
// 클라이언트 → 서버
{
  "channelId": "uuid"
}

// 서버 응답 (callback)
{
  "success": true
}
// 실패 시
{
  "success": false,
  "error": "NOT_MEMBER"
}
```

---

#### `channel:leave` (클라이언트 → 서버)
채팅 화면 이탈 시 룸 구독 해제.

```json
{ "channelId": "uuid" }
```

---

#### `channel:read` (클라이언트 → 서버)
사용자가 채널의 특정 시점까지 읽음 처리.

```json
// 클라이언트 → 서버
{
  "channelId": "uuid",
  "lastReadAt": "2026-03-11T10:30:00Z"
}
```

**서버 처리**
1. `channel_members.last_read_at` 업데이트
2. 같은 채널 룸의 다른 사용자에게 읽음 상태 브로드캐스트

```json
// 서버 → channel:{channelId} 룸 (읽은 사람 제외)
// 이벤트명: channel:read_updated
{
  "channelId": "uuid",
  "userId": "uuid",          // 읽은 사람
  "lastReadAt": "2026-03-11T10:30:00Z"
}
```

---

### 5-3. 메시지 이벤트

> **중요**: 메시지 전송은 REST API(`POST /channels/:id/messages`)로만 가능.
> 소켓은 수신 전용. 서버가 DB 저장 완료 후 소켓 이벤트를 발행.

#### `message:new` (서버 → 클라이언트)
대상: `channel:{channelId}` 룸 전체

```json
{
  "id": "uuid",
  "channelId": "uuid",
  "user": {
    "id": "uuid",
    "name": "홍길동",
    "profileImageUrl": "https://..."
  },
  "content": "안녕하세요",
  "contentType": "text",          // text | image | file | system
  "attachmentUrl": null,
  "attachmentName": null,
  "attachmentSize": null,
  "parentMessageId": null,        // 스레드 답글인 경우 부모 메시지 ID
  "isEdited": false,
  "createdAt": "2026-03-11T10:30:00Z"
}
```

---

#### `message:update` (서버 → 클라이언트)
대상: `channel:{channelId}` 룸 전체

```json
{
  "id": "uuid",
  "channelId": "uuid",
  "content": "수정된 내용",
  "isEdited": true,
  "editedAt": "2026-03-11T10:35:00Z"
}
```

---

#### `message:delete` (서버 → 클라이언트)
대상: `channel:{channelId}` 룸 전체

```json
{
  "id": "uuid",
  "channelId": "uuid",
  "deletedAt": "2026-03-11T10:40:00Z"
}
```

---

### 5-4. 알림 이벤트

#### `notification:new` (서버 → 클라이언트)
대상: `user:{userId}` 룸 (개인 알림)

```json
{
  "id": "uuid",
  "type": "task_assigned",        // 아래 알림 타입 코드 참조
  "title": "새 업무가 배정되었습니다",
  "body": "홍길동님이 '3월 보고서 작성' 업무를 배정했습니다",
  "refType": "task",              // task | task_report | message | schedule | null
  "refId": "uuid",                // 클릭 시 이동할 대상 ID
  "isRead": false,
  "createdAt": "2026-03-11T10:30:00Z"
}
```

**알림 타입 코드**

| type | 발생 조건 |
|------|----------|
| `task_assigned` | 업무 배정됨 |
| `task_due_soon` | 업무 기한 D-1 |
| `task_completed` | 내가 만든 업무가 완료됨 |
| `report_feedback` | 내 보고서에 피드백 등록 |
| `message_mention` | 채팅에서 @멘션 받음 |
| `channel_announcement` | 공지 채널 새 메시지 |
| `schedule_reminder` | 일정 시작 N분 전 리마인더 |
| `attendance_alert` | 출근 지각 감지 (관리자용) |

---

#### `notification:read_all` (클라이언트 → 서버)
사용자가 "모두 읽음" 처리 요청.

```json
{}  // payload 없음
```

**서버 처리**: `notifications` 테이블에서 해당 사용자 모든 알림 `is_read = true`

---

### 5-5. 업무 이벤트

#### `task:assigned` (서버 → 클라이언트)
대상: `user:{assigneeId}` 룸 (배정받은 사람)

> `notification:new` 이벤트와 동시 발행. UI에서 업무 목록 즉시 갱신 트리거.

```json
{
  "taskId": "uuid",
  "taskTitle": "3월 보고서 작성",
  "assignedBy": {
    "id": "uuid",
    "name": "홍길동"
  }
}
```

---

#### `task:status_changed` (서버 → 클라이언트)
대상: `user:{creatorId}` 룸 (업무 생성자)

```json
{
  "taskId": "uuid",
  "taskTitle": "3월 보고서 작성",
  "newStatus": "done",
  "changedBy": {
    "id": "uuid",
    "name": "김철수"
  }
}
```

---

### 5-6. 에러 이벤트

#### `error` (서버 → 클라이언트)
인증 실패, 권한 없음 등 에러 상황.

```json
{
  "code": "UNAUTHORIZED",          // UNAUTHORIZED | TOKEN_EXPIRED | NOT_MEMBER | FORBIDDEN
  "message": "인증이 필요합니다"
}
```

**클라이언트 처리 규칙**
- `TOKEN_EXPIRED`: Access Token 갱신 후 소켓 재연결
- `UNAUTHORIZED`: 로그인 화면으로 이동
- `NOT_MEMBER`: 채널 입장 거부 처리

---

## 6. 메시지 신뢰성 전략

### 6-1. 메시지 전송 플로우 (DB 저장 우선)

```
클라이언트
  │
  ├─① REST POST /channels/:id/messages
  │      │
  │      ├─ DB 저장 (messages 테이블)
  │      ├─ 소켓 이벤트 발행 (channel:{id} 룸)  ← DB 저장 성공 후에만
  │      └─ HTTP 201 응답
  │
  └─② 소켓으로 message:new 이벤트 수신
         └─ 화면에 메시지 추가 (REST 응답에 이미 낙관적 추가했다면 중복 제거)
```

### 6-2. 연결 끊김 후 복구 (Missed Messages)

```
소켓 재연결 이벤트 발생
    ↓
클라이언트: 마지막으로 받은 메시지 ID 또는 타임스탬프 기억
    ↓
REST API: GET /channels/:id/messages?after={lastMessageId}
    ↓
유실된 메시지 조회 및 화면 갱신
```

### 6-3. 중복 이벤트 방지

- 각 메시지에 고유 `id`(UUID) 포함
- 클라이언트는 수신한 메시지 ID를 Set으로 관리, 중복 무시
- 낙관적 업데이트 미사용 (단순성 우선)

---

## 7. 실시간 처리 범위

| 기능 | 방식 | 이유 |
|------|------|------|
| 채팅 메시지 수신 | 소켓 `message:new` | 실시간 필수 |
| 메시지 수정/삭제 | 소켓 `message:update/delete` | 실시간 필수 |
| 채팅 읽음 처리 | 소켓 `channel:read` | 읽음 배지 UX |
| 업무 배정 알림 | 소켓 `task:assigned` + FCM | 앱 켬/끔 모두 커버 |
| 인앱 알림 | 소켓 `notification:new` | 즉각 배지 업데이트 |
| 멘션 알림 | 소켓 `notification:new` + FCM | 앱 켬/끔 모두 커버 |
| 근태 현황 대시보드 | **REST 폴링 (30초)** | 실시간성 낮음, 서버 부하 불필요 |
| 결제/서비스 알림 | **FCM + 이메일만** | 소켓 연결 없어도 수신해야 함 |

---

## 8. NestJS 구현 구조

### 8-1. 모듈 구조

```
src/modules/socket/
├── socket.module.ts          # Socket.io + Redis Adapter 초기화
├── socket.gateway.ts         # 메인 Gateway (연결, 채널 join/leave)
├── socket.middleware.ts      # JWT 인증 미들웨어
├── socket.service.ts         # 다른 모듈에서 소켓 이벤트 발행용 서비스
└── guards/
    └── ws-auth.guard.ts      # @UseGuards로 개별 핸들러 보호
```

### 8-2. Redis Adapter 설정

```typescript
// socket.module.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

### 8-3. SocketService — 타 모듈에서 이벤트 발행

```typescript
// socket.service.ts
@Injectable()
export class SocketService {
  constructor(@InjectSocketIoServer() private readonly io: Server) {}

  // 채널 전체에 이벤트 발행
  emitToChannel(channelId: string, event: string, data: unknown) {
    this.io.to(`channel:${channelId}`).emit(event, data);
  }

  // 특정 사용자에게 이벤트 발행
  emitToUser(userId: string, event: string, data: unknown) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
}

// 메시지 서비스에서 사용 예시
// messages.service.ts
async createMessage(dto: CreateMessageDto) {
  const message = await this.messagesRepo.save(dto);   // DB 저장 먼저
  this.socketService.emitToChannel(                     // 저장 성공 후 이벤트
    dto.channelId,
    'message:new',
    this.toMessagePayload(message)
  );
  return message;
}
```

### 8-4. 패키지

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io
pnpm add socket.io @socket.io/redis-adapter
pnpm add -D @types/socket.io
```

---

## 9. 클라이언트 연결 전략

### 9-1. Web (Next.js)

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_API_URL, {
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,       // 1초 후 재연결
    reconnectionDelayMax: 30000,   // 최대 30초 간격으로 증가
    transports: ['websocket'],     // polling fallback 비활성 (성능)
  });

  socket.on('error', ({ code }) => {
    if (code === 'TOKEN_EXPIRED') {
      refreshAccessToken().then(newToken => {
        socket?.auth && (socket.auth = { token: newToken });
        socket?.connect();
      });
    }
  });

  socket.on('disconnect', () => {
    // 재연결 후 missed 메시지 REST API로 조회
    socket?.on('connect', () => fetchMissedMessages());
  });

  return socket;
}
```

### 9-2. Mobile (React Native + Expo)

```typescript
// 동일한 socket.io-client 사용
// Expo는 WebSocket을 네이티브로 지원하므로 별도 설정 불필요
import { io } from 'socket.io-client';
// 설정 동일 (transports: ['websocket'])
```

---

## 10. 에러 처리

| 에러 코드 | 원인 | 클라이언트 처리 |
|----------|------|---------------|
| `UNAUTHORIZED` | 토큰 없음 | 로그인 화면 이동 |
| `TOKEN_EXPIRED` | JWT 만료 | 토큰 갱신 후 재연결 |
| `NOT_MEMBER` | 채널 멤버 아님 | 채널 입장 거부 UI |
| `FORBIDDEN` | 권한 없음 | 에러 토스트 표시 |
| `RATE_LIMITED` | 너무 많은 이벤트 | 1초 후 재시도 |

### 서버 사이드 Rate Limiting

```
채널 join: 사용자당 30개 채널 동시 구독 제한
메시지 전송: REST API 레이어에서 처리 (소켓은 수신 전용)
```
