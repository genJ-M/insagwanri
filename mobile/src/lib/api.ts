import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// 순환 의존성 없이 로그아웃 이벤트를 전달하기 위한 콜백 등록
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// 요청 인터셉터 — AccessToken 주입
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 — 401 시 RefreshToken으로 재발급
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;

        await SecureStore.setItemAsync('accessToken', newAccess);
        await SecureStore.setItemAsync('refreshToken', newRefresh);

        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        onSessionExpired?.(); // Zustand store 상태 초기화 (_layout에서 등록)
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
