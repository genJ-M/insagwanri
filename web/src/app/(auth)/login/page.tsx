'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">관리왕</h1>
          <p className="text-sm text-gray-500 mt-1">직원 관리 플랫폼</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                placeholder="example@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           placeholder:text-gray-400"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-300 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {isLocked && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg">
                <p className="font-medium">계정이 일시적으로 잠겼습니다.</p>
                <p className="text-xs mt-0.5 text-red-500">로그인 시도가 5회 초과되었습니다. 15분 후 다시 시도해주세요.</p>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            <Button
              type="submit"
              loading={loginMutation.isPending}
              className="w-full justify-center py-2.5"
            >
              로그인
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          아직 계정이 없으신가요?{' '}
          <a href="/register" className="text-blue-600 font-medium hover:underline">
            무료로 시작하기
          </a>
        </p>

        <p className="text-center text-xs text-gray-400 mt-4">
          © 2026 관리왕. All rights reserved.
        </p>
      </div>
    </div>
  );
}
