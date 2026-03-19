# GPS 출퇴근 검증 정책 설계 명세

> B2B SaaS 직원 관리 플랫폼 — GPS 출퇴근 시스템
> 작성일: 2026-03-11
> 정책 결정: 반경 외 출퇴근 → 기록은 허용, 플래그 처리 + 관리자 알림

---

## 목차

1. [정책 결정 및 근거](#1-정책-결정-및-근거)
2. [DB 테이블 변경](#2-db-테이블-변경)
3. [GPS 검증 로직](#3-gps-검증-로직)
4. [출퇴근 처리 플로우](#4-출퇴근-처리-플로우)
5. [GPS 미지원 환경 처리](#5-gps-미지원-환경-처리)
6. [다중 근무지 지원](#6-다중-근무지-지원)
7. [관리자 설정 API](#7-관리자-설정-api)
8. [REST API 전체 명세](#8-rest-api-전체-명세)
9. [클라이언트 구현 가이드](#9-클라이언트-구현-가이드)
10. [엣지케이스 처리](#10-엣지케이스-처리)

---

## 1. 정책 결정 및 근거

### 채택 정책: **기록 허용 + 플래그 + 관리자 알림**

```
GPS 반경 내 출퇴근  →  정상 처리
GPS 반경 외 출퇴근  →  기록 허용, is_out_of_range = true 플래그 설정
                         + 관리자에게 인앱 알림 (설정에 따라)
GPS 신호 없음       →  기록 허용, gps_accuracy = null, 플래그 없음
                         (관리자가 이후 수동 수정 가능)
```

### 완전 거부 방식을 채택하지 않은 이유

| 상황 | 완전 거부 시 문제 |
|------|----------------|
| 지하 매장, 건물 내부 | GPS 신호 약해서 정확도 낮음 → 정상 직원도 출근 불가 |
| 외근/현장 출장 | 특정 날은 다른 장소에서 근무 → 출근 처리 불가 |
| 재택근무 병행 | 집에서 출근 처리 → 반경 외 → 거부 발생 |
| GPS 오차 (50~100m) | 사무실 바로 앞인데도 반경 밖으로 판정 가능 |

**관리자가 컨텍스트를 알고 판단**하는 것이 시스템이 자동 거부하는 것보다 중소사업장 현실에 적합합니다.

---

## 2. DB 테이블 변경

### 2-1. companies 테이블 추가 컬럼

```sql
-- GPS 출퇴근 설정
ALTER TABLE companies ADD COLUMN gps_enabled        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN gps_lat            DECIMAL(10, 7);  -- 위도 (예: 37.5665000)
ALTER TABLE companies ADD COLUMN gps_lng            DECIMAL(10, 7);  -- 경도 (예: 126.9780000)
ALTER TABLE companies ADD COLUMN gps_radius_m       SMALLINT DEFAULT 100;  -- 허용 반경 (미터, 기본 100m)
ALTER TABLE companies ADD COLUMN gps_strict_mode    BOOLEAN NOT NULL DEFAULT false;
-- strict_mode = true: 반경 외 출퇴근 시 관리자 즉시 알림 (기본 false: 알림 없음, 대시보드에서만 표시)
```

**gps_radius_m 권장 기준**
| 환경 | 권장 반경 |
|------|---------|
| 도심 오피스 | 100m |
| 공장/물류센터 | 200~300m |
| 상가/매장 | 50m |
| 넓은 부지 | 최대 500m |

---

### 2-2. attendance_records 테이블 추가 컬럼

```sql
-- 출근 GPS
ALTER TABLE attendance_records ADD COLUMN clock_in_accuracy_m   DECIMAL(7, 2);  -- GPS 정확도 (미터)
ALTER TABLE attendance_records ADD COLUMN clock_in_distance_m   DECIMAL(8, 2);  -- 회사까지 직선거리
ALTER TABLE attendance_records ADD COLUMN clock_in_out_of_range BOOLEAN NOT NULL DEFAULT false;

-- 퇴근 GPS
ALTER TABLE attendance_records ADD COLUMN clock_out_accuracy_m  DECIMAL(7, 2);
ALTER TABLE attendance_records ADD COLUMN clock_out_distance_m  DECIMAL(8, 2);
ALTER TABLE attendance_records ADD COLUMN clock_out_out_of_range BOOLEAN NOT NULL DEFAULT false;

-- GPS 비활성화 상태에서 처리된 경우
ALTER TABLE attendance_records ADD COLUMN gps_bypassed          BOOLEAN NOT NULL DEFAULT false;
-- GPS가 비활성화된 회사이거나, 사용자가 GPS 권한을 거부한 경우
```

---

### 2-3. work_locations (다중 근무지 지원)

단일 회사 위치만으로 부족한 경우(지점, 외근 허용 구역 등)를 위한 확장 테이블.
**Phase 1에서는 구현하지 않고, companies 테이블의 단일 위치만 사용.**

```sql
-- Phase 2 이후 구현 예정
CREATE TABLE work_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  name        VARCHAR(100) NOT NULL,   -- "본점", "2공장", "서울지점"
  lat         DECIMAL(10, 7) NOT NULL,
  lng         DECIMAL(10, 7) NOT NULL,
  radius_m    SMALLINT NOT NULL DEFAULT 100,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

---

## 3. GPS 검증 로직

### 3-1. Haversine 공식 (서버 사이드)

지구 곡률을 고려한 두 좌표 간 직선거리 계산.

```typescript
// src/modules/attendance/utils/haversine.ts

const EARTH_RADIUS_M = 6371000; // 지구 반지름 (미터)

export function calculateDistanceMeters(
  lat1: number, lng1: number,  // 사용자 위치
  lat2: number, lng2: number,  // 회사 위치
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c; // 미터 반환
}

export function isWithinRadius(
  userLat: number, userLng: number,
  companyLat: number, companyLng: number,
  radiusM: number,
): { withinRadius: boolean; distanceM: number } {
  const distanceM = calculateDistanceMeters(userLat, userLng, companyLat, companyLng);
  return { withinRadius: distanceM <= radiusM, distanceM };
}
```

---

### 3-2. GPS 정확도(accuracy) 처리

모바일 GPS는 정확도(accuracy)를 함께 반환합니다.
accuracy = 68% 확률로 실제 위치가 이 반경 내에 있음을 의미.

```typescript
export function validateGpsAccuracy(
  distanceM: number,
  accuracyM: number | null,
  radiusM: number,
): {
  withinRadius: boolean;
  isAccuracyPoor: boolean;
  effectiveDistanceM: number;
} {
  // 정확도가 없으면 거리 그대로 사용
  if (accuracyM === null) {
    return {
      withinRadius: distanceM <= radiusM,
      isAccuracyPoor: false,
      effectiveDistanceM: distanceM,
    };
  }

  // GPS 정확도가 너무 낮으면 (200m 이상) 경고 플래그
  const isAccuracyPoor = accuracyM > 200;

  // 보정: 정확도 절반을 거리에서 차감 (유리한 방향으로 보정)
  // 사용자가 반경 경계 근처에 있고 GPS 오차가 있을 수 있으므로
  const effectiveDistanceM = Math.max(0, distanceM - accuracyM * 0.5);

  return {
    withinRadius: effectiveDistanceM <= radiusM,
    isAccuracyPoor,
    effectiveDistanceM,
  };
}
```

---

## 4. 출퇴근 처리 플로우

### 4-1. 출근 처리 (Clock-In)

```
POST /attendance/clock-in
Authorization: Bearer <access_token>
```

**Request**
```json
{
  "lat": 37.5665123,
  "lng": 126.9780456,
  "accuracyM": 15.5,        // GPS 정확도 (미터), 없으면 null
  "workDate": "2026-03-11"  // 클라이언트 로컬 날짜 (선택, 없으면 서버 KST 기준)
}
```

**서버 처리 순서**

```
1. 당일 이미 출근 기록 있는지 확인 (중복 방지)
   UNIQUE(user_id, work_date) — 이미 있으면 409 Conflict

2. GPS 활성화 여부 확인 (company.gps_enabled)
   gps_enabled = false → GPS 검증 없이 기록 (gps_bypassed = true)

3. gps_enabled = true인 경우:
   a. 회사 위치 등록 여부 확인 (gps_lat, gps_lng 존재)
      → 미등록이면 GPS 검증 없이 기록 (gps_bypassed = true, 관리자 경고 로그)
   b. Haversine으로 거리 계산
   c. GPS 정확도 보정 적용
   d. 결과에 따라:
      - 반경 내: is_out_of_range = false
      - 반경 외: is_out_of_range = true
        → gps_strict_mode = true이면 관리자 알림 큐 추가

4. 지각 판정
   work_date 기준 출근 시간(user.custom_work_start or company.work_start_time) + 지각 허용 시간(late_threshold_min) 비교

5. attendance_records 저장
6. 성공 응답
```

**Response (정상)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clockInAt": "2026-03-11T09:05:00Z",
    "status": "late",
    "isLate": true,
    "lateMinutes": 5,
    "gps": {
      "distanceM": 45.2,
      "withinRadius": true,
      "isOutOfRange": false,
      "accuracyM": 15.5
    }
  }
}
```

**Response (반경 외)**
```json
{
  "success": true,              // 기록은 됨 (거부 아님)
  "data": {
    "id": "uuid",
    "clockInAt": "2026-03-11T09:03:00Z",
    "status": "normal",
    "isLate": false,
    "gps": {
      "distanceM": 234.7,
      "withinRadius": false,
      "isOutOfRange": true,       // 반경 외 플래그
      "accuracyM": 20.1,
      "companyRadiusM": 100
    },
    "warning": "등록된 근무지에서 234m 거리에서 출근 처리되었습니다. 관리자에게 문의하세요."
  }
}
```

---

### 4-2. 퇴근 처리 (Clock-Out)

```
POST /attendance/clock-out
Authorization: Bearer <access_token>
```

**Request**
```json
{
  "lat": 37.5665123,
  "lng": 126.9780456,
  "accuracyM": 18.3
}
```

**서버 처리 순서**
```
1. 당일 출근 기록 확인 (없으면 400 — 출근 없이 퇴근 불가)
2. 이미 퇴근 기록 있는지 확인 (중복 퇴근 방지)
3. GPS 검증 (clock-in과 동일 로직)
4. 근무 시간 계산: total_work_minutes = (clock_out_at - clock_in_at).minutes
5. 조기 퇴근 판정 (work_end_time보다 일찍 퇴근)
6. 레코드 업데이트
```

---

### 4-3. 관리자 수동 수정

반경 외 출퇴근, GPS 없는 기록 등을 관리자가 사후 승인/수정.

```
PATCH /attendance/:id
Authorization: Bearer <access_token> (owner, manager만)
```

**Request**
```json
{
  "clockInAt": "2026-03-11T09:00:00Z",   // 시각 수정
  "clockOutAt": "2026-03-11T18:00:00Z",
  "status": "normal",                     // 상태 강제 변경
  "note": "외근으로 인해 현장 출근 확인"
}
```

**서버 처리**
```
1. 수정 후 is_late, late_minutes, total_work_minutes 자동 재계산
2. 수정 전/후 감사 로그 기록 (approved_by = 수정한 관리자 ID)
```

---

## 5. GPS 미지원 환경 처리

### 5-1. GPS 권한 거부 (모바일)

```
클라이언트: GPS 권한 없음 감지
    ↓
POST /attendance/clock-in (lat, lng, accuracyM 모두 null로 전송)

서버 처리:
  gps_enabled = true이지만 좌표 없음
  → 기록 허용 (gps_bypassed = true)
  → 관리자에게 "GPS 권한 없이 출근 처리" 알림
```

**Request (GPS 없음)**
```json
{
  "lat": null,
  "lng": null,
  "accuracyM": null
}
```

### 5-2. GPS 정확도 불량 (200m 이상)

```
기록은 허용하되 is_accuracy_poor 플래그 = true
관리자 대시보드에서 "GPS 정확도 불량" 배지 표시
```

### 5-3. 비GPS 모드 (회사 설정)

```
company.gps_enabled = false
→ 모든 직원 GPS 검증 없이 출퇴근 가능
→ 시간 기반 근태만 관리
```

---

## 6. 다중 근무지 지원

**Phase 1**: companies 테이블의 단일 위치만 사용.

**Phase 2 확장 시 로직**:
```
출퇴근 시 모든 활성 work_locations와 거리 계산
→ 가장 가까운 위치 선택
→ 해당 위치의 radius_m 기준으로 반경 내/외 판정
→ attendance_records에 work_location_id 저장
```

---

## 7. 관리자 설정 API

### 7-1. 회사 GPS 위치 설정

```
PATCH /workspace/gps-settings
Authorization: Bearer <access_token> (owner만)
```

**Request**
```json
{
  "gpsEnabled": true,
  "lat": 37.5665123,
  "lng": 126.9780456,
  "radiusM": 100,
  "strictMode": false      // true: 반경 외 즉시 알림 / false: 대시보드에만 표시
}
```

**위치 등록 UX 설계**
- 웹 지도(Kakao Maps API 또는 Google Maps)에서 사무실 핀 클릭으로 좌표 입력
- 반경 원형 시각화로 허용 범위 미리보기
- 반경 슬라이더 (50m ~ 500m, 기본 100m)

---

### 7-2. 반경 외 출퇴근 목록 조회

```
GET /attendance?outOfRange=true&date=2026-03-11
Authorization: Bearer <access_token> (owner, manager만)
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "name": "김철수", "department": "영업팀" },
      "workDate": "2026-03-11",
      "clockInAt": "2026-03-11T09:03:00Z",
      "clockInDistanceM": 234.7,
      "clockInOutOfRange": true,
      "status": "normal",
      "note": null
    }
  ]
}
```

---

## 8. REST API 전체 명세

```
# 출퇴근
POST   /attendance/clock-in              출근 처리
POST   /attendance/clock-out             퇴근 처리

# 조회
GET    /attendance                       근태 목록 (owner, manager)
                                         ?date=&userId=&status=&outOfRange=&startDate=&endDate=
GET    /attendance/me                    내 근태 조회
GET    /attendance/today                 오늘 출퇴근 현황 (owner, manager — 대시보드용)
GET    /attendance/report                월별 근태 리포트 ?year=&month=
GET    /attendance/:id                   근태 상세

# 수정 (관리자)
PATCH  /attendance/:id                   근태 수동 수정

# GPS 설정 (owner)
PATCH  /workspace/gps-settings           GPS 위치 및 반경 설정
GET    /workspace/gps-settings           현재 GPS 설정 조회
```

---

## 9. 클라이언트 구현 가이드

### 9-1. React Native GPS 위치 획득

```typescript
// hooks/useLocation.ts
import * as Location from 'expo-location';

export async function getCurrentLocation(): Promise<{
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
}> {
  // 권한 확인
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { lat: null, lng: null, accuracyM: null }; // GPS 권한 없음
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // 배터리/정확도 균형
      timeInterval: 5000,                   // 5초 타임아웃
      mayShowUserSettingsDialog: true,      // GPS 꺼진 경우 설정 열기 안내
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracyM: location.coords.accuracy,
    };
  } catch {
    return { lat: null, lng: null, accuracyM: null }; // GPS 신호 없음
  }
}
```

### 9-2. 출근 버튼 클릭 → API 호출 흐름

```typescript
async function handleClockIn() {
  setLoading(true);

  // 1. GPS 위치 획득 (최대 10초 대기)
  const { lat, lng, accuracyM } = await getCurrentLocation();

  // 2. 정확도 낮음 경고 (UX)
  if (accuracyM !== null && accuracyM > 100) {
    const confirmed = await showConfirm(
      `GPS 정확도가 낮습니다 (${Math.round(accuracyM)}m 오차). 그래도 출근하시겠습니까?`
    );
    if (!confirmed) { setLoading(false); return; }
  }

  // 3. API 호출
  const result = await api.post('/attendance/clock-in', { lat, lng, accuracyM });

  // 4. 결과 처리
  if (result.data.gps?.isOutOfRange) {
    showWarning(result.data.warning); // 반경 외 경고 토스트
  } else {
    showSuccess('출근이 처리되었습니다.');
  }

  setLoading(false);
}
```

---

## 10. 엣지케이스 처리

| 상황 | 처리 방법 |
|------|---------|
| 자정 넘어서 퇴근 (야간 근무) | `work_date`는 출근 시의 날짜로 고정, `clock_out_at`은 다음날 TIMESTAMPTZ로 저장 |
| 출근 없이 퇴근 시도 | `400 Bad Request: NO_CLOCK_IN_RECORD` |
| 이미 퇴근 후 재퇴근 시도 | `409 Conflict: ALREADY_CLOCKED_OUT` |
| 이미 출근 후 재출근 시도 | `409 Conflict: ALREADY_CLOCKED_IN` |
| 비근무일 (토/일) 출근 | 기록 허용, `status = 'special'` (관리자 확인용) |
| GPS 좌표 범위 벗어남 (위도 ±90 초과 등) | 서버에서 유효성 검증 후 `400 Bad Request` |
| 회사 위치 미등록 상태에서 gps_enabled = true | 경고 로그 + GPS 없이 기록 처리 (관리자 대시보드에 "위치 미등록" 경고 배너) |
| Expo Location 타임아웃 | null 좌표로 서버에 전송, gps_bypassed = true 처리 |

### 야간 근무 total_work_minutes 계산

```typescript
// clock_in: 2026-03-11T22:00:00Z
// clock_out: 2026-03-12T06:00:00Z
// total_work_minutes = 480 (8시간) ← 날짜가 달라도 정상 계산
const totalMinutes = differenceInMinutes(clockOutAt, clockInAt);
// work_date는 출근 시각의 KST 날짜로 고정
```
