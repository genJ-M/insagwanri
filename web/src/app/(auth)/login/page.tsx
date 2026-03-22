'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ArrowRight, Users, Clock, Sparkles } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';

const FEATURES = [
  { icon: Clock,    text: '실시간 출퇴근 관리' },
  { icon: Users,    text: '직원 현황 한눈에' },
  { icon: Sparkles, text: 'AI 업무 보고 자동화' },
];

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
    <div className="min-h-screen flex">
      {/* ── 왼쪽 브랜드 패널 ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-sidebar-bg flex-col justify-between p-12 flex-shrink-0">
        {/* 로고 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">관</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">관리왕</span>
        </div>

        {/* 중앙 카피 */}
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            중소사업장을 위한<br />
            <span className="text-primary-400">스마트 직원 관리</span>
          </h2>
          <p className="text-sidebar-text text-sm leading-relaxed mb-10">
            출퇴근 관리부터 AI 업무 보고까지,<br />
            복잡한 인사 업무를 한 곳에서 처리하세요.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sidebar-hover flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary-400" />
                </div>
                <span className="text-sm text-sidebar-text">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">© 2026 관리왕. All rights reserved.</p>
      </div>

      {/* ── 오른쪽 폼 패널 ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[400px]">
          {/* 모바일 로고 */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">관</span>
            </div>
            <span className="font-bold text-base text-text-primary">관리왕</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary">다시 오셨군요</h1>
            <p className="text-sm text-text-muted mt-1.5">계정에 로그인하세요</p>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-card p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">이메일</label>
                <input
                  type="email"
                  placeholder="example@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide">비밀번호</label>
                  <Link href="/forgot-password" className="text-xs text-primary-500 hover:text-primary-600 font-medium">
                    비밀번호 찾기
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="비밀번호를 입력하세요"
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

              {isLocked && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-lg">
                  <p className="font-semibold">계정이 일시적으로 잠겼습니다.</p>
                  <p className="text-xs mt-0.5 text-red-500">로그인 시도 5회 초과 — 15분 후 다시 시도해주세요.</p>
                </div>
              )}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg">{error}</p>
              )}

              <Button
                type="submit"
                loading={loginMutation.isPending}
                className="w-full justify-center gap-2 py-2.5 mt-1"
              >
                로그인
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-text-muted mt-6">
            아직 계정이 없으신가요?{' '}
            <Link href="/register" className="text-primary-500 font-semibold hover:text-primary-600">
              무료로 시작하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
