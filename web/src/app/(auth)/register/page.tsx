'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff, Mail, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';

type Step = 'form' | 'verify';

const PW_RULES = [
  { label: '8자 이상', test: (pw: string) => pw.length >= 8 },
  { label: '대문자 포함 (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: '소문자 포함 (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
  { label: '숫자 포함 (0-9)', test: (pw: string) => /\d/.test(pw) },
  { label: '특수문자 포함 (@$!%*?&)', test: (pw: string) => /[@$!%*?&]/.test(pw) },
];

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('form');
  const [showPw, setShowPw] = useState(false);
  const [showPwChecklist, setShowPwChecklist] = useState(false);
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
      case 'name':
        return value.trim() ? '' : '이름을 입력해주세요.';
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
          return '대/소문자, 숫자, 특수문자(@$!%*?&)를 각각 1개 이상 포함해야 합니다.';
        return '';
      case 'passwordConfirm':
        return value === allForm.password ? '' : '비밀번호가 일치하지 않습니다.';
      default:
        return '';
    }
  };

  const handleChange = (key: keyof typeof form, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // 이미 터치된 필드는 실시간으로 재검증
    if (touched[key]) {
      setErrors((prev) => ({ ...prev, [key]: validateField(key, value, next) }));
    }
    // passwordConfirm도 password 변경 시 재검증
    if (key === 'password' && touched.passwordConfirm) {
      setErrors((prev) => ({ ...prev, passwordConfirm: validateField('passwordConfirm', next.passwordConfirm, next) }));
    }
  };

  const handleBlur = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const err = validateField(key, form[key as keyof typeof form]);
    setErrors((prev) => ({ ...prev, [key]: err }));
  };

  const validate = (): boolean => {
    const keys = ['name', 'email', 'companyName', 'password', 'passwordConfirm'] as const;
    const errs: Record<string, string> = {};
    keys.forEach((k) => {
      const msg = validateField(k, form[k]);
      if (msg) errs[k] = msg;
    });
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
        setUser(data.user, {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        setIsNavigating(true);
        router.replace('/onboarding/plan');
      } else {
        setRegisteredEmail(form.email);
        setStep('verify');
      }
    },
    onError: (err: any) => {
      const message: string = err.response?.data?.error?.message ?? err.response?.data?.message ?? '가입에 실패했습니다.';
      // 서버 에러를 해당 필드로 라우팅
      if (message.includes('이메일')) {
        setErrors({ email: message });
      } else if (message.includes('비밀번호')) {
        setErrors({ password: message });
      } else if (message.includes('사업자')) {
        setErrors({ submit: message });
      } else {
        setErrors({ submit: message });
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => api.post('/auth/resend-verification', { email: registeredEmail }),
    onSuccess: () => {
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    registerMutation.mutate({
      email: form.email,
      password: form.password,
      name: form.name,
      company_name: form.companyName,
    });
  };

  const inputClass = (key: string) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[key] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
    }`;

  const pwAllPassed = PW_RULES.every((r) => r.test(form.password));

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">관리왕</h1>
          <p className="text-sm text-gray-500 mt-1">무료로 시작해보세요</p>
        </div>

        {step === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">회원가입</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  className={inputClass('name')}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  placeholder="example@company.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={inputClass('email')}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* 회사명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">회사명</label>
                <input
                  type="text"
                  placeholder="(주)우리회사"
                  value={form.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  onBlur={() => handleBlur('companyName')}
                  className={inputClass('companyName')}
                />
                {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="비밀번호 입력"
                    value={form.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    onFocus={() => setShowPwChecklist(true)}
                    onBlur={() => {
                      handleBlur('password');
                      if (pwAllPassed) setShowPwChecklist(false);
                    }}
                    className={`${inputClass('password')} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* 비밀번호 요건 체크리스트 — 항상 표시 */}
                <ul className="mt-2 space-y-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                  {PW_RULES.map((rule) => {
                    const ok = rule.test(form.password);
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
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="비밀번호 재입력"
                  value={form.passwordConfirm}
                  onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                  onBlur={() => handleBlur('passwordConfirm')}
                  className={inputClass('passwordConfirm')}
                />
                {errors.passwordConfirm && (
                  <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>
                )}
              </div>

              {/* 서버 에러 */}
              {errors.submit && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>
              )}

              <Button
                type="submit"
                className="w-full mt-2"
                loading={registerMutation.isPending || isNavigating}
                disabled={registerMutation.isPending || isNavigating}
              >
                가입하기 — 14일 무료 체험
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        )}

        {step === 'verify' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blue-50 mb-4">
              <Mail className="h-7 w-7 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">이메일을 확인해주세요</h2>
            <p className="text-sm text-gray-500 mb-1">아래 주소로 인증 메일을 발송했습니다.</p>
            <p className="text-sm font-semibold text-gray-900 mb-6 break-all">{registeredEmail}</p>

            <p className="text-xs text-gray-400 mb-4">
              메일이 오지 않았나요? 스팸 폴더를 확인하거나 재발송해보세요.
            </p>

            <Button
              variant="secondary"
              className="w-full mb-3"
              onClick={() => resendMutation.mutate()}
              loading={resendMutation.isPending}
              disabled={cooldown > 0 || resendMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {cooldown > 0 ? `재발송 (${cooldown}초)` : '인증 메일 재발송'}
            </Button>

            <button
              onClick={() => setStep('form')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mx-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              이메일 수정
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
