'use client';
import { Suspense } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

// SocialStrategy 패턴으로 설계 — Kakao/Naver 추가 시 버튼만 추가하면 됨
function SocialButtons() {
  return (
    <div className="space-y-3">
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="mx-3 text-xs text-gray-400 whitespace-nowrap">또는 소셜 계정으로 로그인</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
      <a
        href={`${API_URL}/auth/google`}
        className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Google로 로그인
      </a>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams?.get('error');
  const setUser = useAuthStore((s) => s.setUser);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post('/auth/login', credentials);
      return data.data;
    },
    onSuccess: (data) => {
      setUser(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      router.replace('/');
    },
    onError: (err: any) => {
      const message: string = err.response?.data?.error?.message ?? '로그인에 실패했습니다.';
      const status = err.response?.status;
      if (status === 429 || message.includes('잠금') || message.includes('잠겨') || message.includes('locked')) {
        setIsLocked(true);
        setError('');
      } else {
        setIsLocked(false);
        setError(message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLocked(false);
    if (!form.email || !form.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">관</span>
        </div>
        <span className="text-xl font-bold text-text-primary">관리왕</span>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-border shadow-card p-8">
        <h1 className="text-[22px] font-bold text-text-primary mb-1">로그인</h1>
        <p className="text-sm text-text-muted mb-7">관리왕에 오신 것을 환영합니다</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              아이디 (이메일)
            </label>
            <input
              type="email"
              placeholder="이메일을 입력해주세요"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              비밀번호
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호를 입력해주세요"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-primary-500 hover:text-primary-600 font-medium">
              비밀번호를 잊으셨나요?
            </Link>
          </div>

          {isLocked && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <p className="font-semibold">계정이 일시적으로 잠겼습니다.</p>
              <p className="text-xs mt-0.5 text-red-500">5회 초과 — 15분 후 다시 시도해주세요.</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>
          )}

          <Button
            type="submit"
            loading={loginMutation.isPending}
            className="w-full justify-center py-3 text-[15px] rounded-xl mt-1"
          >
            로그인
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>

        {oauthError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl mt-4 text-center">
            소셜 로그인에 실패했습니다. 다시 시도해 주세요.
          </p>
        )}
      </div>

      <p className="text-sm text-text-muted mt-6">
        관리왕 계정이 없으신가요?{' '}
        <Link href="/register" className="text-primary-500 font-semibold hover:text-primary-600">
          무료회원가입
        </Link>
      </p>

      <p className="text-xs text-text-muted mt-8">© 2026 관리왕. All rights reserved.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
