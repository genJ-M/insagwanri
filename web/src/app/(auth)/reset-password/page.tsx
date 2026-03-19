'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff, Check, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import Button from '@/components/ui/Button';

const PW_RULES = [
  { label: '8자 이상', test: (pw: string) => pw.length >= 8 },
  { label: '대문자 포함 (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: '소문자 포함 (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
  { label: '숫자 포함 (0-9)', test: (pw: string) => /\d/.test(pw) },
  { label: '특수문자 포함 (@$!%*?&)', test: (pw: string) => /[@$!%*?&]/.test(pw) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  useEffect(() => {
    if (!token) router.replace('/forgot-password');
  }, [token, router]);

  const pwAllPassed = PW_RULES.every((r) => r.test(password));

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/reset-password', { token, new_password: password });
      return data;
    },
    onSuccess: () => setDone(true),
    onError: (err: any) => {
      const message = err.response?.data?.error?.message ?? '비밀번호 변경에 실패했습니다.';
      if (message.includes('만료') || message.includes('expired') || message.includes('사용') || message.includes('invalid')) {
        setTokenInvalid(true);
      } else {
        setErrors({ submit: message });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pwAllPassed) errs.password = '비밀번호 요건을 모두 충족해주세요.';
    if (password !== passwordConfirm) errs.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate();
  };

  if (tokenInvalid) {
    return (
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-red-50 mb-4">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">링크가 만료되었습니다</h2>
        <p className="text-sm text-gray-500 mb-6">
          비밀번호 재설정 링크는 1시간 동안만 유효하며,<br />한 번 사용하면 다시 사용할 수 없습니다.
        </p>
        <Button className="w-full" onClick={() => router.replace('/forgot-password')}>
          재설정 링크 다시 받기
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-4">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">비밀번호가 변경되었습니다</h2>
        <p className="text-sm text-gray-500 mb-6">새 비밀번호로 다시 로그인해주세요.</p>
        <Button className="w-full" onClick={() => router.replace('/login')}>
          로그인하러 가기
        </Button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-1">새 비밀번호 설정</h2>
      <p className="text-sm text-gray-500 mb-5">아래 조건을 모두 충족하는 비밀번호를 입력해주세요.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 비밀번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="새 비밀번호 입력"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
              className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.password ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* 항상 표시되는 요건 체크리스트 */}
          <ul className="mt-2 space-y-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            {PW_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                  {ok
                    ? <Check className="h-3.5 w-3.5 flex-shrink-0" />
                    : <X className="h-3.5 w-3.5 flex-shrink-0" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
        </div>

        {/* 비밀번호 확인 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호 확인</label>
          <input
            type="password"
            placeholder="새 비밀번호 재입력"
            value={passwordConfirm}
            onChange={(e) => { setPasswordConfirm(e.target.value); setErrors({}); }}
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.passwordConfirm ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
            }`}
          />
          {errors.passwordConfirm && (
            <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
          )}
          {passwordConfirm && password === passwordConfirm && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> 비밀번호가 일치합니다.
            </p>
          )}
        </div>

        {errors.submit && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={mutation.isPending}
          disabled={mutation.isPending || !pwAllPassed}
        >
          비밀번호 변경하기
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">관리왕</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <Suspense fallback={<p className="text-sm text-gray-500">로딩 중...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <div className="text-center mt-5">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
