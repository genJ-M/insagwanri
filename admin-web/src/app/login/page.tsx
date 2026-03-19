'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

type Step = 'password' | 'totp';

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: 이메일 + 비밀번호
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, tempToken: tmp, requiresMfa } = res.data.data;

      if (!requiresMfa && accessToken) {
        // MFA 없는 계정 (READONLY 등)
        localStorage.setItem('adminToken', accessToken);
        router.push('/companies');
      } else {
        // MFA 필요
        setTempToken(tmp);
        setStep('totp');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: TOTP 코드
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/mfa/verify', { tempToken, code: totpCode });
      const { accessToken } = res.data.data;
      localStorage.setItem('adminToken', accessToken);
      router.push('/companies');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'OTP 인증에 실패했습니다.');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-gray-900">관리왕 Admin</p>
          <p className="text-sm text-gray-500 mt-1">운영자 전용 대시보드</p>
        </div>

        {step === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@gwanriwang.kr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 mt-2"
            >
              {loading ? '확인 중...' : '로그인'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-blue-800">OTP 인증</p>
              <p className="text-xs text-blue-600 mt-1">인증 앱의 6자리 코드를 입력하세요.</p>
            </div>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-2xl text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={totpCode.length !== 6 || loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '인증 중...' : '인증 확인'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('password'); setTotpCode(''); setTempToken(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← 로그인으로 돌아가기
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          내부 운영자 전용 시스템입니다.
        </p>
      </div>
    </div>
  );
}
