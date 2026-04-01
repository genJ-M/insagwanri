'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Building2, ArrowLeft, Mail, Smartphone, CheckCircle2, KeyRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import { clsx } from 'clsx';

type Method = 'email' | 'phone';
type Step = 'input' | 'otp' | 'password' | 'done';

const PW_RULES = [
  { label: '8자 이상',      test: (v: string) => v.length >= 8 },
  { label: '영문 포함',     test: (v: string) => /[a-zA-Z]/.test(v) },
  { label: '숫자 포함',     test: (v: string) => /[0-9]/.test(v) },
  { label: '특수문자 포함', test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('phone');
  const [step, setStep] = useState<Step>('input');

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const emailMutation = useMutation({
    mutationFn: (email: string) => api.post('/auth/forgot-password', { email }),
    onSuccess: () => setEmailSent(true),
    onError: () => setEmailSent(true),
  });

  const otpSendMutation = useMutation({
    mutationFn: (phone: string) => api.post('/auth/send-phone-otp', { phone }),
    onSettled: () => { setStep('otp'); setError(''); startCountdown(); },
  });

  const otpVerifyMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      api.post('/auth/verify-phone-otp', { phone, code }).then(r => r.data.data),
    onSuccess: (data: { resetToken: string }) => {
      setResetToken(data.resetToken);
      setStep('password');
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '인증번호가 올바르지 않습니다.'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.post('/auth/reset-password', { token, new_password: password }),
    onSuccess: () => setStep('done'),
    onError: (err: any) => setError(err.response?.data?.message ?? '비밀번호 변경에 실패했습니다.'),
  });

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleSubmitInput = () => {
    setError('');
    if (method === 'email') {
      if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setError('올바른 이메일을 입력해주세요.'); return; }
      emailMutation.mutate(email);
    } else {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return; }
      otpSendMutation.mutate(phone);
    }
  };

  const handleVerifyOtp = () => {
    setError('');
    if (otp.length !== 6) { setError('6자리 인증번호를 입력해주세요.'); return; }
    otpVerifyMutation.mutate({ phone, code: otp });
  };

  const handleResetPassword = () => {
    setError('');
    if (!PW_RULES.every(({ test }) => test(newPw))) { setError('비밀번호 조건을 모두 충족해주세요.'); return; }
    if (newPw !== confirmPw) { setError('비밀번호가 일치하지 않습니다.'); return; }
    resetMutation.mutate({ token: resetToken, password: newPw });
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

          {/* ── STEP 1: 방법 선택 + 입력 ── */}
          {step === 'input' && !emailSent && (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-1">비밀번호 찾기</h2>
              <p className="text-sm text-gray-500 mb-5">인증 방법을 선택해 비밀번호를 재설정하세요.</p>

              <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
                {([['phone', Smartphone, '전화번호 인증'], ['email', Mail, '이메일 링크']] as const).map(([m, Icon, label]) => (
                  <button
                    key={m}
                    onClick={() => { setMethod(m as Method); setError(''); }}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                      method === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {method === 'phone' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">전화번호</label>
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitInput()}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1.5">가입 시 등록한 전화번호를 입력하세요.</p>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button className="w-full" loading={otpSendMutation.isPending} onClick={handleSubmitInput}>
                    인증번호 받기
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                    <input
                      type="email"
                      placeholder="example@company.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitInput()}
                      className={inputCls}
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <Button className="w-full" loading={emailMutation.isPending} onClick={handleSubmitInput}>
                    재설정 링크 보내기
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── 이메일 발송 완료 ── */}
          {step === 'input' && emailSent && (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blue-50 mb-4">
                <Mail className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">이메일을 확인해주세요</h2>
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{email}</span>이<br />
                가입된 이메일인 경우 재설정 링크를 발송했습니다.
              </p>
              <p className="text-xs text-gray-400 mt-3">링크는 1시간 동안 유효합니다. 스팸함도 확인해주세요.</p>
              <button onClick={() => { setEmailSent(false); setEmail(''); }} className="mt-5 text-sm text-blue-600 hover:underline">
                다른 이메일로 다시 시도
              </button>
            </div>
          )}

          {/* ── STEP 2: OTP 입력 ── */}
          {step === 'otp' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setStep('input')} className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">인증번호 입력</h2>
                  <p className="text-sm text-gray-500">{phone}으로 발송된 6자리 코드를 입력하세요.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    className={clsx(inputCls, 'text-center text-2xl tracking-[0.5em] font-mono')}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400">5분 이내에 입력하세요.</p>
                    {countdown > 0
                      ? <span className="text-xs text-gray-400">{countdown}초 후 재전송</span>
                      : <button onClick={() => otpSendMutation.mutate(phone)} className="text-xs text-blue-600 hover:underline">재전송</button>
                    }
                  </div>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <Button className="w-full" loading={otpVerifyMutation.isPending} onClick={handleVerifyOtp}>
                  확인
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 3: 새 비밀번호 설정 ── */}
          {step === 'password' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <KeyRound className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900">새 비밀번호 설정</h2>
                  <p className="text-sm text-gray-500">새로운 비밀번호를 입력해주세요.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">새 비밀번호</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} />
                  {newPw && (
                    <ul className="space-y-1 mt-2">
                      {PW_RULES.map(({ label, test }) => (
                        <li key={label} className={clsx('flex items-center gap-1.5 text-xs', test(newPw) ? 'text-green-600' : 'text-gray-400')}>
                          <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', test(newPw) ? 'bg-green-500' : 'bg-gray-200')} />
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
                  {confirmPw && newPw !== confirmPw && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <Button className="w-full" loading={resetMutation.isPending} onClick={handleResetPassword}>
                  비밀번호 변경
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 4: 완료 ── */}
          {step === 'done' && (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-2">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-gray-500 mb-5">새 비밀번호로 로그인해주세요.</p>
              <Button className="w-full" onClick={() => router.push('/login')}>
                로그인하기
              </Button>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <div className="text-center mt-5">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
