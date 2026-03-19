'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Building2, Clock, MapPin, Bell,
  Eye, EyeOff, Check, AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import ImageUploader from '@/components/ui/ImageUploader';

type Section = 'profile' | 'company' | 'work' | 'gps' | 'notification';

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
          <li key={label} className={clsx('flex items-center gap-1.5 text-xs', ok ? 'text-green-600' : 'text-gray-400')}>
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

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

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
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">{user?.role === 'owner' ? '대표' : user?.role === 'manager' ? '관리자' : '직원'}</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

    </>
  );
}

// ── 회사 정보 섹션 ─────────────────────────────
function CompanySection() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', industry: '', phone: '', address: '' });
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

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <Card>
        <CardHeader title="회사 정보" />
        <div className="mt-4 space-y-4">
          {/* 회사 로고 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">회사 로고</label>
            <ImageUploader
              currentUrl={logoUrl}
              onUpload={(url) => { setLogoUrl(url); setIsDirty(true); }}
              feature="logo"
              shape="rect"
              fallback={form.name.charAt(0) || '로고'}
            />
          </div>
          {[
            { key: 'name', label: '회사명', required: true },
            { key: 'industry', label: '업종' },
            { key: 'phone', label: '대표 전화' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
              <input value={form[key as keyof typeof form]}
                onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setIsDirty(true); }}
                className={inputCls} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">주소</label>
            <textarea rows={2} value={form.address}
              onChange={(e) => { setForm({ ...form, address: e.target.value }); setIsDirty(true); }}
              className={inputCls} />
          </div>
          <div className="flex items-center justify-end gap-3">
            {isDirty && <span className="text-xs text-amber-600">저장되지 않은 변경사항이 있습니다</span>}
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({ ...form, logoUrl: logoUrl ?? undefined })}>
              저장
            </Button>
          </div>
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

  const inputCls = 'px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <Card>
        <CardHeader title="근무 설정" description="기본 근무 시간 및 요일을 설정합니다" />
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">출근 시간</label>
              <input type="time" value={form.workStartTime}
                onChange={(e) => { setForm({ ...form, workStartTime: e.target.value }); setIsDirty(true); }}
                className={inputCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">퇴근 시간</label>
              <input type="time" value={form.workEndTime}
                onChange={(e) => { setForm({ ...form, workEndTime: e.target.value }); setIsDirty(true); }}
                className={inputCls + ' w-full'} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              지각 허용 시간 <span className="font-normal text-gray-400">({form.lateThresholdMin}분)</span>
            </label>
            <input type="range" min={0} max={60} step={5}
              value={form.lateThresholdMin}
              onChange={(e) => { setForm({ ...form, lateThresholdMin: Number(e.target.value) }); setIsDirty(true); }}
              className="w-full" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0분</span><span>30분</span><span>60분</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">근무 요일</label>
            <div className="flex gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={clsx(
                    'h-9 w-9 rounded-full text-sm font-medium transition-colors',
                    form.workDays.includes(d.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
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

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <>
      <Card>
        <CardHeader title="GPS 출퇴근 설정" description="회사 위치를 등록하면 GPS 기반 출퇴근 검증이 활성화됩니다" />
        <div className="mt-4 space-y-5">
          {/* 활성화 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">GPS 출퇴근 활성화</p>
              <p className="text-xs text-gray-500 mt-0.5">반경 외 출퇴근 시 기록은 허용되며 플래그 처리됩니다</p>
            </div>
            <button
              onClick={() => { setForm((f) => ({ ...f, gpsEnabled: !f.gpsEnabled })); setIsDirty(true); }}
              className={clsx(
                'relative inline-flex h-6 w-11 rounded-full transition-colors',
                form.gpsEnabled ? 'bg-blue-600' : 'bg-gray-200',
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">위도</label>
                    <input value={form.gpsLat} onChange={(e) => { setForm({ ...form, gpsLat: e.target.value }); setIsDirty(true); }}
                      placeholder="37.5665" className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">경도</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  허용 반경 <span className="font-bold text-blue-600">{form.gpsRadiusM}m</span>
                </label>
                <input type="range" min={50} max={500} step={25}
                  value={form.gpsRadiusM}
                  onChange={(e) => { setForm({ ...form, gpsRadiusM: Number(e.target.value) }); setIsDirty(true); }}
                  className="w-full" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50m (정밀)</span><span>500m (넓음)</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  💡 일반 사무실은 100m, 층고가 높거나 건물이 넓은 경우 200~300m를 권장합니다.
                  GPS 오차(~15m)를 고려해 최소 50m 이상으로 설정하세요.
                </p>
              </div>

              {/* 엄격 모드 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">반경 외 즉시 알림</p>
                  <p className="text-xs text-gray-500 mt-0.5">반경 밖에서 출퇴근 시 관리자에게 즉시 알림을 발송합니다</p>
                </div>
                <button
                  onClick={() => { setForm((f) => ({ ...f, gpsStrictMode: !f.gpsStrictMode })); setIsDirty(true); }}
                  className={clsx(
                    'relative inline-flex h-6 w-11 rounded-full transition-colors',
                    form.gpsStrictMode ? 'bg-orange-500' : 'bg-gray-200',
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

// ── 메인 설정 페이지 ─────────────────────────────
export default function SettingsPage() {
  usePageTitle('설정');
  const { user } = useAuthStore();
  const [section, setSection] = useState<Section>('profile');

  const isOwner = user?.role === 'owner';

  const allMenus: { key: Section; label: string; icon: any; ownerOnly?: boolean; disabled?: boolean }[] = [
    { key: 'profile',      label: '내 프로필',   icon: User },
    { key: 'company',      label: '회사 정보',   icon: Building2, ownerOnly: true },
    { key: 'work',         label: '근무 설정',   icon: Clock,     ownerOnly: true },
    { key: 'gps',          label: 'GPS 설정',    icon: MapPin,    ownerOnly: true },
    { key: 'notification', label: '알림 설정',   icon: Bell,      disabled: true },
  ];
  const menus = allMenus.filter((m) => !m.ownerOnly || isOwner);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="설정" />

      <main className="p-6">
        <div className="flex gap-6 max-w-4xl">
          {/* 좌측 메뉴 */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-0.5">
              {menus.map(({ key, label, icon: Icon, disabled }) => (
                <button
                  key={key}
                  onClick={() => !disabled && setSection(key)}
                  disabled={disabled}
                  className={clsx(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : section === key
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {disabled && <span className="text-xs text-gray-300">준비 중</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* 우측 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {section === 'profile'      && <ProfileSection />}
            {section === 'company'      && <CompanySection />}
            {section === 'work'         && <WorkSection />}
            {section === 'gps'          && <GpsSection />}
            {section === 'notification' && (
              <Card>
                <CardHeader title="알림 설정" description="준비 중입니다" />
                <p className="text-sm text-gray-400 mt-4">알림 시스템 구현 후 활성화됩니다.</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
