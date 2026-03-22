'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
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
