import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotifications();

    // 포그라운드 알림 수신
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // 필요 시 상태 업데이트 (예: 배지 카운트 증가)
    });

    // 알림 탭 → 화면 이동
    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      // 딥링크 처리 (추후 확장)
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

async function registerForPushNotifications() {
  if (!Device.isDevice) return; // 에뮬레이터 스킵

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '관리왕 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  // 서버에 디바이스 토큰 등록
  try {
    await api.post('/notifications/device-tokens', {
      token: token.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch {
    // 토큰 등록 실패는 조용히 무시 (알림 기능만 비활성)
  }
}
