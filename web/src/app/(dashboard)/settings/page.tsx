'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Building2, Clock, MapPin, Bell, Image,
  Eye, EyeOff, Check, AlertTriangle, Smartphone, ChevronDown, X,
  Laptop, LandmarkIcon, HardHat, ShoppingBag, Navigation, HeartPulse,
  GitBranch, Plus, Trash2, UserPlus, Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import ImageUploader from '@/components/ui/ImageUploader';
import CoverCropModal from '@/components/ui/CoverCropModal';

// ── 업종 타입 ────────────────────────────────────
interface IndustryPreset {
  code: string;
  label: string;
  emoji: string;
  description: string;
  recommendedAttendanceMethods: string[];
}

type Section = 'profile' | 'company' | 'work' | 'gps' | 'attendance-methods' | 'it-settings' | 'public-sector' | 'shift-worker' | 'part-time' | 'field-visit' | 'care-worker' | 'notification' | 'branding' | 'locations';

type AttendanceMethod = 'manual' | 'gps' | 'wifi' | 'qr' | 'face';
const ALL_METHODS: { value: AttendanceMethod; label: string; desc: string }[] = [
  { value: 'manual',  label: '클릭 출퇴근',  desc: '앱/웹에서 버튼을 눌러 직접 출퇴근 처리' },
  { value: 'gps',     label: 'GPS 위치',     desc: '회사 GPS 반경 내에서 출퇴근 처리 (GPS 설정 필요)' },
  { value: 'wifi',    label: 'WiFi',          desc: '사내 WiFi 연결 상태에서 출퇴근 처리' },
  { value: 'qr',      label: 'QR 코드',       desc: '관리자가 띄운 QR을 스캔해 출퇴근 처리' },
  { value: 'face',    label: '생체 인증',     desc: '기기 지문/Face ID 인증 후 출퇴근 처리' },
];

const DAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];

