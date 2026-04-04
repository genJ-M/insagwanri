'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';

/**
 * /auth/social-complete
 * 소셜 신규 가입자 — 회사명 입력 후 가입 완료.
 * URL 파라미터: pending_token, name, email
 */
function SocialCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  const pendingToken = searchParams?.get('pending_token') ?? '';
  const name = searchParams?.get('name') ?? '';
  const email = searchParams?.get('email') ?? '';

  const [companyName, setCompanyName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingToken) router.replace('/login?error=oauth_failed');
  }, [pendingToken]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/auth/social-complete', {
        pending_token: pendingToken,
        company_name: companyName,
      }),
    onSuccess: (res) => {
      const { access_token, refresh_token, user } = res.data.data;
      setUser(user, { access_token, refresh_token });
      router.replace('/');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message ?? '가입에 실패했습니다. 다시 시도해 주세요.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('회사명은 2자 이상 입력해 주세요.');
      return;
    }
    if (!agreed) {
      setError('이용약관 및 개인정보 처리방침에 동의해 주세요.');
      return;
    }
    mutation.mutate();
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

      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-border shadow-card p-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-5">
          <Building2 className="w-6 h-6 text-primary-500" />
        </div>

        <h1 className="text-[22px] font-bold text-text-primary mb-1">거의 다 됐습니다!</h1>
        <p className="text-sm text-text-muted mb-6">
          회사 정보를 입력하고 가입을 완료해 주세요.
        </p>

        {/* 소셜 계정 정보 표시 */}
        {(name || email) && (
          <div className="bg-gray-50 rounded-xl p-3.5 mb-5 text-sm">
            <p className="font-medium text-gray-800">{name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{email}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              회사명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="회사명을 입력해주세요"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={100}
              className="input"
              autoFocus
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-primary-500"
            />
            <span className="text-xs text-text-muted leading-relaxed">
              관리왕의{' '}
              <a href="/terms" target="_blank" className="text-primary-500 hover:underline">이용약관</a>
              {' '}및{' '}
              <a href="/privacy" target="_blank" className="text-primary-500 hover:underline">개인정보 처리방침</a>
              에 동의합니다.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>
          )}

          <Button
            type="submit"
            loading={mutation.isPending}
            className="w-full justify-center py-3 text-[15px] rounded-xl mt-1"
          >
            가입 완료
          </Button>
        </form>
      </div>

      <p className="text-xs text-text-muted mt-8">© 2026 관리왕. All rights reserved.</p>
    </div>
  );
}

export default function SocialCompletePage() {
  return (
    <Suspense>
      <SocialCompleteContent />
    </Suspense>
  );
}
