'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Plus, Pencil, Trash2, X, Check, RefreshCw, Eye, EyeOff,
  SlidersHorizontal, CalendarDays, Bell, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { clsx } from 'clsx';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface RecurringEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  department: string | null;
  color: string | null;
  recurrenceType: string;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  monthOfYear: number[] | null;
  notifyBeforeDays: number[];
  notifyEmails: string[];
  notifyByPush: boolean;
  isActive: boolean;
}

interface DeptTemplate {
  key: string;
  name: string;
  emoji: string;
  visible: string[] | 'all';
  hasRecurringEvents: boolean;
}

interface UpcomingEvent {
  id: string;
  title: string;
  category: string;
  color: string | null;
  department: string | null;
  date: string;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  payroll:  { label: '급여',   color: 'bg-green-100 text-green-700' },
  tax:      { label: '세금',   color: 'bg-red-100 text-red-700' },
  report:   { label: '보고',   color: 'bg-blue-100 text-blue-700' },
  meeting:  { label: '회의',   color: 'bg-purple-100 text-purple-700' },
  deadline: { label: '마감',   color: 'bg-orange-100 text-orange-700' },
  custom:   { label: '기타',   color: 'bg-gray-100 text-gray-700' },
};

const RECURRENCE_LABELS: Record<string, string> = {
  monthly:   '매월',
  weekly:    '매주',
  quarterly: '분기별',
  yearly:    '매년',
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const PAGE_LABELS: Record<string, string> = {
  '/': '대시보드', '/attendance': '출퇴근', '/vacations': '휴가 관리',
  '/calendar': '캘린더', '/tasks': '업무 관리', '/tasks/reports': '업무 보고',
  '/schedule': '스케줄', '/shift-schedule': '팀 근무표', '/messages': '메시지',
  '/team': '직원 관리', '/team/notes': '인사 노트', '/team/stats': '조직 통계',
  '/salary': '급여 관리', '/contracts': '계약 관리', '/approvals': '전자결재',
  '/certificates': '증명서 발급', '/evaluations': '인사평가', '/training': '교육 관리',
  '/tax-documents': '세무·노무 서류', '/ai': 'AI 도구',
  '/settings': '설정', '/calendar-settings': '캘린더 설정',
};

const ALL_PAGES = Object.keys(PAGE_LABELS);

// ─── 반복 일정 폼 모달 ────────────────────────────────────────────────────────
function RecurringEventModal({
  open, onClose, existing, users,
}: {
  open: boolean;
  onClose: () => void;
  existing?: RecurringEvent | null;
  users: any[];
}) {
  const qc = useQueryClient();
  const [title, setTitle]               = useState(existing?.title ?? '');
  const [description, setDescription]   = useState(existing?.description ?? '');
  const [category, setCategory]         = useState(existing?.category ?? 'custom');
  const [department, setDepartment]     = useState(existing?.department ?? '');
  const [color, setColor]               = useState(existing?.color ?? '#2563EB');
  const [recurrenceType, setRecType]    = useState(existing?.recurrenceType ?? 'monthly');
  const [dayOfMonth, setDayOfMonth]     = useState(existing?.dayOfMonth ?? 25);
  const [dayOfWeek, setDayOfWeek]       = useState(existing?.dayOfWeek ?? 1);
  const [monthsSelected, setMonths]     = useState<number[]>(existing?.monthOfYear ?? []);
  const [notifyDays, setNotifyDays]     = useState<number[]>(existing?.notifyBeforeDays ?? [3]);
  const [emails, setEmails]             = useState(existing?.notifyEmails?.join('\n') ?? '');
  const [notifyPush, setNotifyPush]     = useState(existing?.notifyByPush ?? true);
  const [isActive, setIsActive]         = useState(existing?.isActive ?? true);

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))] as string[];

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        title, description: description || undefined,
        category, department: department || undefined, color,
        recurrence_type: recurrenceType,
        day_of_month: ['monthly', 'quarterly', 'yearly'].includes(recurrenceType) ? dayOfMonth : undefined,
        day_of_week: recurrenceType === 'weekly' ? dayOfWeek : undefined,
        month_of_year: ['quarterly', 'yearly'].includes(recurrenceType) ? monthsSelected : undefined,
        notify_before_days: notifyDays,
        notify_emails: emails.split('\n').map(e => e.trim()).filter(Boolean),
        notify_by_push: notifyPush,
        is_active: isActive,
      };
      return existing
        ? api.patch(`/calendar-settings/recurring/${existing.id}`, body)
        : api.post('/calendar-settings/recurring', body);
    },
    onSuccess: () => {
      toast.success(existing ? '수정되었습니다.' : '반복 일정이 등록되었습니다.');
      qc.invalidateQueries({ queryKey: ['recurring-events'] });
      qc.invalidateQueries({ queryKey: ['upcoming-recurring'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '저장에 실패했습니다.'),
  });

  const toggleMonth = (m: number) =>
    setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a,b)=>a-b));

  const toggleNotifyDay = (d: number) =>
    setNotifyDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b)=>a-b));

  return (
    <Modal open={open} onClose={onClose} title={existing ? '반복 일정 수정' : '반복 일정 추가'} size="lg">
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label mb-1">일정 제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="예: 급여 지급일" />
          </div>
          <div>
            <label className="label mb-1">카테고리</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label mb-1">담당 부서 (선택)</label>
            <select value={department} onChange={e => setDepartment(e.target.value)} className="input">
              <option value="">전체</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label mb-1">설명</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="일정에 대한 간단한 설명" />
          </div>
        </div>

        {/* 반복 규칙 */}
        <div className="p-3 rounded-xl border border-border space-y-3">
          <label className="label">반복 규칙</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(RECURRENCE_LABELS).map(([k, l]) => (
              <button key={k} onClick={() => setRecType(k)}
                className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  recurrenceType === k ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-border text-text-secondary hover:border-primary-300')}>
                {l}
              </button>
            ))}
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <label className="label mb-1.5">요일</label>
              <div className="flex gap-1.5">
                {DOW_LABELS.map((d, i) => (
                  <button key={i} onClick={() => setDayOfWeek(i)}
                    className={clsx('w-9 h-9 rounded-full text-xs font-medium border transition-colors',
                      dayOfWeek === i ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-border text-text-secondary')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {['monthly', 'quarterly', 'yearly'].includes(recurrenceType) && (
            <div>
              <label className="label mb-1.5">일 (1~31)</label>
              <input type="number" min={1} max={31} value={dayOfMonth}
                onChange={e => setDayOfMonth(parseInt(e.target.value) || 1)}
                className="input w-24" />
            </div>
          )}

          {['quarterly', 'yearly'].includes(recurrenceType) && (
            <div>
              <label className="label mb-1.5">적용 월</label>
              <div className="flex gap-1.5 flex-wrap">
                {MONTH_LABELS.map((m, i) => (
                  <button key={i+1} onClick={() => toggleMonth(i+1)}
                    className={clsx('px-2 py-1 rounded-lg text-xs font-medium border transition-colors',
                      monthsSelected.includes(i+1) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-border text-text-secondary')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="label mb-0">색상</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-border" />
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="p-3 rounded-xl border border-border space-y-3">
          <label className="label">알림 설정</label>
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">미리 알림 (N일 전)</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 5, 7, 14].map(d => (
                <button key={d} onClick={() => toggleNotifyDay(d)}
                  className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    notifyDays.includes(d) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-border text-text-secondary')}>
                  {d}일 전
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">이메일 수신자 (줄바꿈으로 구분)</label>
            <textarea value={emails} onChange={e => setEmails(e.target.value)}
              placeholder="hong@company.com&#10;kim@company.com"
              rows={3} className="input w-full resize-none text-sm font-mono" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyPush} onChange={e => setNotifyPush(e.target.checked)} className="accent-primary-500" />
            <span className="text-sm">앱 푸시 알림</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-primary-500" />
            <span className="text-sm">활성화</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button loading={mut.isPending} disabled={!title.trim()} onClick={() => mut.mutate()}>
          {existing ? '수정' : '등록'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── 개인 오버라이드 패널 ─────────────────────────────────────────────────────
function UserOverridePanel({ users }: { users: any[] }) {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: overrideMap = {} } = useQuery<Record<string, boolean>>({
    queryKey: ['user-visibility-override', selectedUserId],
    queryFn: () => api.get(`/calendar-settings/visibility/user/${selectedUserId}`).then(r => r.data.data as Record<string, boolean>),
    enabled: !!selectedUserId,
  });

  const toggleMut = useMutation({
    mutationFn: ({ pageKey, isVisible }: { pageKey: string; isVisible: boolean }) =>
      api.patch(`/calendar-settings/visibility/user/${selectedUserId}`, {
        department: `user:${selectedUserId}`, // backend ignores this field for user overrides
        pages: [{ page_key: pageKey, is_visible: isVisible }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-visibility-override', selectedUserId] });
      qc.invalidateQueries({ queryKey: ['page-visibility'] });
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  const resetMut = useMutation({
    mutationFn: () => api.patch(`/calendar-settings/visibility/user/${selectedUserId}`, {
      department: `user:${selectedUserId}`,
      pages: ALL_PAGES.map(k => ({ page_key: k, is_visible: true })),
    }),
    onSuccess: () => {
      toast.success('개인 설정이 초기화되었습니다.');
      qc.invalidateQueries({ queryKey: ['user-visibility-override', selectedUserId] });
      qc.invalidateQueries({ queryKey: ['page-visibility'] });
    },
    onError: () => toast.error('초기화에 실패했습니다.'),
  });

  const selectedUser = users.find((u: any) => u.id === selectedUserId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-text-secondary mb-3">
          부서 설정을 무시하고 특정 직원에게만 적용되는 개인 화면 오버라이드를 설정합니다.
        </p>
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">직원 선택...</option>
          {users.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.department ? `(${u.department})` : ''} — {u.role}
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">
              {selectedUser?.name ?? ''}님의 개인 설정
            </p>
            <button
              onClick={() => resetMut.mutate()}
              className="text-xs text-text-muted hover:text-red-500 underline"
            >
              전체 초기화
            </button>
          </div>
          <p className="text-xs text-text-muted mb-3">
            설정이 없는 항목은 부서 설정을 따릅니다. 여기서 명시적으로 설정한 항목만 개인 오버라이드로 저장됩니다.
          </p>
          <div className="border border-border rounded-xl overflow-hidden">
            {ALL_PAGES.filter(k => k !== '/').map((key, i) => {
              const isVisible = overrideMap[key] !== false;
              const hasOverride = key in overrideMap;
              return (
                <div key={key} className={clsx(
                  'flex items-center justify-between px-4 py-2.5',
                  i !== 0 && 'border-t border-border',
                  hasOverride && 'bg-blue-50/50',
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary">{PAGE_LABELS[key]}</span>
                    {hasOverride && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">개인 설정</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleMut.mutate({ pageKey: key, isVisible: !isVisible })}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {isVisible ? '표시' : '숨김'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 팀 가시성 설정 패널 ──────────────────────────────────────────────────────
function VisibilityPanel({ users, templates, visibilityData, userRole }: {
  users: any[];
  templates: DeptTemplate[];
  visibilityData: Record<string, Record<string, boolean>>;
  userRole: string;
}) {
  const qc = useQueryClient();
  const [selectedDept, setSelectedDept] = useState('__default__');
  const [applying, setApplying]         = useState<string | null>(null);
  const [showUserOverride, setShowUserOverride] = useState(false);

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))] as string[];
  const allDepts = ['__default__', ...departments];

  const currentSettings: Record<string, boolean> = visibilityData[selectedDept] ?? {};

  const toggleMut = useMutation({
    mutationFn: ({ pageKey, isVisible }: { pageKey: string; isVisible: boolean }) =>
      api.patch('/calendar-settings/visibility', {
        department: selectedDept,
        pages: [{ page_key: pageKey, is_visible: isVisible }],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visibility-settings'] }),
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  const applyTemplate = async (templateKey: string, createEvents: boolean) => {
    setApplying(templateKey);
    try {
      await api.post('/calendar-settings/templates/apply', {
        department: selectedDept,
        template: templateKey,
        create_recurring_events: createEvents,
      });
      toast.success('템플릿이 적용되었습니다.');
      qc.invalidateQueries({ queryKey: ['visibility-settings'] });
      qc.invalidateQueries({ queryKey: ['recurring-events'] });
      qc.invalidateQueries({ queryKey: ['page-visibility'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? '적용에 실패했습니다.');
    } finally {
      setApplying(null);
    }
  };

  if (userRole !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <SlidersHorizontal className="h-10 w-10 mb-3 opacity-30" />
        <p className="font-medium">화면 설정은 사업주만 변경할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 부서 선택 */}
      <div className="flex gap-2 flex-wrap">
        {allDepts.map(d => (
          <button key={d} onClick={() => setSelectedDept(d)}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              selectedDept === d ? 'bg-primary-500 text-white border-primary-500' : 'bg-white border-border text-text-secondary')}>
            {d === '__default__' ? '기본 (전체)' : d}
          </button>
        ))}
      </div>

      {/* 템플릿 추천 */}
      <div>
        <p className="text-sm font-semibold text-text-primary mb-2">추천 템플릿 적용</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {templates.map(t => (
            <div key={t.key} className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.emoji}</span>
                <p className="text-sm font-semibold text-text-primary">{t.name}</p>
              </div>
              <p className="text-xs text-text-muted">
                {t.visible === 'all' ? '전체 메뉴 표시' : `${(t.visible as string[]).length}개 메뉴`}
                {t.hasRecurringEvents && ' · 반복 일정 포함'}
              </p>
              <button
                onClick={() => applyTemplate(t.key, t.hasRecurringEvents)}
                disabled={applying === t.key}
                className="w-full px-2 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-xs font-medium hover:bg-primary-100 transition-colors disabled:opacity-40"
              >
                {applying === t.key ? '적용 중...' : '이 템플릿 적용'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 페이지별 개별 토글 */}
      <div>
        <p className="text-sm font-semibold text-text-primary mb-2">개별 메뉴 설정</p>
        <div className="border border-border rounded-xl overflow-hidden">
          {ALL_PAGES.filter(k => k !== '/').map((key, i) => {
            const isVisible = currentSettings[key] !== false; // undefined = visible
            return (
              <div key={key} className={clsx(
                'flex items-center justify-between px-4 py-2.5',
                i !== 0 && 'border-t border-border',
              )}>
                <span className="text-sm text-text-primary">{PAGE_LABELS[key]}</span>
                <button
                  onClick={() => toggleMut.mutate({ pageKey: key, isVisible: !isVisible })}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {isVisible ? '표시' : '숨김'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 개인 오버라이드 섹션 */}
      <div className="border border-border rounded-xl p-4">
        <button
          onClick={() => setShowUserOverride(p => !p)}
          className="flex items-center justify-between w-full"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary text-left">개인 화면 오버라이드</p>
            <p className="text-xs text-text-muted mt-0.5">특정 직원에게만 적용되는 개별 설정</p>
          </div>
          <ChevronDown className={clsx('h-4 w-4 text-text-muted transition-transform', showUserOverride && 'rotate-180')} />
        </button>
        {showUserOverride && (
          <div className="mt-4 pt-4 border-t border-border">
            <UserOverridePanel users={users} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function CalendarSettingsPage() {
  usePageTitle('캘린더 설정');
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<'recurring' | 'upcoming' | 'visibility'>('recurring');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<RecurringEvent | null>(null);
  const qc = useQueryClient();

  const { data: recurringData }  = useQuery({ queryKey: ['recurring-events'], queryFn: () => api.get('/calendar-settings/recurring').then(r => r.data.data as RecurringEvent[]) });
  const { data: upcomingData }   = useQuery({ queryKey: ['upcoming-recurring'], queryFn: () => api.get('/calendar-settings/recurring/upcoming?days=90').then(r => r.data.data as UpcomingEvent[]) });
  const { data: templatesData }  = useQuery({ queryKey: ['dept-templates'], queryFn: () => api.get('/calendar-settings/templates').then(r => r.data.data as DeptTemplate[]) });
  const { data: visibilityData } = useQuery({ queryKey: ['visibility-settings'], queryFn: () => api.get('/calendar-settings/visibility').then(r => r.data.data?.byDepartment as Record<string, Record<string, boolean>> ?? {}), enabled: user?.role !== 'employee' });
  const { data: usersData = [] }  = useQuery({ queryKey: ['users-for-settings'], queryFn: () => api.get('/users').then(r => r.data.data as any[]) });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar-settings/recurring/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); qc.invalidateQueries({ queryKey: ['recurring-events'] }); },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const recurring = recurringData ?? [];
  const upcoming  = upcomingData ?? [];
  const templates = templatesData ?? [];

  const describeRecurrence = (ev: RecurringEvent) => {
    switch (ev.recurrenceType) {
      case 'monthly':   return `매월 ${ev.dayOfMonth}일`;
      case 'weekly':    return `매주 ${ev.dayOfWeek !== null ? DOW_LABELS[ev.dayOfWeek] : ''}요일`;
      case 'quarterly': return `분기별 (${ev.monthOfYear?.join('·')}월) ${ev.dayOfMonth}일`;
      case 'yearly':    return `매년 ${ev.monthOfYear?.join('·')}월 ${ev.dayOfMonth}일`;
      default:          return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">캘린더 설정</h1>
          <p className="text-sm text-text-secondary mt-0.5">반복 일정 등록, 이메일 알림, 팀별 화면 구성을 관리합니다.</p>
        </div>
        {tab === 'recurring' && (
          <Button onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus className="h-4 w-4" /> 반복 일정 추가
          </Button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          ['recurring', '📅 반복 일정'],
          ['upcoming',  '🔔 예정 일정'],
          ['visibility', '⚙️ 팀별 화면 설정'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭: 반복 일정 ─────────────────────────────────────────────────── */}
      {tab === 'recurring' && (
        <div className="space-y-3">
          {recurring.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">등록된 반복 일정이 없습니다.</p>
              <p className="text-sm mt-1">+ 반복 일정 추가 버튼을 눌러 급여일, 보고일 등을 등록하세요.</p>
            </div>
          )}
          {recurring.map(ev => {
            const cat = CATEGORY_LABELS[ev.category] ?? CATEGORY_LABELS.custom;
            return (
              <div key={ev.id} className="bg-white rounded-xl border border-border p-4 flex items-center gap-4">
                <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color ?? '#2563EB' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary">{ev.title}</p>
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', cat.color)}>{cat.label}</span>
                    {ev.department && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{ev.department}</span>}
                    {!ev.isActive && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">비활성</span>}
                  </div>
                  <p className="text-sm text-text-secondary mt-0.5">{describeRecurrence(ev)}</p>
                  {ev.notifyBeforeDays.length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                      <Bell className="h-3 w-3" /> {ev.notifyBeforeDays.join('·')}일 전 알림
                      {ev.notifyEmails.length > 0 && ` · 이메일 ${ev.notifyEmails.length}명`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => { setEditing(ev); setShowModal(true); }}
                    className="p-2 rounded-lg hover:bg-background text-text-muted transition-colors" aria-label="수정">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(ev.id); }}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors" aria-label="삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 탭: 예정 일정 (90일) ──────────────────────────────────────────── */}
      {tab === 'upcoming' && (
        <div>
          <p className="text-sm text-text-secondary mb-4">앞으로 90일 내 반복 일정 발생 예정일입니다.</p>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Bell className="h-12 w-12 mb-3 opacity-30" />
              <p>예정된 반복 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((ev, i) => {
                const cat = CATEGORY_LABELS[ev.category] ?? CATEGORY_LABELS.custom;
                const d = new Date(ev.date);
                const daysUntil = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={`${ev.id}-${ev.date}-${i}`} className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-4">
                    <div className="text-center w-10 flex-shrink-0">
                      <p className="text-xs text-text-muted">{format(d, 'M월', { locale: ko })}</p>
                      <p className="text-xl font-bold text-text-primary leading-none">{format(d, 'd')}</p>
                      <p className="text-xs text-text-muted">{format(d, 'EEE', { locale: ko })}</p>
                    </div>
                    <div className="h-8 w-px bg-border flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ backgroundColor: ev.color ?? '#2563EB' }} className="w-2 h-2 rounded-full flex-shrink-0 inline-block" />
                        <p className="font-medium text-text-primary">{ev.title}</p>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', cat.color)}>{cat.label}</span>
                        {ev.department && <span className="text-xs text-text-muted">{ev.department}</span>}
                      </div>
                    </div>
                    <span className={clsx('text-xs font-medium px-2 py-1 rounded-full flex-shrink-0',
                      daysUntil <= 3 ? 'bg-red-100 text-red-600' :
                      daysUntil <= 7 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-600')}>
                      D-{daysUntil}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 팀별 화면 설정 ──────────────────────────────────────────────── */}
      {tab === 'visibility' && (
        <VisibilityPanel
          users={usersData}
          templates={templates}
          visibilityData={visibilityData ?? {}}
          userRole={user?.role ?? 'employee'}
        />
      )}

      {/* 반복 일정 모달 */}
      <RecurringEventModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        existing={editing}
        users={usersData}
      />
    </div>
  );
}
