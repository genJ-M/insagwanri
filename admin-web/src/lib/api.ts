import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '/admin/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
