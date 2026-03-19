'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Button from '@/components/ui/Button';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ name: '', phone: '', password: '', passwordConfirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  // 초대 정보 조회
  const { data: inviteInfo, isLoading, isError, error } = useQuery({
    queryKey: ['invite-info', token],
    queryFn: async () => {
      const { data } = await api.get(`/users/invite-info?token=${token}`);
      return data.data as {
        companyName: string;
        inviterName: string;
        email: string;
        role: string;
        expiresAt: string;
      };
    },
    enabled: !!token,
    retry: false,
  });

  // 초대 수락
  const acceptMutation = useMutation({
    mutationFn: async (payload: { token: string; name: string; phone?: string; password: string }) => {
      const { data } = await api.post('/users/accept-invite', payload);
      return data.data;
    },
    onSuccess: () => {
      setDone(true);
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '이름을 입력해주세요.';
    if (!form.password) errs.password = '비밀번호를 입력해주세요.';
    else if (form.password.length < 8) errs.password = '비밀번호는 8자 이상이어야 합니다.';
    if (form.password !== form.passwordConfirm) errs.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    acceptMutation.mutate({
      token,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
    });
  };

  // 토큰 없음
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">유효하지 않은 링크</h2>
          <p className="text-sm text-gray-500 mt-2">초대 링크가 올바르지 않습니다.</p>
        </div>
      </div>
    );
  }

  // 로딩
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // 오류 (만료/취소 등)
  if (isError || !inviteInfo) {
    const msg = (error as any)?.response?.data?.error?.message ?? '유효하지 않거나 만료된 초대 링크입니다.';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">초대 링크 오류</h2>
          <p className="text-sm text-gray-500 mt-2">{msg}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            로그인으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  // 가입 완료
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">가입 완료!</h2>
          <p className="text-sm text-gray-500 mt-2">
            <span className="font-medium">{inviteInfo.companyName}</span>에 합류했습니다.
          </p>
          <Button onClick={() => router.replace('/login')} className="mt-6 justify-center">
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  const roleLabel: Record<string, string> = {
    owner: '오너', admin: '관리자', manager: '매니저', employee: '직원',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">관리왕</h1>
          <p className="text-sm text-gray-500 mt-1">직원 초대</p>
        </div>

        {/* Invite info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm">
          <p className="text-blue-800">
            <span className="font-semibold">{inviteInfo.inviterName}</span>님이{' '}
            <span className="font-semibold">{inviteInfo.companyName}</span>에 초대했습니다.
          </p>
          <p className="text-blue-600 mt-0.5">
            {inviteInfo.email} · {roleLabel[inviteInfo.role] ?? inviteInfo.role}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">계정 설정</h2>

          {acceptMutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
              {(acceptMutation.error as any)?.response?.data?.error?.message ?? '오류가 발생했습니다.'}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
              <input
                type="text"
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* 전화번호 (선택) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                전화번호 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="8자 이상 입력"
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
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인 *</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="비밀번호를 다시 입력"
                value={form.passwordConfirm}
                onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.passwordConfirm && (
                <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
              )}
            </div>

            <Button
              type="submit"
              loading={acceptMutation.isPending}
              className="w-full justify-center py-2.5 mt-2"
            >
              가입 완료
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          © 2026 관리왕. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
