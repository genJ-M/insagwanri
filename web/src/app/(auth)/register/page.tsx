'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import { clsx } from 'clsx';

type Step = 'form' | 'verify';

const PW_RULES = [
  { label: '8자 이상',            test: (pw: string) => pw.length >= 8 },
  { label: '대문자 포함 (A-Z)',   test: (pw: string) => /[A-Z]/.test(pw) },
  { label: '소문자 포함 (a-z)',   test: (pw: string) => /[a-z]/.test(pw) },
  { label: '숫자 포함 (0-9)',     test: (pw: string) => /\d/.test(pw) },
  { label: '특수문자 (@$!%*?&)',  test: (pw: string) => /[@$!%*?&]/.test(pw) },
];

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('form');
  const [showPw, setShowPw] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isNavigating, setIsNavigating] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', passwordConfirm: '',
    name: '', companyName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (key: string, value: string, allForm = form): string => {
    switch (key) {
      case 'name':        return value.trim() ? '' : '이름을 입력해주세요.';
      case 'email':
        if (!value.trim()) return '이메일을 입력해주세요.';
        if (!/\S+@\S+\.\S+/.test(value)) return '올바른 이메일 형식이 아닙니다.';
        return '';
      case 'companyName':
        if (!value.trim()) return '회사명을 입력해주세요.';
        if (value.trim().length < 2) return '회사명은 2자 이상 입력해주세요.';
        return '';
      case 'password':
        if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(value))
          return '대/소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.';
        return '';
      case 'passwordConfirm': return value === allForm.password ? '' : '비밀번호가 일치하지 않습니다.';
      default: return '';
    }
  };

  const handleChange = (key: keyof typeof form, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: validateField(key, value, next) }));
    if (key === 'password' && touched.passwordConfirm) {
      setErrors((prev) => ({ ...prev, passwordConfirm: validateField('passwordConfirm', next.passwordConfirm, next) }));
    }
  };

  const handleBlur = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, form[key as keyof typeof form]) }));
  };

  const validate = (): boolean => {
    const keys = ['name', 'email', 'companyName', 'password', 'passwordConfirm'] as const;
    const errs: Record<string, string> = {};
    keys.forEach((k) => { const msg = validateField(k, form[k]); if (msg) errs[k] = msg; });
    setErrors(errs);
    setTouched({ name: true, email: true, companyName: true, password: true, passwordConfirm: true });
    return Object.keys(errs).length === 0;
  };

  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/auth/register', payload);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.access_token) {
        setUser(data.user, { access_token: data.access_token, refresh_token: data.refresh_token });
        setIsNavigating(true);
        router.replace('/onboarding/plan');
      } else {
        setRegisteredEmail(form.email);
        setStep('verify');
      }
    },
    onError: (err: any) => {
      const message: string = err.response?.data?.error?.message ?? err.response?.data?.message ?? '가입에 실패했습니다.';
      if (message.includes('이메일')) setErrors({ email: message });
      else if (message.includes('비밀번호')) setErrors({ password: message });
      else setErrors({ submit: message });
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post('/auth/resend-verification', { email: registeredEmail }),
    onSuccess: () => {
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
      }, 1000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    registerMutation.mutate({ email: form.email, password: form.password, name: form.name, company_name: form.companyName });
  };

  const pwAllPassed = PW_RULES.every((r) => r.test(form.password));

  const inputCls = (key: string) => clsx('input', errors[key] && 'border-red-400 focus:border-red-400 focus:ring-red-100');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">관</span>
        </div>
        <span className="text-xl font-bold text-text-primary">관리왕</span>
      </div>

      {step === 'form' && (
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-border shadow-card p-8">
          <h1 className="text-[22px] font-bold text-text-primary mb-1">무료회원가입</h1>
          <p className="text-sm text-text-muted mb-7">14일 무료 체험 · 신용카드 불필요</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 + 회사명 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">이름 *</label>
                <input
                  type="text" placeholder="홍길동"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  className={inputCls('name')}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">회사명 *</label>
                <input
                  type="text" placeholder="(주)우리회사"
                  value={form.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  onBlur={() => handleBlur('companyName')}
                  className={inputCls('companyName')}
                />
                {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">아이디 (이메일주소) *</label>
              <input
                type="email" placeholder="이메일주소를 입력해주세요"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                className={inputCls('email')}
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">비밀번호 *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="영문, 숫자 포함 8자 이상으로 입력해주세요"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  className={clsx(inputCls('password'), 'pr-10')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && !pwAllPassed && (
                <ul className="mt-2 grid grid-cols-2 gap-1 bg-background rounded-xl px-3 py-2.5 border border-border">
                  {PW_RULES.map((rule) => {
                    const ok = rule.test(form.password);
                    return (
                      <li key={rule.label} className={clsx('flex items-center gap-1.5 text-xs', ok ? 'text-emerald-600' : 'text-text-muted')}>
                        {ok ? <Check className="h-3 w-3 flex-shrink-0" /> : <X className="h-3 w-3 flex-shrink-0" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">비밀번호 *</label>
              <input
                type="password" placeholder="비밀번호를 한 번 더 입력해주세요"
                value={form.passwordConfirm}
                onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                onBlur={() => handleBlur('passwordConfirm')}
                className={inputCls('passwordConfirm')}
                autoComplete="new-password"
              />
              {errors.passwordConfirm && <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>}
            </div>

            {errors.submit && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{errors.submit}</p>
            )}

            <Button
              type="submit"
              className="w-full justify-center py-3 text-[15px] rounded-xl mt-1"
              loading={registerMutation.isPending || isNavigating}
              disabled={registerMutation.isPending || isNavigating}
            >
              가입하기
            </Button>
          </form>
        </div>
      )}

      {step === 'verify' && (
        <div className="w-full max-w-[400px] bg-white rounded-2xl border border-border shadow-card p-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-50 mb-5">
            <Mail className="h-7 w-7 text-primary-500" />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">이메일을 확인해주세요</h2>
          <p className="text-sm text-text-secondary mb-1">아래 주소로 인증 메일을 발송했습니다.</p>
          <p className="text-sm font-semibold text-text-primary mb-6 break-all">{registeredEmail}</p>
          <p className="text-xs text-text-muted mb-5">메일이 오지 않았나요? 스팸 폴더를 확인하거나 재발송해보세요.</p>
          <Button
            variant="secondary"
            className="w-full justify-center mb-3"
            onClick={() => resendMutation.mutate()}
            loading={resendMutation.isPending}
            disabled={cooldown > 0 || resendMutation.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            {cooldown > 0 ? `재발송 (${cooldown}초)` : '인증 메일 재발송'}
          </Button>
          <button
            onClick={() => setStep('form')}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary mx-auto transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            이메일 수정
          </button>
        </div>
      )}

      <p className="text-sm text-text-muted mt-6">
        이미 관리왕 계정이 있으신가요?{' '}
        <Link href="/login" className="text-primary-500 font-semibold hover:text-primary-600">
          로그인
        </Link>
      </p>
      <p className="text-xs text-text-muted mt-6">© 2026 관리왕. All rights reserved.</p>
    </div>
  );
}