// ── 비밀번호 복잡도 규칙 ──────────────────────────
const PW_RULES = [
  { label: '8자 이상',      test: (v: string) => v.length >= 8 },
  { label: '영문 포함',     test: (v: string) => /[a-zA-Z]/.test(v) },
  { label: '숫자 포함',     test: (v: string) => /[0-9]/.test(v) },
  { label: '특수문자 포함', test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

function PwChecklist({ value }: { value: string }) {
  if (!value) return null;
  return (
    <ul className="space-y-1 mt-2">
      {PW_RULES.map(({ label, test }) => {
        const ok = test(value);
        return (
          <li key={label} className={clsx('flex items-center gap-1.5 text-xs', ok ? 'text-green-600' : 'text-text-muted')}>
            <Check className={clsx('h-3.5 w-3.5', ok ? 'opacity-100' : 'opacity-30')} />
            {label}
          </li>
        );
      })}
    </ul>
  );
}

// ── 내 프로필 섹션 ─────────────────────────────
function ProfileSection() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  
  const [showPwFields, setShowPwFields] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [form, setForm] = useState({ name: '', phone: '', department: '', position: '' });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');

  useUnsavedChanges(isDirty);

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => { const { data } = await api.get('/users/me'); return data.data ?? data; },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '', phone: profile.phone ?? '',
        department: profile.department ?? '', position: profile.position ?? '',
      });
      setProfileImageUrl(profile.profileImageUrl ?? null);
      setIsDirty(false);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch('/users/me', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const pwMutation = useMutation({
    mutationFn: (payload: any) => api.patch('/users/me/password', payload),
    onSuccess: () => {
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('비밀번호가 변경되었습니다.', { id: 'settings-save' });
    },
    onError: (err: any) => setPwError(err.response?.data?.message ?? '비밀번호 변경에 실패했습니다.'),
  });

  const handlePwChange = () => {
    setPwError('');
    const allPass = PW_RULES.every(({ test }) => test(pwForm.newPassword));
    if (!allPass) { setPwError('새 비밀번호가 복잡도 조건을 충족하지 않습니다.'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('새 비밀번호가 일치하지 않습니다.'); return; }
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const toggleShowPw = (key: keyof typeof showPwFields) =>
    setShowPwFields((f) => ({ ...f, [key]: !f[key] }));

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all';

  return (
    <>
      <Card>
        <CardHeader title="내 프로필" />
        <div className="mt-4 space-y-4">
          {/* 아바타 */}
          <div className="flex items-center gap-4">
            <ImageUploader
              currentUrl={profileImageUrl}
              onUpload={(url) => { setProfileImageUrl(url); setIsDirty(true); }}
              feature="profiles"
              shape="circle"
              fallback={form.name.charAt(0).toUpperCase() || '?'}
            />
            <div>
              <p className="text-sm font-medium text-text-primary">{user?.email}</p>
              <p className="text-xs text-text-muted mt-0.5">{user?.role === 'owner' ? '대표' : user?.role === 'manager' ? '관리자' : '직원'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'name', label: '이름', required: true },
              { key: 'phone', label: '전화번호' },
              { key: 'department', label: '부서' },
              { key: 'position', label: '직책' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setIsDirty(true); }}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-3">
            {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
            <Button
              size="sm"
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ ...form, profileImageUrl: profileImageUrl ?? undefined })}
            >
              저장
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="비밀번호 변경" />
        <div className="mt-4 space-y-3">
          {([
            { key: 'currentPassword', label: '현재 비밀번호' },
            { key: 'newPassword',     label: '새 비밀번호' },
            { key: 'confirmPassword', label: '새 비밀번호 확인' },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  type={showPwFields[key] ? 'text' : 'password'}
                  value={pwForm[key]}
                  onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                  className={clsx(inputCls, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => toggleShowPw(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPwFields[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {key === 'newPassword' && <PwChecklist value={pwForm.newPassword} />}
            </div>
          ))}
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          <div className="flex justify-end">
            <Button size="sm" loading={pwMutation.isPending} onClick={handlePwChange}>
              비밀번호 변경
            </Button>
          </div>
        </div>
      </Card>

      {/* 개인 배경 이미지 */}
      <PersonalCoverCard profile={profile} onSaved={() => queryClient.invalidateQueries({ queryKey: ['me'] })} />
    </>
  );
}

// ── 개인 배경 이미지 카드 ──────────────────────
function PersonalCoverCard({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  useEffect(() => {
    if (profile) {
      setCoverImageUrl(profile.coverImageUrl ?? null);
      setIsDirty(false);
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (payload: any) => api.patch('/users/me', payload),
    onSuccess: () => {
      setIsDirty(false);
      onSaved();
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const handleReset = () => {
    setCoverImageUrl(null);
    mutation.mutate({ coverImageUrl: null });
  };

  return (
    <Card className="mt-4">
      <CardHeader
        title="개인 배경 이미지"
        description="내 대시보드에만 적용되는 개인 커버 이미지입니다. 설정하지 않으면 회사 기본 이미지가 사용됩니다."
      />
      <div className="mt-5 space-y-4">
        <div>
          <label className="label mb-1.5">커버 이미지 <span className="text-text-muted font-normal">(권장: 1920 × 400px)</span></label>
          <ImageUploader
            currentUrl={coverImageUrl}
            onUpload={(url) => { setCoverImageUrl(url); setIsDirty(true); }}
            feature="covers"
            shape="cover"
            fallback="커버 이미지 업로드"
          />
        </div>
        <div className="flex items-center justify-between">
          {coverImageUrl ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-text-muted hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              회사 기본으로 되돌리기
            </button>
          ) : (
            <span className="text-xs text-text-muted">현재 회사 기본 이미지 사용 중</span>
          )}
          {isDirty && (
            <Button
              size="sm"
              loading={mutation.isPending}
              onClick={() => mutation.mutate({ coverImageUrl: coverImageUrl ?? null })}
            >
              저장
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

const COMPANY_TYPE_OPTIONS = [
  { value: 'none',        label: '미등록 / 개인' },
  { value: 'individual',  label: '개인사업자' },
  { value: 'corporation', label: '법인' },
] as const;

// ── 업종 선택 컴포넌트 ──────────────────────────
function IndustryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const { data: presets = [] } = useQuery<IndustryPreset[]>({
    queryKey: ['industry-presets'],
    queryFn: () => api.get('/workspace/industry-presets').then((r) => r.data.data),
    staleTime: Infinity,
  });

  const selected = presets.find((p) => p.code === value);
  const isCustom = value && !selected;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm text-left transition-all hover:border-gray-300 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      >
        <span className={clsx(value ? 'text-text-primary' : 'text-text-muted')}>
          {selected ? `${selected.emoji} ${selected.label}` : isCustom ? value : '업종을 선택하세요'}
        </span>
        <ChevronDown size={16} className="text-text-muted flex-shrink-0" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="업종 선택">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            해당하는 업종을 선택하면 권장 기능이 자동으로 설정됩니다.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {presets.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => { onChange(preset.code, preset.label); setOpen(false); }}
                className={clsx(
                  'flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all',
                  value === preset.code
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-border hover:border-gray-300 hover:bg-surface-2',
                )}
              >
                <span className="text-2xl">{preset.emoji}</span>
                <span className="text-sm font-medium text-text-primary leading-tight">{preset.label}</span>
                <span className="text-[11px] text-text-muted leading-tight">{preset.description}</span>
                {value === preset.code && (
                  <span className="mt-1 text-[10px] font-medium text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">선택됨</span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted mb-2">목록에 없으면 직접 입력하세요</p>
            <div className="flex gap-2">
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="예: 펫샵, 세탁소, 주유소..."
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary-500"
              />
              <Button
                size="sm"
                disabled={!customInput.trim()}
                onClick={() => { onChange(customInput.trim(), customInput.trim()); setCustomInput(''); setOpen(false); }}
              >
                적용
              </Button>
            </div>
          </div>

          {value && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-text-muted hover:text-red-500 flex items-center gap-1"
                onClick={() => { onChange('', ''); setOpen(false); }}
              >
                <X size={12} /> 업종 초기화
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ── 회사 정보 섹션 ─────────────────────────────
function CompanySection() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '', industry: '', phone: '', address: '',
    companyType: 'none' as 'none' | 'individual' | 'corporation',
    businessNumber: '', corporateNumber: '',
    representativeName: '', businessType: '', businessItem: '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name ?? '', industry: settings.industry ?? '',
        phone: settings.phone ?? '', address: settings.address ?? '',
        companyType: settings.companyType ?? 'none',
        businessNumber: settings.businessNumber ?? '',
        corporateNumber: settings.corporateNumber ?? '',
        representativeName: settings.representativeName ?? '',
        businessType: settings.businessType ?? '',
        businessItem: settings.businessItem ?? '',
      });
      setLogoUrl(settings.logoUrl ?? null);
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (payload: any) => api.patch('/workspace/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all';

  const set = (key: keyof typeof form, value: string) => { setForm((f) => ({ ...f, [key]: value })); setIsDirty(true); };

  return (
    <>
      <Card>
        <CardHeader title="회사 정보" />
        <div className="mt-4 space-y-4">
          {/* 회사 로고 */}
          <div>
            <label className="label">회사 로고</label>
            <ImageUploader
              currentUrl={logoUrl}
              onUpload={(url) => { setLogoUrl(url); setIsDirty(true); }}
              feature="logo"
              shape="rect"
              fallback={form.name.charAt(0) || '로고'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">회사명 *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="label">업종</label>
              <IndustryPicker
                value={form.industry}
                onChange={(code) => set('industry', code)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">대표 전화</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="label">대표자명</label>
              <input value={form.representativeName} onChange={(e) => set('representativeName', e.target.value)} placeholder="홍길동" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="label">주소</label>
            <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </div>
        </div>
      </Card>

      {/* 사업자 정보 */}
      <Card className="mt-4">
        <CardHeader title="사업자 정보" description="사업자등록번호, 법인등록번호 등 공식 사업자 정보를 관리합니다." />
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">사업자 구분</label>
            <div className="flex gap-2 flex-wrap">
              {COMPANY_TYPE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('companyType', value)}
                  className={clsx(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    form.companyType === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border text-text-secondary hover:border-gray-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.companyType === 'individual' && (
            <div>
              <label className="label">사업자등록번호</label>
              <input value={form.businessNumber} onChange={(e) => set('businessNumber', e.target.value)} placeholder="123-45-67890" className={inputCls} />
            </div>
          )}

          {form.companyType === 'corporation' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">사업자등록번호</label>
                <input value={form.businessNumber} onChange={(e) => set('businessNumber', e.target.value)} placeholder="123-45-67890" className={inputCls} />
              </div>
              <div>
                <label className="label">법인등록번호</label>
                <input value={form.corporateNumber} onChange={(e) => set('corporateNumber', e.target.value)} placeholder="110111-1234567" className={inputCls} />
              </div>
            </div>
          )}

          {form.companyType !== 'none' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">업태</label>
                <input value={form.businessType} onChange={(e) => set('businessType', e.target.value)} placeholder="서비스업" className={inputCls} />
              </div>
              <div>
                <label className="label">업종/종목</label>
                <input value={form.businessItem} onChange={(e) => set('businessItem', e.target.value)} placeholder="소프트웨어 개발" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({
            ...form,
            logoUrl: logoUrl ?? undefined,
            businessNumber: form.businessNumber || undefined,
            corporateNumber: form.corporateNumber || undefined,
            representativeName: form.representativeName || undefined,
            businessType: form.businessType || undefined,
            businessItem: form.businessItem || undefined,
          })}>
            저장
          </Button>
        </div>
      </Card>
    </>
  );
}

// ── 근무 설정 섹션 ─────────────────────────────
function WorkSection() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    workStartTime: '09:00', workEndTime: '18:00',
    lateThresholdMin: 10, workDays: [1, 2, 3, 4, 5],
  });
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  const { data: settings } = useQuery({ queryKey: ['workspace'], queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; } });
  useEffect(() => {
    if (settings) {
      setForm({
        workStartTime: settings.workStartTime ?? '09:00',
        workEndTime: settings.workEndTime ?? '18:00',
        lateThresholdMin: settings.lateThresholdMin ?? 10,
        workDays: settings.workDays ?? [1, 2, 3, 4, 5],
      });
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/work-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      workDays: f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort(),
    }));
    setIsDirty(true);
  };

  const inputCls = 'input';

  return (
    <>
      <Card>
        <CardHeader title="근무 설정" description="기본 근무 시간 및 요일을 설정합니다" />
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">출근 시간</label>
              <input type="time" value={form.workStartTime}
                onChange={(e) => { setForm({ ...form, workStartTime: e.target.value }); setIsDirty(true); }}
                className="input" />
            </div>
            <div>
              <label className="label">퇴근 시간</label>
              <input type="time" value={form.workEndTime}
                onChange={(e) => { setForm({ ...form, workEndTime: e.target.value }); setIsDirty(true); }}
                className="input" />
            </div>
          </div>

          <div>
            <label className="label">
              지각 허용 시간 <span className="font-normal text-text-muted">({form.lateThresholdMin}분)</span>
            </label>
            <input type="range" min={0} max={60} step={5}
              value={form.lateThresholdMin}
              onChange={(e) => { setForm({ ...form, lateThresholdMin: Number(e.target.value) }); setIsDirty(true); }}
              className="w-full" />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>0분</span><span>30분</span><span>60분</span>
            </div>
          </div>

          <div>
            <label className="label">근무 요일</label>
            <div className="flex gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={clsx(
                    'h-9 w-9 rounded-full text-sm font-medium transition-colors',
                    form.workDays.includes(d.value)
                      ? 'bg-primary-500 text-white'
                      : 'bg-background border border-border text-text-secondary hover:bg-border',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate(form)}>저장</Button>
          </div>
        </div>
      </Card>

    </>
  );
}

// ── GPS 설정 섹션 ─────────────────────────────
function GpsSection() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    gpsEnabled: false, gpsLat: '', gpsLng: '',
    gpsRadiusM: 100, gpsStrictMode: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [locError, setLocError] = useState('');

  useUnsavedChanges(isDirty);

  const { data: settings } = useQuery({ queryKey: ['workspace'], queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; } });
  useEffect(() => {
    if (settings) {
      setForm({
        gpsEnabled:    settings.gpsEnabled ?? false,
        gpsLat:        settings.gpsLat?.toString() ?? '',
        gpsLng:        settings.gpsLng?.toString() ?? '',
        gpsRadiusM:    settings.gpsRadiusM ?? 100,
        gpsStrictMode: settings.gpsStrictMode ?? false,
      });
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/gps-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const getCurrentLocation = () => {
    setLocating(true);
    setLocError('');
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({ ...f, gpsLat: coords.latitude.toFixed(7), gpsLng: coords.longitude.toFixed(7) }));
        setIsDirty(true);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED ? '위치 권한이 거부되었습니다. 브라우저 설정을 확인하세요.' : '현재 위치를 가져오지 못했습니다.');
      },
      { timeout: 10000 },
    );
  };

  const handleSave = () => {
    setGpsError('');
    if (form.gpsEnabled && (form.gpsLat || form.gpsLng)) {
      const lat = parseFloat(form.gpsLat);
      const lng = parseFloat(form.gpsLng);
      if (isNaN(lat) || lat < -90 || lat > 90) { setGpsError('위도는 -90 ~ 90 사이의 값이어야 합니다.'); return; }
      if (isNaN(lng) || lng < -180 || lng > 180) { setGpsError('경도는 -180 ~ 180 사이의 값이어야 합니다.'); return; }
    }
    mutation.mutate({
      gpsEnabled: form.gpsEnabled,
      ...(form.gpsEnabled && form.gpsLat && form.gpsLng && {
        gpsLat: parseFloat(form.gpsLat),
        gpsLng: parseFloat(form.gpsLng),
        gpsRadiusM: form.gpsRadiusM,
        gpsStrictMode: form.gpsStrictMode,
      }),
    });
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all';

  return (
    <>
      <Card>
        <CardHeader title="GPS 출퇴근 설정" description="회사 위치를 등록하면 GPS 기반 출퇴근 검증이 활성화됩니다" />
        <div className="mt-4 space-y-5">
          {/* 활성화 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">GPS 출퇴근 활성화</p>
              <p className="text-xs text-text-secondary mt-0.5">반경 외 출퇴근 시 기록은 허용되며 플래그 처리됩니다</p>
            </div>
            <button
              onClick={() => { setForm((f) => ({ ...f, gpsEnabled: !f.gpsEnabled })); setIsDirty(true); }}
              className={clsx(
                'relative inline-flex h-6 w-11 rounded-full transition-colors',
                form.gpsEnabled ? 'bg-primary-500' : 'bg-border',
              )}
            >
              <span className={clsx(
                'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5',
                form.gpsEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          {form.gpsEnabled && (
            <>
              {/* 좌표 입력 */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-text-primary mb-1">위도</label>
                    <input value={form.gpsLat} onChange={(e) => { setForm({ ...form, gpsLat: e.target.value }); setIsDirty(true); }}
                      placeholder="37.5665" className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-text-primary mb-1">경도</label>
                    <input value={form.gpsLng} onChange={(e) => { setForm({ ...form, gpsLng: e.target.value }); setIsDirty(true); }}
                      placeholder="126.9780" className={inputCls} />
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={getCurrentLocation} loading={locating}>
                  <MapPin className="h-4 w-4 mr-1.5" />
                  현재 위치로 설정
                </Button>
                {locError && <p className="text-xs text-red-500">{locError}</p>}
                {gpsError && <p className="text-xs text-red-500">{gpsError}</p>}
                {!form.gpsLat && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">회사 위치가 등록되지 않으면 GPS 검증이 동작하지 않습니다.</p>
                  </div>
                )}
              </div>

              {/* 반경 슬라이더 */}
              <div>
                <label className="label">
                  허용 반경 <span className="font-bold text-primary-500">{form.gpsRadiusM}m</span>
                </label>
                <input type="range" min={50} max={500} step={25}
                  value={form.gpsRadiusM}
                  onChange={(e) => { setForm({ ...form, gpsRadiusM: Number(e.target.value) }); setIsDirty(true); }}
                  className="w-full" />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>50m (정밀)</span><span>500m (넓음)</span>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  💡 일반 사무실은 100m, 층고가 높거나 건물이 넓은 경우 200~300m를 권장합니다.
                  GPS 오차(~15m)를 고려해 최소 50m 이상으로 설정하세요.
                </p>
              </div>

              {/* 엄격 모드 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">반경 외 즉시 알림</p>
                  <p className="text-xs text-text-secondary mt-0.5">반경 밖에서 출퇴근 시 관리자에게 즉시 알림을 발송합니다</p>
                </div>
                <button
                  onClick={() => { setForm((f) => ({ ...f, gpsStrictMode: !f.gpsStrictMode })); setIsDirty(true); }}
                  className={clsx(
                    'relative inline-flex h-6 w-11 rounded-full transition-colors',
                    form.gpsStrictMode ? 'bg-orange-500' : 'bg-border',
                  )}
                >
                  <span className={clsx(
                    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5',
                    form.gpsStrictMode ? 'translate-x-5 ml-0.5' : 'translate-x-0.5',
                  )} />
                </button>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3">
            {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
            <Button size="sm" loading={mutation.isPending} onClick={handleSave}>저장</Button>
          </div>
        </div>
      </Card>

    </>
  );
}

// ── 알림 설정 섹션 ─────────────────────────────────
type NotifSettings = {
  emailApprovals: boolean;
  emailTasks: boolean;
  emailPayroll: boolean;
  emailTraining: boolean;
  pushRealtime: boolean;
  pushDeadline: boolean;
  quietStart: string;   // "HH:mm"
  quietEnd: string;
  quietEnabled: boolean;
};

const DEFAULT_NOTIF: NotifSettings = {
  emailApprovals: true,
  emailTasks: true,
  emailPayroll: false,
  emailTraining: true,
  pushRealtime: true,
  pushDeadline: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  quietEnabled: false,
};

function ToggleRow({
  label, sub, checked, onChange,
}: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        role="switch"
        className={clsx(
          'relative inline-flex h-6 w-11 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-primary-500' : 'bg-border',
        )}
      >
        <span className={clsx(
          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5',
          checked ? 'translate-x-5 ml-0.5' : 'translate-x-0.5',
        )} />
      </button>
    </div>
  );
}

// ── IT/스타트업 특화 설정 섹션 ───────────────────
function ItSettingsSection() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  const [form, setForm] = useState({
    lateNightExemptionEnabled: false,
    lateNightThresholdHour:    22,
    lateNightGraceMinutes:     60,
    overtimeApprovalRequired:  true,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        lateNightExemptionEnabled: settings.lateNightExemptionEnabled ?? false,
        lateNightThresholdHour:    settings.lateNightThresholdHour    ?? 22,
        lateNightGraceMinutes:     settings.lateNightGraceMinutes     ?? 60,
        overtimeApprovalRequired:  settings.overtimeApprovalRequired  ?? true,
      });
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/it-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('IT 특화 설정이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const toggle = (key: keyof typeof form) => {
    setForm((f) => ({ ...f, [key]: !f[key] }));
    setIsDirty(true);
  };

  const update = (key: keyof typeof form, val: number) => {
    setForm((f) => ({ ...f, [key]: val }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-primary">IT / 스타트업 특화 설정</h2>
        <p className="text-sm text-text-muted mt-0.5">52시간 관리, 재택 감지, 야근 면책, 연장근무 승인 흐름을 설정합니다.</p>
      </div>

      <Card>
        <CardHeader title="야근 다음날 지각 면책" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">면책 정책 활성화</p>
              <p className="text-xs text-text-muted mt-0.5">기준 시간 이후 퇴근 시 다음날 출근에 유예 시간을 부여합니다</p>
            </div>
            <button
              onClick={() => toggle('lateNightExemptionEnabled')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                form.lateNightExemptionEnabled ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', form.lateNightExemptionEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          {form.lateNightExemptionEnabled && (
            <div className="grid grid-cols-2 gap-4 pl-1">
              <div>
                <label className="label">야근 기준 시간</label>
                <select
                  className="input"
                  value={form.lateNightThresholdHour}
                  onChange={(e) => update('lateNightThresholdHour', Number(e.target.value))}
                >
                  {[18,19,20,21,22,23].map(h => (
                    <option key={h} value={h}>{h}시 이후 퇴근</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">유예 시간</label>
                <select
                  className="input"
                  value={form.lateNightGraceMinutes}
                  onChange={(e) => update('lateNightGraceMinutes', Number(e.target.value))}
                >
                  {[30, 60, 90, 120].map(m => (
                    <option key={m} value={m}>{m}분 유예</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            예) 기준 22시, 유예 60분 → 전날 22시 이후 퇴근 시, 다음날 출근 시간 + 60분 이내 출근은 지각 처리 안 함
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="연장근무 관리" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">사전 결재 승인 필수</p>
              <p className="text-xs text-text-muted mt-0.5">연장근무 신청 시 관리자 승인을 받아야 진행할 수 있습니다 (근로기준법 제53조)</p>
            </div>
            <button
              onClick={() => toggle('overtimeApprovalRequired')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                form.overtimeApprovalRequired ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', form.overtimeApprovalRequired ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            연장근무 신청은 출퇴근 페이지 → "초과근무 신청" 버튼에서 결재 기안으로 제출됩니다.
            주 52시간 위젯은 직원 본인도 실시간 확인할 수 있습니다.
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}

// ── 공공기관 설정 섹션 ────────────────────────────────
function PublicSectorSection() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  const [form, setForm] = useState({
    flexWorkEnabled:           false,
    annualLeaveForceEnabled:   false,
    annualLeaveForceThreshold: 5,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        flexWorkEnabled:           settings.flexWorkEnabled           ?? false,
        annualLeaveForceEnabled:   settings.annualLeaveForceEnabled   ?? false,
        annualLeaveForceThreshold: settings.annualLeaveForceThreshold ?? 5,
      });
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/public-sector-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('공공기관 설정이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const toggle = (key: 'flexWorkEnabled' | 'annualLeaveForceEnabled') => {
    setForm((f) => ({ ...f, [key]: !f[key] }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-primary">공공기관 / 준공무원 특화 설정</h2>
        <p className="text-sm text-text-muted mt-0.5">유연근무제 유형 기록, 연가 소진 알림 등을 설정합니다.</p>
      </div>

      <Card>
        <CardHeader title="유연근무제" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">유연근무제 활성화</p>
              <p className="text-xs text-text-muted mt-0.5">출근 시 유연근무 유형 선택 가능 (시차출퇴근·재량근무·집중근무)</p>
            </div>
            <button
              onClick={() => toggle('flexWorkEnabled')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                form.flexWorkEnabled ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', form.flexWorkEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
            <p><b>시차출퇴근</b>: 정해진 범위 내 본인이 출퇴근 시간 선택</p>
            <p><b>재량근무</b>: 업무 성격에 따라 근무 시간 재량 결정</p>
            <p><b>집중근무</b>: 특정 기간에 집중적으로 초과 근무 후 단축 적용</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="연가 사용 강제화 알림" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">연말 연가 소진 독촉 알림</p>
              <p className="text-xs text-text-muted mt-0.5">11/1, 12/1, 12/15에 잔여 연차 기준 이상인 직원에게 자동 발송</p>
            </div>
            <button
              onClick={() => toggle('annualLeaveForceEnabled')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                form.annualLeaveForceEnabled ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', form.annualLeaveForceEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          {form.annualLeaveForceEnabled && (
            <div>
              <label className="label">알림 기준 잔여 연차 (일)</label>
              <select
                className="input w-40"
                value={form.annualLeaveForceThreshold}
                onChange={(e) => { setForm((f) => ({ ...f, annualLeaveForceThreshold: Number(e.target.value) })); setIsDirty(true); }}
              >
                {[3, 5, 7, 10, 15].map(d => (
                  <option key={d} value={d}>{d}일 이상 남으면 알림</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">잔여 연차가 이 기준 이상인 직원에게 소진 독촉 알림을 발송합니다</p>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            출장/외부교육 신청은 휴가 신청 페이지에서 가능합니다. 승인 시 해당 날짜 근태가 자동으로 정상 처리됩니다.
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}

// ── 현장직/교대근무직 설정 섹션 ───────────────────────────────
function ShiftWorkerSection() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.get('/workspace').then(r => r.data.data),
  });

  const [form, setForm] = useState({
    shiftLongWorkThresholdHours: 12,
    nightWorkStartHour: 22,
    nightWorkEndHour: 6,
    nightPayRate: 1.5,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        shiftLongWorkThresholdHours: settings.shiftLongWorkThresholdHours ?? 12,
        nightWorkStartHour: settings.nightWorkStartHour ?? 22,
        nightWorkEndHour: settings.nightWorkEndHour ?? 6,
        nightPayRate: parseFloat(settings.nightPayRate ?? '1.5'),
      });
      setIsDirty(false);
    }
  }, [settings]);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/shift-worker-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('현장직 설정이 저장되었습니다.');
    },
    onError: () => toast.error('저장 실패'),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="연속 근무 경고 기준" />
        <div className="space-y-4">
          <div>
            <label className="label">연속 근무 경고 기준 시간</label>
            <select
              className="input w-40"
              value={form.shiftLongWorkThresholdHours}
              onChange={e => set('shiftLongWorkThresholdHours', Number(e.target.value))}
            >
              {[8, 10, 12, 14, 16].map(h => (
                <option key={h} value={h}>{h}시간</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">설정 시간 이상 연속 근무 시 자동으로 장시간 근무 플래그가 기록됩니다.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="야간 근무 시간 설정" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">야간 근무 시작 시간</label>
              <select
                className="input"
                value={form.nightWorkStartHour}
                onChange={e => set('nightWorkStartHour', Number(e.target.value))}
              >
                {[18, 19, 20, 21, 22, 23].map(h => (
                  <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">야간 근무 종료 시간</label>
              <select
                className="input"
                value={form.nightWorkEndHour}
                onChange={e => set('nightWorkEndHour', Number(e.target.value))}
              >
                {[4, 5, 6, 7, 8].map(h => (
                  <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-text-muted">현재 설정: {String(form.nightWorkStartHour).padStart(2,'0')}:00 ~ {String(form.nightWorkEndHour).padStart(2,'0')}:00 구간이 야간 근무로 집계됩니다.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="야간수당 배율" />
        <div className="space-y-2">
          <div>
            <label className="label">야간수당 배율</label>
            <select
              className="input w-40"
              value={form.nightPayRate}
              onChange={e => set('nightPayRate', parseFloat(e.target.value))}
            >
              {[1.0, 1.25, 1.5, 1.75, 2.0].map(r => (
                <option key={r} value={r}>{r}배</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-muted">야간 근무 시간에 적용되는 수당 배율입니다. 급여 정산 시 참조됩니다.</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}

// ── 파트타임 설정 섹션 ─────────────────────────────────────────────────────────
function PartTimeSection() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.get('/workspace').then(r => r.data.data),
  });

  const MIN_WAGE_2026 = 10030; // 2026년 최저시급 (원)

  const [form, setForm] = useState({
    partTimeRoundingUnit: 1,
    partTimeRoundingPolicy: 'floor',
    partTimeDeductionUnit: 1,
    workConfirmSmsEnabled: false,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        partTimeRoundingUnit:   settings.partTimeRoundingUnit   ?? 1,
        partTimeRoundingPolicy: settings.partTimeRoundingPolicy ?? 'floor',
        partTimeDeductionUnit:  settings.partTimeDeductionUnit  ?? 1,
        workConfirmSmsEnabled:  settings.workConfirmSmsEnabled  ?? false,
      });
      setIsDirty(false);
    }
  }, [settings]);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/part-time-settings', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('파트타임 설정이 저장되었습니다.');
    },
    onError: () => toast.error('저장 실패'),
  });

  // 설정값 기준 예시 계산
  const exampleMinutes = 67;
  const rounded = form.partTimeRoundingPolicy === 'floor'
    ? Math.floor(exampleMinutes / form.partTimeRoundingUnit) * form.partTimeRoundingUnit
    : form.partTimeRoundingPolicy === 'ceil'
    ? Math.ceil(exampleMinutes / form.partTimeRoundingUnit) * form.partTimeRoundingUnit
    : Math.round(exampleMinutes / form.partTimeRoundingUnit) * form.partTimeRoundingUnit;
  const exampleWage = Math.round(rounded / 60 * MIN_WAGE_2026);

  return (
    <div className="space-y-6">
      {/* 최저시급 안내 */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <b>2026년 최저시급: {MIN_WAGE_2026.toLocaleString()}원/시간</b> — 분 단위 임금은 이 기준 이상이어야 합니다.
        직원별 시급은 직원 정보 수정 화면에서 설정할 수 있습니다.
      </div>

      {/* 분 단위 반올림 정책 */}
      <Card>
        <CardHeader title="근무 시간 반올림 정책" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">반올림 단위</label>
              <select
                className="input"
                value={form.partTimeRoundingUnit}
                onChange={e => set('partTimeRoundingUnit', Number(e.target.value))}
              >
                {[1, 5, 10, 15, 30].map(u => (
                  <option key={u} value={u}>{u}분 단위</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">반올림 방식</label>
              <select
                className="input"
                value={form.partTimeRoundingPolicy}
                onChange={e => set('partTimeRoundingPolicy', e.target.value)}
              >
                <option value="floor">절사 (내림)</option>
                <option value="round">반올림</option>
                <option value="ceil">올림</option>
              </select>
            </div>
          </div>
          {form.partTimeRoundingUnit > 1 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              예시: {exampleMinutes}분 근무 → <b>{rounded}분</b> 인정 → 임금 약 <b>{exampleWage.toLocaleString()}원</b>
              <span className="text-blue-500 ml-1">(최저시급 기준)</span>
            </div>
          )}
        </div>
      </Card>

      {/* 지각/조퇴 차감 정책 */}
      <Card>
        <CardHeader title="지각·조퇴 차감 단위" />
        <div className="space-y-3">
          <div>
            <label className="label">차감 단위</label>
            <select
              className="input w-40"
              value={form.partTimeDeductionUnit}
              onChange={e => set('partTimeDeductionUnit', Number(e.target.value))}
            >
              {[1, 5, 10, 15].map(u => (
                <option key={u} value={u}>{u}분 단위</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-muted">
            예: {form.partTimeDeductionUnit}분 단위 설정 시 — 7분 지각 → {Math.ceil(7 / form.partTimeDeductionUnit) * form.partTimeDeductionUnit}분 차감
            / 3분 지각 → {Math.ceil(3 / form.partTimeDeductionUnit) * form.partTimeDeductionUnit}분 차감
          </p>
        </div>
      </Card>

      {/* 근무 확인 SMS */}
      <Card>
        <CardHeader title="근무 확인 문자 자동 발송" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">출퇴근 시 본인 확인 문자 발송</p>
              <p className="text-xs text-text-muted mt-0.5">출근/퇴근 시 직원 본인에게 근무 확인 SMS를 자동 발송합니다</p>
            </div>
            <button
              onClick={() => set('workConfirmSmsEnabled', !form.workConfirmSmsEnabled)}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                form.workConfirmSmsEnabled ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', form.workConfirmSmsEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
          {form.workConfirmSmsEnabled && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1">
              <p><b>발송 예시 (출근):</b> [관리왕] 2026-04-13 출근 확인 / 출근 시각: 09:02 / 본인이 아닌 경우 사업주에게 즉시 알려주세요.</p>
              <p><b>발송 예시 (퇴근):</b> [관리왕] 2026-04-13 퇴근 확인 / 퇴근 시각: 18:00 / 실 근무: 8h 48m / 오늘 임금: 88,264원</p>
              <p className="text-green-600">SMS 발송을 위해 Render 환경변수 SMS_PROVIDER, SMS_API_KEY 등 설정 필요</p>
            </div>
          )}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-text-muted">
            직원 전화번호가 등록된 경우에만 발송됩니다. 직원 정보에서 전화번호를 등록해주세요.
          </div>
        </div>
      </Card>

      {/* 주휴수당 안내 */}
      <Card>
        <CardHeader title="주휴수당 자동 알림" />
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-xs text-violet-800 space-y-1">
          <p>매주 월요일 오전, 전 주 근무 15시간 이상인 직원에게 주휴수당 발생 알림이 자동 발송됩니다.</p>
          <p><b>계산식:</b> 1일 평균 근무시간 × 시급 (근로기준법 제55조)</p>
          <p>예: 주 20시간 근무(5일), 시급 10,030원 → 주휴수당 약 {Math.round(4 * 10030).toLocaleString()}원</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate(form)} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}

// ── 현장 외근직 설정 섹션 ──────────────────────────────────────────────────
const FIELD_CAT_OPTIONS = [
  { value: 'customer',  label: '고객사' },
  { value: 'site',      label: '공사/현장' },
  { value: 'warehouse', label: '물류창고' },
  { value: 'office',    label: '협력사 사무소' },
  { value: 'other',     label: '기타' },
];

function FieldVisitSection() {
  const qc = useQueryClient();
  const [locations, setLocations] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editLoc, setEditLoc] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '', radiusM: '300', category: 'customer', note: '' });
  const [autoTaskEnabled, setAutoTaskEnabled] = useState(true);
  const [taskTitle, setTaskTitle] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);

  const { data: ws } = useQuery({ queryKey: ['workspace'], queryFn: async () => (await api.get('/workspace')).data.data });
  const { isLoading } = useQuery({
    queryKey: ['field-locations'],
    queryFn: async () => {
      const { data } = await api.get('/field-visits/locations', { params: { activeOnly: false } });
      setLocations(data.data ?? []);
      return data.data ?? [];
    },
  });

  useEffect(() => {
    if (ws) {
      setAutoTaskEnabled(ws.fieldVisitAutoTask ?? true);
      setTaskTitle(ws.fieldVisitTaskTitle ?? '');
    }
  }, [ws]);

  const resetForm = () => setForm({ name: '', address: '', lat: '', lng: '', radiusM: '300', category: 'customer', note: '' });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name:     form.name,
        address:  form.address || undefined,
        lat:      parseFloat(form.lat),
        lng:      parseFloat(form.lng),
        radiusM:  parseInt(form.radiusM),
        category: form.category,
        note:     form.note || undefined,
      };
      if (editLoc) {
        await api.patch(`/field-visits/locations/${editLoc.id}`, payload);
      } else {
        await api.post('/field-visits/locations', payload);
      }
    },
    onSuccess: () => {
      toast.success(editLoc ? '방문지가 수정됐습니다.' : '방문지가 추가됐습니다.');
      qc.invalidateQueries({ queryKey: ['field-locations'] });
      setShowAddModal(false);
      setEditLoc(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '저장 실패'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/field-visits/locations/${id}`),
    onSuccess: () => {
      toast.success('방문지가 삭제됐습니다.');
      qc.invalidateQueries({ queryKey: ['field-locations'] });
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/field-visits/locations/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-locations'] }),
  });

  const settingsMut = useMutation({
    mutationFn: async () => api.patch('/workspace/field-visit-settings', {
      fieldVisitAutoTask:  autoTaskEnabled,
      fieldVisitTaskTitle: taskTitle || null,
    }),
    onSuccess: () => { toast.success('설정이 저장됐습니다.'); setSettingsDirty(false); },
  });

  const openEdit = (loc: any) => {
    setEditLoc(loc);
    setForm({
      name: loc.name, address: loc.address ?? '', lat: String(loc.lat), lng: String(loc.lng),
      radiusM: String(loc.radiusM), category: loc.category, note: loc.note ?? '',
    });
    setShowAddModal(true);
  };

  const getGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(7), lng: p.coords.longitude.toFixed(7) }));
    });
  };

  return (
    <div className="space-y-5">
      {/* 업무 일지 자동 생성 설정 */}
      <Card>
        <CardHeader title="업무 일지 자동 생성" description="외근 체크인 시 업무 보고서(Task)를 자동으로 생성합니다." />
        <div className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">자동 생성 활성화</p>
              <p className="text-xs text-text-muted mt-0.5">체크인 직후 해당 직원의 업무 목록에 일지 Task가 생성됩니다</p>
            </div>
            <button onClick={() => { setAutoTaskEnabled(v => !v); setSettingsDirty(true); }}
              className={clsx('relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                autoTaskEnabled ? 'bg-primary-500' : 'bg-gray-200')}>
              <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200', autoTaskEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
          {autoTaskEnabled && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">제목 템플릿 (비워두면 기본값 사용)</label>
              <input type="text" value={taskTitle}
                onChange={e => { setTaskTitle(e.target.value); setSettingsDirty(true); }}
                placeholder="[외근 일지] {{location}} 방문"
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
              <p className="text-xs text-text-muted mt-1">{"{{location}}"} 은 방문지명으로 자동 치환됩니다.</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => settingsMut.mutate()} disabled={!settingsDirty || settingsMut.isPending}>
              {settingsMut.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 방문지 목록 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="등록 방문지 관리" description="외근직이 GPS 체크인할 때 선택 가능한 고객사·현장 목록입니다." />
          <Button size="sm" onClick={() => { resetForm(); setEditLoc(null); setShowAddModal(true); }}>
            + 방문지 추가
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : locations.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm">
            <MapPin className="h-7 w-7 mx-auto mb-2 opacity-30" />
            등록된 방문지가 없습니다. 추가 버튼을 눌러 방문지를 등록해보세요.
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition',
                loc.isActive ? 'border-border bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-text-primary">{loc.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {FIELD_CAT_OPTIONS.find(c => c.value === loc.category)?.label ?? loc.category}
                    </span>
                    <span className="text-xs text-text-muted">반경 {loc.radiusM}m</span>
                    {!loc.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">비활성</span>}
                  </div>
                  {loc.address && <p className="text-xs text-text-muted mt-0.5 truncate">{loc.address}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActiveMut.mutate({ id: loc.id, isActive: !loc.isActive })}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded">
                    {loc.isActive ? '비활성화' : '활성화'}
                  </button>
                  <button onClick={() => openEdit(loc)} className="text-xs text-primary-600 hover:underline px-2 py-1">수정</button>
                  <button onClick={() => deleteMut.mutate(loc.id)} className="text-xs text-red-500 hover:underline px-2 py-1">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 추가/수정 모달 */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setEditLoc(null); }}
        title={editLoc ? '방문지 수정' : '방문지 추가'}>
        <div className="space-y-3 p-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">장소명 *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예: (주)한빛솔루션 본사"
              className="w-full text-sm border border-border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">주소 (선택)</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="예: 서울 강남구 테헤란로 123"
              className="w-full text-sm border border-border rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">카테고리</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2">
                {FIELD_CAT_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">체크인 반경 (m)</label>
              <select value={form.radiusM} onChange={e => setForm(f => ({ ...f, radiusM: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2">
                {[50, 100, 200, 300, 500, 1000].map(r => <option key={r} value={r}>{r}m</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">GPS 좌표 *</label>
            <div className="flex gap-2">
              <input type="number" step="0.0000001" placeholder="위도" value={form.lat}
                onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2" />
              <input type="number" step="0.0000001" placeholder="경도" value={form.lng}
                onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2" />
              <Button size="sm" variant="secondary" onClick={getGps}>GPS</Button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">메모 (선택)</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2} className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" variant="secondary" onClick={() => setShowAddModal(false)}>취소</Button>
            <Button className="flex-1" onClick={() => saveMut.mutate()} loading={saveMut.isPending}
              disabled={!form.name || !form.lat || !form.lng}>
              {editLoc ? '수정 완료' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── 의료·돌봄직 설정 섹션 ──────────────────────────────────────────────────
function CareWorkerSection() {
  const qc = useQueryClient();
  const { data: ws } = useQuery({ queryKey: ['workspace'], queryFn: async () => (await api.get('/workspace')).data.data });

  const [form, setForm] = useState({
    careHolidayPayRate: 1.5,
    careFatigueThresholdHours: 52,
    careLicenseWarnDays: 30,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (ws) setForm({
      careHolidayPayRate:        ws.careHolidayPayRate        ?? 1.5,
      careFatigueThresholdHours: ws.careFatigueThresholdHours ?? 52,
      careLicenseWarnDays:       ws.careLicenseWarnDays       ?? 30,
    });
  }, [ws]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  };

  const mutation = useMutation({
    mutationFn: () => api.patch('/care-worker/settings', form),
    onSuccess: () => { toast.success('저장됐습니다.'); setIsDirty(false); qc.invalidateQueries({ queryKey: ['workspace'] }); },
    onError: () => toast.error('저장 실패'),
  });

  return (
    <div className="space-y-5">
      {/* 가산수당 설정 */}
      <Card>
        <CardHeader title="야간·휴일 가산수당" description="근로기준법 제56조: 야간·휴일 근무에 대한 가산수당 배율을 설정합니다." />
        <div className="space-y-4 mt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">휴일 가산수당 배율</label>
            <select value={form.careHolidayPayRate} onChange={e => set('careHolidayPayRate', parseFloat(e.target.value))}
              className="text-sm border border-border rounded-lg px-3 py-2">
              <option value={1.5}>×1.5 (법정 최저, 기본값)</option>
              <option value={1.8}>×1.8</option>
              <option value={2.0}>×2.0</option>
              <option value={2.5}>×2.5</option>
            </select>
            <p className="text-xs text-text-muted mt-1">일요일 및 법정공휴일 근무 시 적용. 야간(22:00~06:00) 겹칠 경우 높은 배율 자동 적용.</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
            <p><b>법정 공휴일 (2026년 기준):</b> 신정·설날·삼일절·어린이날·현충일·광복절·추석·개천절·한글날·성탄절 및 대체공휴일 포함</p>
            <p>일요일은 유급 휴일 기본 지정 (근로기준법 제55조)</p>
          </div>
        </div>
      </Card>

      {/* 피로도 경고 */}
      <Card>
        <CardHeader title="누적 피로도 경고" description="의료·돌봄직의 과로는 환자 안전과 직결됩니다. 주간 누적 근무 초과 시 자동 알림합니다." />
        <div className="space-y-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">주간 피로도 기준 (시간)</label>
            <select value={form.careFatigueThresholdHours} onChange={e => set('careFatigueThresholdHours', parseInt(e.target.value))}
              className="text-sm border border-border rounded-lg px-3 py-2">
              <option value={40}>40시간 (법정 기본)</option>
              <option value={48}>48시간</option>
              <option value={52}>52시간 (기본값)</option>
              <option value={56}>56시간</option>
              <option value={60}>60시간</option>
            </select>
            <p className="text-xs text-text-muted mt-1">초과 시 매주 월요일 해당 직원에게 자동 알림 발송</p>
          </div>
        </div>
      </Card>

      {/* 자격증 만료 경고 */}
      <Card>
        <CardHeader title="자격증 만료 사전 알림" description="간호사·요양보호사 등 면허 만료 전 자동으로 경고 알림을 발송합니다." />
        <div className="space-y-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">사전 경고 일수</label>
            <select value={form.careLicenseWarnDays} onChange={e => set('careLicenseWarnDays', parseInt(e.target.value))}
              className="text-sm border border-border rounded-lg px-3 py-2">
              <option value={7}>7일 전</option>
              <option value={14}>14일 전</option>
              <option value={30}>30일 전 (기본값)</option>
              <option value={60}>60일 전</option>
              <option value={90}>90일 전</option>
            </select>
            <p className="text-xs text-text-muted mt-1">매일 오전 9시 자동 체크. 동일 자격증에 25일 이내 중복 알림 방지 처리</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
            <p><b>지원 자격증:</b> 간호사·간호조무사·요양보호사·사회복지사·보육교사·물리치료사·작업치료사·방사선사·임상병리사·응급구조사·치위생사</p>
            <p>만료된 면허로 의료행위 시 의료법 제8조 위반 → 면허 취소·형사처벌 위험</p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}

function NotificationSection() {
  const { user } = useAuthStore();
  const storageKey = `notif_${user?.email ?? 'default'}`;

  const [settings, setSettings] = useState<NotifSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_NOTIF;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...DEFAULT_NOTIF, ...JSON.parse(saved) } : DEFAULT_NOTIF;
    } catch { return DEFAULT_NOTIF; }
  });
  const [isDirty, setIsDirty] = useState(false);

  const set = <K extends keyof NotifSettings>(key: K, value: NotifSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setIsDirty(false);
    toast.success('알림 설정이 저장되었습니다.', { id: 'notif-save' });
  };

  return (
    <>
      <Card>
        <CardHeader title="이메일 알림" description="중요 이벤트 발생 시 이메일로 알림을 받습니다." />
        <div className="mt-3">
          <ToggleRow
            label="결재 알림"
            sub="결재 요청, 승인, 반려 시 이메일 발송"
            checked={settings.emailApprovals}
            onChange={(v) => set('emailApprovals', v)}
          />
          <ToggleRow
            label="업무 알림"
            sub="업무 할당, 마감 임박 시 이메일 발송"
            checked={settings.emailTasks}
            onChange={(v) => set('emailTasks', v)}
          />
          <ToggleRow
            label="급여 명세서"
            sub="급여 명세서 발행 시 이메일 발송"
            checked={settings.emailPayroll}
            onChange={(v) => set('emailPayroll', v)}
          />
          <ToggleRow
            label="교육 알림"
            sub="교육 일정, 수료 알림 이메일 발송"
            checked={settings.emailTraining}
            onChange={(v) => set('emailTraining', v)}
          />
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="앱 내 알림" description="앱을 사용 중일 때 실시간으로 알림을 받습니다." />
        <div className="mt-3">
          <ToggleRow
            label="실시간 알림"
            sub="결재, 메시지, 댓글 등 즉시 알림"
            checked={settings.pushRealtime}
            onChange={(v) => set('pushRealtime', v)}
          />
          <ToggleRow
            label="마감 알림"
            sub="업무 마감 24시간 전 알림"
            checked={settings.pushDeadline}
            onChange={(v) => set('pushDeadline', v)}
          />
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="방해금지 시간" description="해당 시간대에는 알림을 발송하지 않습니다." />
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="방해금지 모드 활성화"
            checked={settings.quietEnabled}
            onChange={(v) => set('quietEnabled', v)}
          />
          {settings.quietEnabled && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="label">시작 시간</label>
                <input
                  type="time"
                  value={settings.quietStart}
                  onChange={(e) => set('quietStart', e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="label">종료 시간</label>
                <input
                  type="time"
                  value={settings.quietEnd}
                  onChange={(e) => set('quietEnd', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}
          <p className="text-xs text-text-muted">
            ※ 알림 설정은 현재 기기에 저장됩니다. 이메일 알림은 서버에서 발송되어 방해금지 시간이 적용되지 않습니다.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
          <Button size="sm" onClick={handleSave}>저장</Button>
        </div>
      </Card>
    </>
  );
}

// ── 브랜딩 섹션 (owner only) ─────────────────────
function BrandingSection() {
  const queryClient = useQueryClient();

  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageMobileUrl, setCoverImageMobileUrl] = useState<string | null>(null);
  const [coverMobileCrop, setCoverMobileCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [brandingTextColor, setBrandingTextColor] = useState('#FFFFFF');
  const [isDirty, setIsDirty] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  // 모바일 이미지 방식: 'crop' = 웹 이미지 영역 선택, 'upload' = 별도 이미지 업로드
  const [mobileMode, setMobileMode] = useState<'crop' | 'upload'>('crop');

  useUnsavedChanges(isDirty);

  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  useEffect(() => {
    if (settings) {
      setCoverImageUrl(settings.coverImageUrl ?? null);
      setCoverImageMobileUrl(settings.coverImageMobileUrl ?? null);
      setCoverMobileCrop(settings.coverMobileCrop ?? null);
      setBrandingTextColor(settings.brandingTextColor ?? '#FFFFFF');
      // 별도 모바일 이미지가 있으면 upload 모드로
      if (settings.coverImageMobileUrl && settings.coverImageMobileUrl !== settings.coverImageUrl) {
        setMobileMode('upload');
      }
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (payload: any) => api.patch('/workspace/branding', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
  });

  const handleSave = () => {
    mutation.mutate({
      coverImageUrl: coverImageUrl ?? null,
      coverImageMobileUrl: coverImageMobileUrl ?? null,
      coverMobileCrop: coverMobileCrop ?? null,
      brandingTextColor,
    });
  };

  return (
    <>
      <Card>
        <CardHeader title="브랜딩 & 커버 이미지" description="대시보드 상단에 표시되는 커버 이미지를 설정합니다" />
        <div className="mt-5 space-y-6">

          {/* 웹 커버 이미지 */}
          <div>
            <label className="label mb-1.5">웹 커버 이미지 <span className="text-text-muted font-normal">(권장: 1920 × 400px)</span></label>
            <ImageUploader
              currentUrl={coverImageUrl}
              onUpload={(url) => { setCoverImageUrl(url); setIsDirty(true); }}
              feature="covers"
              shape="cover"
              fallback="커버 이미지 업로드"
            />
          </div>

          {/* 모바일 커버 이미지 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label flex items-center gap-1.5 mb-0">
                <Smartphone className="h-4 w-4" />
                모바일 커버
              </label>
              {/* 방식 전환 토글 */}
              <div className="flex gap-0.5 bg-background border border-border rounded-lg p-0.5">
                {([
                  { key: 'crop', label: '영역 선택' },
                  { key: 'upload', label: '별도 업로드' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setMobileMode(key);
                      // 모드 전환 시 반대쪽 데이터 초기화
                      if (key === 'crop') { setCoverImageMobileUrl(null); }
                      else { setCoverMobileCrop(null); }
                      setIsDirty(true);
                    }}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      mobileMode === key
                        ? 'bg-white shadow-sm text-text-primary'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 방식 A: 웹 이미지에서 영역 크롭 선택 */}
            {mobileMode === 'crop' && coverImageUrl && (
              <div className="flex items-center gap-3">
                <div
                  className="relative rounded-xl overflow-hidden bg-slate-100 border border-border"
                  style={{ width: 195, height: 130 }}
                >
                  <img
                    src={coverImageUrl}
                    alt="커버 미리보기"
                    className="w-full h-full object-cover"
                    style={coverMobileCrop ? {
                      objectFit: 'none',
                      objectPosition: `-${coverMobileCrop.x * 100}% -${coverMobileCrop.y * 100}%`,
                    } : {}}
                  />
                  {!coverMobileCrop && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <p className="text-white text-xs">영역 미지정</p>
                    </div>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowCropModal(true)}>
                  <Smartphone className="h-4 w-4 mr-1.5" />
                  영역 설정
                </Button>
              </div>
            )}
            {mobileMode === 'crop' && !coverImageUrl && (
              <p className="text-xs text-text-muted">웹 커버 이미지를 먼저 업로드하세요.</p>
            )}

            {/* 방식 B: 별도 모바일 전용 이미지 업로드 */}
            {mobileMode === 'upload' && (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">모바일 앱에만 표시되는 별도 이미지입니다. (권장: 1080 × 400px)</p>
                <ImageUploader
                  currentUrl={coverImageMobileUrl}
                  onUpload={(url) => { setCoverImageMobileUrl(url); setIsDirty(true); }}
                  feature="covers"
                  shape="cover"
                  fallback="모바일 커버 이미지 업로드"
                />
                {coverImageMobileUrl && (
                  <button
                    type="button"
                    onClick={() => { setCoverImageMobileUrl(null); setIsDirty(true); }}
                    className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2 transition-colors"
                  >
                    모바일 이미지 삭제
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 텍스트 색상 */}
          <div>
            <label className="label mb-1.5">커버 텍스트 색상</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandingTextColor}
                onChange={(e) => { setBrandingTextColor(e.target.value); setIsDirty(true); }}
                className="h-9 w-16 rounded-lg border border-border cursor-pointer"
              />
              <span className="text-sm text-text-secondary font-mono">{brandingTextColor}</span>
              <div className="flex gap-2">
                {['#FFFFFF', '#1E293B', '#F1F5F9'].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setBrandingTextColor(c); setIsDirty(true); }}
                    className="h-7 w-7 rounded-full border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 미리보기 */}
          {coverImageUrl && (
            <div>
              <label className="label mb-1.5">미리보기</label>
              <div
                className="relative w-full h-28 rounded-xl overflow-hidden"
                style={{ backgroundImage: `url(${coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
                <div className="absolute bottom-3 left-4" style={{ color: brandingTextColor }}>
                  <p className="text-sm font-bold">{settings?.name ?? '회사명'}</p>
                  <p className="text-xs opacity-80">대시보드</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
            <Button size="sm" loading={mutation.isPending} onClick={handleSave}>저장</Button>
          </div>
        </div>
      </Card>

      {/* 크롭 모달 */}
      {showCropModal && coverImageUrl && (
        <CoverCropModal
          webImageUrl={coverImageUrl}
          initialCrop={coverMobileCrop}
          onConfirm={(crop, mobileUrl) => {
            setCoverMobileCrop(crop);
            setCoverImageMobileUrl(mobileUrl);
            setIsDirty(true);
            setShowCropModal(false);
          }}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </>
  );
}

// ── 출퇴근 방식 설정 섹션 ────────────────────────
function AttendanceMethodsSection() {
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState<AttendanceMethod[]>(['manual']);
  const [wifiSsids, setWifiSsids] = useState('');   // comma-separated
  const [qrWindow, setQrWindow] = useState(5);
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  const { data: settings } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  useEffect(() => {
    if (settings?.attendanceMethods) {
      const m = settings.attendanceMethods;
      setEnabled(m.enabled ?? ['manual']);
      setWifiSsids((m.wifi?.ssids ?? []).join(', '));
      setQrWindow(m.qr?.windowMinutes ?? 5);
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (p: any) => api.patch('/workspace/attendance-methods', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setIsDirty(false);
      toast.success('저장되었습니다.', { id: 'settings-save' });
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const toggleMethod = (m: AttendanceMethod) => {
    setEnabled((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
    setIsDirty(true);
  };

  const handleSave = () => {
    if (enabled.length === 0) { toast.error('최소 1개 이상의 방식을 선택해야 합니다.'); return; }
    const ssids = wifiSsids.split(',').map((s) => s.trim()).filter(Boolean);
    if (enabled.includes('wifi') && ssids.length === 0) {
      toast.error('WiFi 방식을 사용하려면 허용 SSID를 하나 이상 입력해야 합니다.'); return;
    }
    mutation.mutate({
      enabled,
      ...(enabled.includes('wifi') && { wifi: { ssids } }),
      ...(enabled.includes('qr')   && { qr: { windowMinutes: qrWindow } }),
    });
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all';

  return (
    <Card>
      <CardHeader
        title="출퇴근 방식 설정"
        description="사용할 출퇴근 방식을 선택하세요. 여러 방식을 동시에 활성화할 수 있으며, 먼저 처리된 방식이 기록됩니다."
      />
      <div className="p-6 space-y-5">
        {/* 방식 선택 */}
        <div className="space-y-3">
          {ALL_METHODS.map(({ value, label, desc }) => {
            const checked = enabled.includes(value);
            return (
              <label
                key={value}
                className={clsx(
                  'flex items-start gap-3 p-3.5 rounded-xl border-[1.5px] cursor-pointer transition-all',
                  checked ? 'border-primary-400 bg-primary-50' : 'border-border hover:border-primary-200',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMethod(value)}
                  className="mt-0.5 h-4 w-4 rounded text-primary-500 focus:ring-primary-400"
                />
                <div>
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* WiFi SSID 설정 */}
        {enabled.includes('wifi') && (
          <div className="space-y-1.5 p-4 rounded-xl bg-blue-50 border border-blue-100">
            <label className="text-sm font-medium text-text-primary">허용 WiFi SSID</label>
            <input
              type="text"
              className={inputCls}
              placeholder="사무실WiFi, 본사5G (쉼표로 구분)"
              value={wifiSsids}
              onChange={(e) => { setWifiSsids(e.target.value); setIsDirty(true); }}
            />
            <p className="text-xs text-text-muted">
              사내 WiFi SSID를 쉼표로 구분하여 입력하세요.<br />
              iOS에서는 위치 권한 및 특수 앱 등록이 필요할 수 있습니다.
            </p>
          </div>
        )}

        {/* QR 토큰 유효 시간 설정 */}
        {enabled.includes('qr') && (
          <div className="space-y-1.5 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <label className="text-sm font-medium text-text-primary">QR 코드 갱신 주기 (분)</label>
            <input
              type="number"
              className={inputCls}
              min={1} max={60}
              value={qrWindow}
              onChange={(e) => { setQrWindow(Number(e.target.value)); setIsDirty(true); }}
            />
            <p className="text-xs text-text-muted">
              설정한 주기마다 QR 코드가 자동 갱신됩니다. 짧을수록 보안이 강화됩니다.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={mutation.isPending} disabled={!isDirty}>
            저장
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── 지점 관리 섹션 (owner only) ──────────────────
function LocationsSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [showEmployees, setShowEmployees] = useState<string | null>(null); // locationId
  const [form, setForm] = useState({ name: '', address: '', phone: '', note: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => { const { data } = await api.get('/locations'); return data.data ?? data; },
  });

  const { data: empData } = useQuery({
    queryKey: ['location-employees', showEmployees],
    queryFn: async () => {
      if (!showEmployees) return [];
      const { data } = await api.get(`/locations/${showEmployees}/employees`);
      return data.data ?? data;
    },
    enabled: !!showEmployees,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get('/users?limit=200');
      return data.data?.users ?? data.data ?? [];
    },
    enabled: !!showEmployees,
  });

  const createMut = useMutation({
    mutationFn: (p: any) => api.post('/locations', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowCreate(false);
      setForm({ name: '', address: '', phone: '', note: '' });
      toast.success('지점이 추가되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '저장 실패'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...p }: any) => api.patch(`/locations/${id}`, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setEditTarget(null);
      toast.success('수정되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '저장 실패'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('지점이 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제 실패'),
  });

  const assignMut = useMutation({
    mutationFn: ({ locationId, userId, isPrimary }: any) =>
      api.post(`/locations/${locationId}/employees`, { userId, isPrimary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-employees', showEmployees] });
      toast.success('직원이 배정되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '배정 실패'),
  });

  const unassignMut = useMutation({
    mutationFn: ({ locationId, userId }: any) =>
      api.delete(`/locations/${locationId}/employees/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-employees', showEmployees] });
      toast.success('배정이 해제되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '해제 실패'),
  });

  const locations: any[] = data?.locations ?? [];
  const quota: number = data?.quota ?? 1;
  const activeCount: number = data?.activeCount ?? 0;
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary-500';

  const assignedIds = new Set((empData ?? []).map((e: any) => e.id));
  const unassignedUsers = (allUsers ?? []).filter((u: any) => !assignedIds.has(u.id));

  return (
    <>
      {/* 한도 안내 */}
      <Card className="mb-4">
        <CardHeader
          title="지점 관리"
          description="여러 사업장(지점)을 등록하고 직원을 배정할 수 있습니다. 근무표도 지점별로 구분하여 생성할 수 있습니다."
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">사용 중</span>
            <span className="font-bold text-text-primary">{activeCount} / {quota}개</span>
            {activeCount >= quota && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                한도 도달 — 추가 지점 애드온을 구매하세요
              </span>
            )}
          </div>
          {activeCount < quota && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              지점 추가
            </Button>
          )}
        </div>
        {activeCount >= quota && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            추가 지점(+1개)은 월 ₩9,900입니다.
            <a href="/settings?tab=billing" className="ml-2 underline font-semibold">구독 관리 →</a>
          </div>
        )}
      </Card>

      {/* 지점 목록 */}
      {isLoading ? (
        <div className="text-sm text-text-muted py-8 text-center">불러오는 중...</div>
      ) : locations.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-text-muted text-sm">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
            등록된 지점이 없습니다
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {locations.map((loc: any) => (
            <Card key={loc.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{loc.name}</span>
                    {!loc.isActive && (
                      <span className="text-xs text-text-muted bg-gray-100 px-1.5 py-0.5 rounded">비활성</span>
                    )}
                  </div>
                  {loc.address && <p className="text-xs text-text-muted mt-0.5">{loc.address}</p>}
                  {loc.phone && <p className="text-xs text-text-muted">{loc.phone}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => setShowEmployees(showEmployees === loc.id ? null : loc.id)}
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    직원
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => {
                      setEditTarget(loc);
                      setForm({ name: loc.name, address: loc.address ?? '', phone: loc.phone ?? '', note: loc.note ?? '' });
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => {
                      if (confirm(`"${loc.name}" 지점을 삭제하시겠습니까?`)) deleteMut.mutate(loc.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* 직원 배정 패널 */}
              {showEmployees === loc.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-semibold text-text-secondary mb-2">배정된 직원</p>
                  {(empData ?? []).length === 0 ? (
                    <p className="text-xs text-text-muted mb-3">배정된 직원이 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {(empData ?? []).map((emp: any) => (
                        <div key={emp.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            {emp.isPrimary && (
                              <span className="text-xs text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded">주 근무지</span>
                            )}
                            <span className="text-xs text-text-muted">{emp.department ?? ''} {emp.position ?? ''}</span>
                          </div>
                          <button
                            onClick={() => unassignMut.mutate({ locationId: loc.id, userId: emp.id })}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            해제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {unassignedUsers.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-secondary mb-1.5">직원 추가</p>
                      <div className="flex flex-wrap gap-1.5">
                        {unassignedUsers.slice(0, 10).map((u: any) => (
                          <button
                            key={u.id}
                            onClick={() => assignMut.mutate({ locationId: loc.id, userId: u.id, isPrimary: false })}
                            className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-600 rounded-full px-2.5 py-1 transition-colors"
                          >
                            <UserPlus className="h-3 w-3" />
                            {u.name}
                          </button>
                        ))}
                        {unassignedUsers.length > 10 && (
                          <span className="text-xs text-text-muted self-center">외 {unassignedUsers.length - 10}명</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 지점 추가 모달 */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setForm({ name: '', address: '', phone: '', note: '' }); }}
        title="지점 추가"
      >
        <div className="space-y-3 p-4">
          <div>
            <label className="label mb-1">지점명 *</label>
            <input className={inputCls} placeholder="예: 강남점" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">주소</label>
            <input className={inputCls} placeholder="서울시 강남구..." value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">연락처</label>
            <input className={inputCls} placeholder="02-1234-5678" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">메모</label>
            <textarea className={inputCls} rows={2} placeholder="내부 메모" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>취소</Button>
            <Button
              onClick={() => createMut.mutate({ name: form.name, address: form.address || undefined, phone: form.phone || undefined, note: form.note || undefined })}
              loading={createMut.isPending}
              disabled={!form.name.trim()}
            >
              추가
            </Button>
          </div>
        </div>
      </Modal>

      {/* 지점 수정 모달 */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="지점 수정"
      >
        <div className="space-y-3 p-4">
          <div>
            <label className="label mb-1">지점명 *</label>
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">주소</label>
            <input className={inputCls} value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">연락처</label>
            <input className={inputCls} value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-1">메모</label>
            <textarea className={inputCls} rows={2} value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          {editTarget && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="loc-active" checked={editTarget.isActive}
                onChange={e => setEditTarget((t: any) => ({ ...t, isActive: e.target.checked }))} />
              <label htmlFor="loc-active" className="text-sm">활성 지점</label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>취소</Button>
            <Button
              onClick={() => updateMut.mutate({ id: editTarget.id, name: form.name, address: form.address || null, phone: form.phone || null, note: form.note || null, isActive: editTarget.isActive })}
              loading={updateMut.isPending}
              disabled={!form.name.trim()}
            >
              저장
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── 메인 설정 페이지 ─────────────────────────────
export default function SettingsPage() {
  usePageTitle('설정');
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Section | null;
  const [section, setSection] = useState<Section>(tabParam ?? 'profile');

  // URL 쿼리 변경 시 탭 동기화
  useEffect(() => {
    if (tabParam) setSection(tabParam);
  }, [tabParam]);

  const isOwner = user?.role === 'owner';

  const allMenus: { key: Section; label: string; icon: any; ownerOnly?: boolean; disabled?: boolean }[] = [
    { key: 'profile',      label: '내 프로필',   icon: User },
    { key: 'company',      label: '회사 정보',   icon: Building2, ownerOnly: true },
    { key: 'branding',     label: '브랜딩',      icon: Image,     ownerOnly: true },
    { key: 'work',         label: '근무 설정',   icon: Clock,     ownerOnly: true },
    { key: 'gps',                label: 'GPS 설정',      icon: MapPin,       ownerOnly: true },
    { key: 'attendance-methods', label: '출퇴근 방식',   icon: Smartphone,   ownerOnly: true },
    { key: 'it-settings',        label: 'IT 특화 설정',  icon: Laptop,        ownerOnly: true },
    { key: 'public-sector',      label: '공공기관 설정', icon: LandmarkIcon,  ownerOnly: true },
    { key: 'shift-worker',       label: '현장직 설정',   icon: HardHat,        ownerOnly: true },
    { key: 'part-time',          label: '파트타임 설정', icon: ShoppingBag,    ownerOnly: true },
    { key: 'field-visit',        label: '현장 외근 설정', icon: Navigation,    ownerOnly: true },
    { key: 'care-worker',        label: '의료·돌봄 설정', icon: HeartPulse,    ownerOnly: true },
    { key: 'locations',          label: '지점 관리',     icon: GitBranch,     ownerOnly: true },
    { key: 'notification',       label: '알림 설정',     icon: Bell },
  ];
  const menus = allMenus.filter((m) => !m.ownerOnly || isOwner);

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-4 md:p-6">
        {/* 모바일: 상단 수평 스크롤 탭 / PC: 좌측 세로 메뉴 */}
        <div className="flex flex-col md:flex-row md:gap-6 max-w-4xl">

          {/* ── 모바일 상단 탭 (md 미만) ── */}
          <div className="md:hidden mb-4">
            <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {menus.map(({ key, label, icon: Icon, disabled }) => (
                <button
                  key={key}
                  onClick={() => !disabled && setSection(key)}
                  disabled={disabled}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors',
                    disabled
                      ? 'text-text-muted cursor-not-allowed bg-gray-50'
                      : section === key
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-white border border-border text-text-secondary hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── PC 좌측 메뉴 (md 이상) ── */}
          <div className="hidden md:block w-44 flex-shrink-0">
            <nav className="space-y-0.5">
              {menus.map(({ key, label, icon: Icon, disabled }) => (
                <button
                  key={key}
                  onClick={() => !disabled && setSection(key)}
                  disabled={disabled}
                  className={clsx(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                    disabled
                      ? 'text-text-muted cursor-not-allowed'
                      : section === key
                        ? 'bg-primary-50 text-primary-500'
                        : 'text-text-secondary hover:bg-background',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {disabled && <span className="text-xs text-text-muted">준비 중</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {section === 'profile'            && <ProfileSection />}
            {section === 'company'            && <CompanySection />}
            {section === 'branding'           && <BrandingSection />}
            {section === 'work'               && <WorkSection />}
            {section === 'gps'                && <GpsSection />}
            {section === 'attendance-methods' && <AttendanceMethodsSection />}
            {section === 'it-settings'        && <ItSettingsSection />}
            {section === 'public-sector'      && <PublicSectorSection />}
            {section === 'shift-worker'       && <ShiftWorkerSection />}
            {section === 'part-time'          && <PartTimeSection />}
            {section === 'field-visit'        && <FieldVisitSection />}
            {section === 'care-worker'        && <CareWorkerSection />}
            {section === 'locations'          && <LocationsSection />}
            {section === 'notification'       && <NotificationSection />}
          </div>
        </div>
      </main>
    </div>
  );
}
