# 파일 업로드 설계 명세

> B2B SaaS 직원 관리 플랫폼 — 파일 저장 전략
> 작성일: 2026-03-11
> 결정 사항: AWS S3 + CloudFront CDN / Presigned URL 직접 업로드

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [S3 버킷 구조](#2-s3-버킷-구조)
3. [파일 경로 규칙](#3-파일-경로-규칙)
4. [Presigned URL 업로드 플로우](#4-presigned-url-업로드-플로우)
5. [파일 유형별 정책](#5-파일-유형별-정책)
6. [플랜별 저장 용량 제한](#6-플랜별-저장-용량-제한)
7. [이미지 처리](#7-이미지-처리)
8. [파일 삭제 정책](#8-파일-삭제-정책)
9. [보안 설정](#9-보안-설정)
10. [DB 테이블 설계](#10-db-테이블-설계)
11. [REST API](#11-rest-api)
12. [NestJS 구현 구조](#12-nestjs-구현-구조)

---

## 1. 아키텍처 개요

```
클라이언트
    │
    ├─① GET /files/upload-url        ← 서버에 Presigned URL 요청
    │       │
    │       ▼
    │   서버: S3 Presigned URL 생성 (PUT, 10분 유효)
    │       │
    │◀──── Presigned URL + fileKey 반환
    │
    ├─② PUT {presignedUrl} + 파일 바이너리   ← S3에 직접 업로드 (서버 경유 없음)
    │   (Content-Type 헤더 포함)
    │
    ├─③ POST /files/confirm           ← 업로드 완료 서버에 알림
    │       │
    │       ▼
    │   서버: S3 객체 존재 확인 → files 테이블 레코드 확정
    │       │
    │◀──── { fileId, url }

공개 파일 (프로필 이미지):
    CloudFront URL로 직접 접근 가능

비공개 파일 (업무 첨부, 메시지 첨부):
    GET /files/:id/download → 서버가 Presigned GET URL 발급 (5분 유효)
```

**Presigned URL 방식을 쓰는 이유**
- 파일이 서버를 거치지 않아 서버 메모리/대역폭 불필요
- S3 업로드 성능이 서버 성능에 무관
- 대용량 파일도 클라이언트 → S3 직접 스트리밍

---

## 2. S3 버킷 구조

### 버킷 종류

| 버킷 | 접근 | 용도 |
|------|------|------|
| `gwanriwang-public` | CloudFront 공개 | 프로필 이미지, 회사 로고 |
| `gwanriwang-private` | 서버만 접근 | 업무 첨부파일, 메시지 파일, 보고서 첨부 |
| `gwanriwang-exports` | 서버만 접근 | Admin export 파일 (7일 TTL) |

### CloudFront 배포

```
공개 버킷 → CloudFront 배포
  도메인: cdn.gwanriwang.com
  캐시 TTL: 프로필 이미지 7일 / 로고 30일

비공개 버킷 → CloudFront 없음 (Presigned URL만 사용)
```

---

## 3. 파일 경로 규칙

```
{버킷}/{companyId}/{feature}/{YYYY}/{MM}/{uuid}.{ext}
```

### 기능별 경로

| 기능 | 경로 예시 | 버킷 |
|------|---------|------|
| 프로필 이미지 | `{cid}/profiles/{yyyy}/{mm}/{uuid}.webp` | public |
| 회사 로고 | `{cid}/logo/{uuid}.webp` | public |
| 업무 첨부파일 | `{cid}/tasks/{yyyy}/{mm}/{uuid}.{ext}` | private |
| 메시지 첨부파일 | `{cid}/messages/{yyyy}/{mm}/{uuid}.{ext}` | private |
| 보고서 첨부파일 | `{cid}/reports/{yyyy}/{mm}/{uuid}.{ext}` | private |
| 계약서 (Admin) | `contracts/{uuid}.pdf` | private |
| Admin export | `exports/{adminId}/{uuid}.xlsx` | exports |

### 경로 생성 로직

```typescript
function generateFileKey(
  companyId: string,
  feature: 'profiles' | 'logo' | 'tasks' | 'messages' | 'reports',
  originalExt: string,
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = randomUUID();
  return `${companyId}/${feature}/${yyyy}/${mm}/${uuid}.${originalExt}`;
}
```

---

## 4. Presigned URL 업로드 플로우

### 4-1. 업로드 URL 요청

```
POST /files/upload-url
Authorization: Bearer <access_token>
```

**Request**
```json
{
  "feature": "tasks",              // profiles | logo | tasks | messages | reports
  "fileName": "보고서.pdf",
  "contentType": "application/pdf",
  "fileSizeBytes": 2048000         // 클라이언트가 미리 전달 (서버 검증용)
}
```

**서버 처리**
```
1. 파일 크기 검증 (feature별 최대 크기 확인)
2. contentType 화이트리스트 검증
3. 회사 저장 용량 한도 확인 (현재 사용량 + 신규 파일 크기 < 플랜 한도)
4. fileKey 생성 (경로 규칙 적용)
5. S3 Presigned PUT URL 생성 (유효기간 10분)
6. files 테이블에 status='pending' 레코드 생성 (임시)
```

**Response**
```json
{
  "success": true,
  "data": {
    "fileId": "uuid",                          // 확정 시 사용
    "uploadUrl": "https://s3.amazonaws.com/..?X-Amz-Signature=...",
    "fileKey": "company-uuid/tasks/2026/03/file-uuid.pdf",
    "expiresAt": "2026-03-11T10:40:00Z"       // 10분 후
  }
}
```

---

### 4-2. 클라이언트 S3 직접 업로드

```typescript
// 클라이언트 (Web/Mobile 공통)
async function uploadFile(file: File, uploadUrl: string): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });
  // S3는 성공 시 200 반환, 본문 없음
}
```

---

### 4-3. 업로드 완료 확정

```
POST /files/confirm
Authorization: Bearer <access_token>
```

**Request**
```json
{
  "fileId": "uuid",
  "refType": "task",      // 어디에 첨부할지 (task | message | report)
  "refId": "uuid"         // 대상 리소스 ID
}
```

**서버 처리**
```
1. S3 HeadObject로 파일 실제 존재 확인 (업로드 완료 여부)
2. files 테이블 status = 'confirmed' 업데이트
3. 실제 파일 크기 기록 (S3 HeadObject ContentLength)
4. 회사 사용 용량 업데이트 (service_usage 또는 별도 집계)
5. 프로필/로고 이미지인 경우 → Lambda 트리거로 리사이징 (비동기)
```

**Response**
```json
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "url": "https://cdn.gwanriwang.com/company-uuid/tasks/2026/03/file-uuid.pdf",
    "fileName": "보고서.pdf",
    "fileSizeBytes": 2048000,
    "contentType": "application/pdf"
  }
}
```

---

### 4-4. 비공개 파일 다운로드

```
GET /files/:id/download
Authorization: Bearer <access_token>
```

**서버 처리**
```
1. files 테이블에서 파일 조회
2. 접근 권한 확인 (company_id 일치 + refType별 권한 체크)
3. S3 Presigned GET URL 생성 (유효기간 5분)
4. 302 Redirect 또는 URL 반환
```

**Response**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/gwanriwang-private/...?X-Amz-Expires=300...",
    "expiresAt": "2026-03-11T10:35:00Z"
  }
}
```

---

## 5. 파일 유형별 정책

### 5-1. 허용 파일 유형 화이트리스트

| 카테고리 | MIME 유형 | 확장자 | 최대 크기 |
|---------|---------|--------|---------|
| 이미지 | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | jpg, jpeg, png, webp, gif | 10MB |
| 문서 | `application/pdf` | pdf | 50MB |
| Office | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | xls, xlsx | 50MB |
| Office | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | doc, docx | 50MB |
| Office | `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` | ppt, pptx | 50MB |
| 압축 | `application/zip`, `application/x-zip-compressed` | zip | 100MB |
| 텍스트 | `text/plain`, `text/csv` | txt, csv | 10MB |

**거부 목적 파일 (보안)**
- 실행 파일: `.exe`, `.bat`, `.sh`, `.ps1`, `.cmd`
- 스크립트: `.js` (독립 파일), `.php`, `.py`
- 시스템: `.dll`, `.so`

---

### 5-2. 기능별 허용 파일 유형

| feature | 허용 카테고리 |
|---------|------------|
| `profiles` | 이미지만 |
| `logo` | 이미지만 |
| `tasks` | 이미지 + 문서 + Office + 압축 + 텍스트 |
| `messages` | 이미지 + 문서 + Office + 압축 |
| `reports` | 이미지 + 문서 + Office + 텍스트 |

---

## 6. 플랜별 저장 용량 제한

| 플랜 | 저장 용량 | 단일 파일 최대 |
|------|---------|-------------|
| Free | 1 GB | 10 MB |
| Basic | 10 GB | 50 MB |
| Pro | 50 GB | 100 MB |
| Enterprise | 계약별 | 100 MB |

### 용량 확인 로직

```typescript
async function checkStorageQuota(
  companyId: string,
  newFileSizeBytes: number,
): Promise<void> {
  const [usedBytes, limitGb] = await Promise.all([
    this.filesRepo.sumConfirmedSizeByCompany(companyId),
    this.featureService.getLimit(companyId, 'storage_gb'),
  ]);

  const limitBytes = limitGb * 1024 * 1024 * 1024;
  if (usedBytes + newFileSizeBytes > limitBytes) {
    throw new ForbiddenException({
      code: 'STORAGE_QUOTA_EXCEEDED',
      message: `저장 용량이 부족합니다. (사용: ${toGB(usedBytes)}GB / 한도: ${limitGb}GB)`,
    });
  }
}
```

---

## 7. 이미지 처리

### 7-1. 리사이징 전략 (AWS Lambda)

프로필 이미지와 로고만 리사이징 적용. 다른 파일은 원본 그대로 저장.

```
업로드 완료 확정
    ↓
Lambda 트리거 (S3 이벤트 또는 SQS)
    ↓
원본 이미지 리사이징 → 크기별 변형 저장

저장 경로:
  원본:    company-uuid/profiles/2026/03/img-uuid.webp        (원본 유지)
  썸네일:  company-uuid/profiles/2026/03/img-uuid_thumb.webp  (100x100)
  중간:    company-uuid/profiles/2026/03/img-uuid_md.webp     (400x400)
```

### 7-2. 리사이징 스펙

| 용도 | 크기 | 포맷 | 품질 |
|------|------|------|------|
| 프로필 썸네일 (목록) | 100×100 (crop center) | WebP | 80% |
| 프로필 중간 (상세) | 400×400 (crop center) | WebP | 85% |
| 회사 로고 | 200×200 (contain) | WebP | 90% |

### 7-3. 업로드 전 클라이언트 검증

```typescript
// 클라이언트에서 업로드 전 간단 검증 (서버 검증이 최종 기준)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

function validateImageFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'JPG, PNG, WebP 파일만 업로드 가능합니다.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return '파일 크기는 10MB 이하여야 합니다.';
  }
  return null; // 유효
}
```

---

## 8. 파일 삭제 정책

### 8-1. Soft Delete (즉시)

파일 삭제 요청 시 즉시 S3에서 삭제하지 않고 DB만 삭제 표시.

```
files.deleted_at = now()  (Soft Delete)
→ 접근 불가 처리 (다운로드 API에서 deleted_at 체크)
→ 실제 S3 삭제는 야간 배치에서 처리
```

### 8-2. S3 실제 삭제 배치 (매일 03:00 KST)

```typescript
// 삭제 대상: deleted_at이 24시간 초과한 파일
const pendingDeletes = await filesRepo.find({
  where: {
    deletedAt: LessThan(subHours(new Date(), 24)),
    s3Deleted: false,
  },
  take: 1000,
});

// S3 삭제 (최대 1000개씩 배치)
await s3.deleteObjects({
  Bucket: file.bucket,
  Delete: { Objects: pendingDeletes.map(f => ({ Key: f.fileKey })) },
});
```

### 8-3. 연쇄 삭제 규칙

| 상위 리소스 삭제 | 첨부파일 처리 |
|----------------|-------------|
| 메시지 삭제 (Soft) | 첨부파일 Soft Delete |
| 업무 삭제 (Soft) | 첨부파일 유지 (업무 복구 시 함께 복구) |
| 회사 해지 (90일 후 데이터 삭제) | 전체 파일 S3 삭제 |
| 직원 퇴사 (Soft Delete) | 파일 유지 (회사 데이터이므로) |

### 8-4. S3 Lifecycle Policy

```json
[
  {
    "ID": "delete-pending-files",
    "Filter": { "Prefix": "" },
    "Status": "Enabled",
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  },
  {
    "ID": "expire-exports",
    "Filter": { "Prefix": "exports/" },
    "Status": "Enabled",
    "Expiration": { "Days": 7 }
  }
]
```

---

## 9. 보안 설정

### 9-1. S3 버킷 정책

```json
// private 버킷 — 퍼블릭 접근 완전 차단, 서버 IAM Role만 허용
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::gwanriwang-private/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::ACCOUNT_ID:role/ecs-task-role"
        }
      }
    }
  ]
}
```

### 9-2. Presigned URL 보안 설정

```typescript
const presignedPutUrl = await getSignedUrl(
  s3Client,
  new PutObjectCommand({
    Bucket: 'gwanriwang-private',
    Key: fileKey,
    ContentType: contentType,   // 지정한 ContentType만 허용
    ContentLength: fileSizeBytes, // 크기 제한 강제
    Metadata: {
      'company-id': companyId,
      'uploaded-by': userId,
    },
  }),
  { expiresIn: 600 } // 10분
);
```

### 9-3. CORS 설정 (S3 버킷)

```json
[
  {
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "https://app.gwanriwang.com",
      "https://staging.gwanriwang.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 10. DB 테이블 설계

### files

```sql
CREATE TABLE files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  uploaded_by     UUID NOT NULL REFERENCES users(id),

  -- 파일 정보
  original_name   VARCHAR(500) NOT NULL,   -- 원본 파일명 (브라우저 표시용)
  file_key        TEXT NOT NULL UNIQUE,    -- S3 Key
  bucket          VARCHAR(100) NOT NULL,   -- 버킷 이름
  content_type    VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT,                  -- confirm 후 실제 크기 기록
  feature         VARCHAR(30) NOT NULL,    -- profiles|logo|tasks|messages|reports

  -- 상태
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending(Presigned URL 발급) | confirmed(업로드 완료) | deleted
  s3_deleted      BOOLEAN NOT NULL DEFAULT false,  -- S3 실제 삭제 여부

  -- 연관 리소스 (confirm 시 연결)
  ref_type        VARCHAR(20),   -- task | message | report | user | company
  ref_id          UUID,

  -- 이미지 파생 파일 키
  thumb_key       TEXT,    -- 썸네일 (이미지 전용)
  medium_key      TEXT,    -- 중간 크기 (이미지 전용)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,

  INDEX idx_files_company_feature (company_id, feature) WHERE deleted_at IS NULL,
  INDEX idx_files_ref (ref_type, ref_id) WHERE deleted_at IS NULL,
  INDEX idx_files_pending_delete (deleted_at) WHERE s3_deleted = false AND deleted_at IS NOT NULL
);
```

---

## 11. REST API

```
POST   /files/upload-url          Presigned PUT URL 발급
POST   /files/confirm             업로드 완료 확정
GET    /files/:id/download        비공개 파일 다운로드 URL 발급
DELETE /files/:id                 파일 삭제 (Soft Delete)
GET    /files/usage               저장 용량 사용 현황
```

### GET /files/usage Response

```json
{
  "success": true,
  "data": {
    "usedBytes": 536870912,
    "usedGb": 0.5,
    "limitGb": 10,
    "usagePercent": 5,
    "breakdown": {
      "tasks":    { "bytes": 322122547, "count": 48 },
      "messages": { "bytes": 107374182, "count": 210 },
      "reports":  { "bytes": 107374183, "count": 35 },
      "profiles": { "bytes": 0, "count": 12 }
    }
  }
}
```

---

## 12. NestJS 구현 구조

```
src/modules/files/
├── files.module.ts
├── files.controller.ts
├── files.service.ts
├── files.entity.ts
├── dto/
│   ├── upload-url.dto.ts
│   └── confirm-upload.dto.ts
├── s3.service.ts              # AWS S3 SDK 래핑
├── file-validator.service.ts  # 타입/크기/용량 검증
└── schedulers/
    └── s3-cleanup.scheduler.ts  # 야간 S3 실제 삭제 배치
```

### s3.service.ts 핵심 메서드

```typescript
@Injectable()
export class S3Service {
  // Presigned PUT URL 생성
  async createPresignedPutUrl(bucket, key, contentType, fileSizeBytes, expiresIn = 600): Promise<string>

  // Presigned GET URL 생성 (비공개 파일 다운로드)
  async createPresignedGetUrl(bucket, key, fileName, expiresIn = 300): Promise<string>

  // 파일 존재 확인 (HeadObject)
  async checkFileExists(bucket, key): Promise<{ exists: boolean; size: number }>

  // 파일 삭제
  async deleteFile(bucket, key): Promise<void>

  // 다수 파일 배치 삭제 (최대 1000개)
  async deleteFiles(files: { bucket: string; key: string }[]): Promise<void>
}
```

### 패키지

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
