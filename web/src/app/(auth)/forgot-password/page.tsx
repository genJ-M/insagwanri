'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Building2, ArrowLeft, Mail } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import Button from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post('/auth/forgot-password', { email });
      return data;
    },
    onSuccess: () => setSent(true),
    onError: () => setSent(true), // 보안상 항상 성공 화면 표시
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError('이메일을 입력해주세요.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('올바른 이메일 형식이 아닙니다.');
      return;
    }
    setEmailError('');
    mutation.mutate(email);
  };

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
          {!sent ? (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-1">비밀번호 찾기</h2>
              <p className="text-sm text-gray-500 mb-5">
                가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    placeholder="example@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      emailError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                    }`}
                  />
                  {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={mutation.isPending}
                  disabled={mutation.isPending}
                >
                  재설정 링크 보내기
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blue-50 mb-4">
                <Mail className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">이메일을 확인해주세요</h2>
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{email}</span>이<br />
                가입된 이메일인 경우 재설정 링크를 발송했습니다.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                링크는 1시간 동안 유효합니다. 스팸함도 확인해주세요.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="mt-5 text-sm text-blue-600 hover:underline"
              >
                다른 이메일로 다시 시도
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
