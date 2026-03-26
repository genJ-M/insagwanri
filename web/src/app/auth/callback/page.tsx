'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

/**
 * /auth/callback
 * 소셜 OAuth 완료 후 백엔드가 리다이렉트하는 페이지.
 * URL 파라미터: access_token, refresh_token
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const accessToken = searchParams?.get('access_token');
    const refreshToken = searchParams?.get('refresh_token');

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    // 임시로 토큰 저장 후 /auth/me 호출해서 유저 정보 획득
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);

    api
      .get('/auth/me')
      .then((res) => {
        const user = res.data.data;
        setUser(user, { access_token: accessToken, refresh_token: refreshToken });
        router.replace('/');
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.replace('/login?error=oauth_failed');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">로그인 처리 중...</p>
      </div>
    </div>
  );
}
