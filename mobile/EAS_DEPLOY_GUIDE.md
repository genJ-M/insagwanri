# EAS Build 배포 가이드

## 1. 사전 준비 (1회)

```bash
# EAS CLI 전역 설치
npm install -g eas-cli

# Expo 계정 로그인
eas login

# 프로젝트 초기화 (EAS Project ID 자동 발급)
cd mobile
eas init
```

`eas init` 후 `app.json`의 `YOUR_EAS_PROJECT_ID` 두 곳을 실제 ID로 교체:
- `extra.eas.projectId`
- `updates.url`

`app.json`의 `owner` 필드도 Expo 계정 슬러그로 교체.

---

## 2. 앱 에셋 준비 (MANUAL)

`assets/README.md` 참조. 아이콘/스플래시 이미지 4종 추가 필요.

---

## 3. 빌드

### Preview APK (Android 내부 테스트용)
```bash
eas build --platform android --profile preview
```

### Production (앱스토어 제출용)
```bash
# Android AAB
eas build --platform android --profile production

# iOS IPA
eas build --platform ios --profile production
```

---

## 4. 앱스토어 제출

### Android (Google Play)
1. `eas.json`의 `submit.production.android.serviceAccountKeyPath` 설정
2. Google Play Console에서 서비스 계정 키 발급 → `google-service-account.json` 저장
3. `eas submit --platform android --profile production`

### iOS (App Store)
1. `eas.json`의 `submit.production.ios` 항목 설정
   - `appleId`: 개발자 계정 이메일
   - `ascAppId`: App Store Connect 앱 ID
   - `appleTeamId`: 애플 팀 ID
2. `eas submit --platform ios --profile production`

---

## 5. OTA 업데이트 (코드 변경 시 앱 재빌드 없이 배포)

```bash
eas update --branch production --message "버그 수정"
```

> JS/TS 코드 변경만 가능. 네이티브 모듈 변경 시 재빌드 필요.

---

## 환경변수 요약

| 변수 | 값 |
|------|----|
| `EXPO_PUBLIC_API_URL` | `https://insagwanri-backend.onrender.com/api/v1` |

`eas.json`의 `preview`/`production` 프로필에 이미 설정되어 있음.
