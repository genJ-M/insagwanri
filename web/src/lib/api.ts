import axios, { AxiosInstance, AxiosError } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, // Render 무료 플랜 cold start 대응 (최대 ~60초)
});

// ── 요청 인터셉터: JWT 자동 주입 ──────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 응답 인터셉터: 401 시 토큰 재발급 ──────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: AxiosError | null, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const newToken = data.data.access_token;
        localStorage.setItem('access_token', newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 네트워크 단절 / 타임아웃 (error.response 없음)
    if (!error.response) {
      const msg =
        error.code === 'ECONNABORTED'
          ? '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.' // timeout
          : '네트워크 연결을 확인해주세요.'; // 실제 네트워크 단절
      toast.error(msg, { id: 'network-error' });
      return Promise.reject(error);
    }

    // 5xx 서버 오류 (개별 컴포넌트가 처리하지 못하는 경우 대비)
    if (error.response.status >= 500) {
      toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', {
        id: 'server-error',
      });
    }

    return Promise.reject(error);
  },
);

export default api;
