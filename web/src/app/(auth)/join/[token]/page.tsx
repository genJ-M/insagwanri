'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2, Eye, EyeOff, CheckCircle2, XCircle,
  Loader2, UserCheck, Users, Lock,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Button from '@/components/ui/Button';

interface LinkInfo {
  companyId: string;
  companyName: string;
  linkKind: 'personal' | 'group';
  role: string;
  department: string | null;
  position: string | null;
  targetEmail: string | null;
  expiresAt: string;
  usedCount: number;
  maxUses: number | null;
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  // ── 링크 미리보기 ──
  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['join-info', token],
    queryFn: async () => {
      const { data } = await api.get(`/invitations/join/${token}`);
      return data.data as LinkInfo;
    },
    enabled: !!token,
    retry: false,
  });

  // 개인 링크: 이메일 자동 채우기
  const emailLocked = info?.linkKind === 'personal' && !!info.targetEmail;

  // ── 가입 요청 ──
  const joinMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/invitations/join/${token}`, {
        name:     form.name,
        email:    emailLocked ? info!.targetEmail! : form.email,
        password: form.password,
      });
      return data;
    },
    onSuccess: () => setDone(true),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '이름을 입력하세요';
    if (!emailLocked && !form.email.includes('@')) e.email = '유효한 이메일을 입력하세요';
    if (form.password.length < 8) e.password = '비밀번호는 8자 이상이어야 합니다';
    if (form.password !== form.passwordConfirm) e.passwordConfirm = '비밀번호가 일치하지 않습니다';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    joinMut.mutate();
  };

  // ── 로딩 ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── 에러 (만료/취소/미존재) ──
  if (isError || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">유효하지 않은 초대 링크</h1>
          <p className="text-sm text-gray-500 mb-6">
            링크가 만료됐거나 취소됐습니다. 초대를 보낸 담당자에게 새 링크를 요청하세요.
          </p>
          <Button variant="secondary" onClick={() => router.push('/login')}>
            로그인 페이지로
          </Button>
        </div>
      </div>
    );
  }

  // ── 가입 완료 ──
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">가입이 완료됐습니다!</h1>
          <p className="text-sm text-gray-500 mb-2">
            입력하신 이메일로 인증 메일이 발송됐습니다.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            이메일 인증을 완료하면 <strong>{info.companyName}</strong> 계정으로 로그인할 수 있습니다.
          </p>
          <Button onClick={() => router.push('/login')}>
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  // ── 가입 폼 ──
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-blue-100 text-xs">초대받은 회사</p>
              <h2 className="font-bold text-lg">{info.companyName}</h2>
            </div>
          </div>

          {/* 링크 정보 배지 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs">
              {info.linkKind === 'personal' ? <UserCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {info.linkKind === 'personal' ? '개인 초대' : '그룹 초대'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs">
              {info.role === 'manager' ? '관리자' : '직원'}
            </span>
            {info.department && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs">
                {info.department}
              </span>
            )}
            {info.position && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs">
                {info.position}
              </span>
            )}
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">계정 정보 입력</h3>

          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="홍길동"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
              {emailLocked && (
                <span className="ml-2 text-xs text-blue-500 inline-flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> 지정됨
                </span>
              )}
            </label>
            {emailLocked ? (
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                {info.targetEmail}
              </div>
            ) : (
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="8자 이상"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.passwordConfirm}
              onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
              placeholder="비밀번호 재입력"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.passwordConfirm && <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>}
          </div>

          {/* 서버 에러 */}
          {joinMut.isError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {(joinMut.error as any)?.response?.data?.message ?? '가입 중 오류가 발생했습니다'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={joinMut.isPending}>
            {joinMut.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 처리 중...
              </span>
            ) : '가입하기'}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            가입 후 이메일 인증을 완료해야 로그인할 수 있습니다.
          </p>
        </form>
      </div>
    </div>
  );
}
