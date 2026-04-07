'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Users, Clock, AlertCircle, ClipboardCheck,
  LogIn, LogOut, TrendingUp, TrendingDown,
  CheckCircle2, Timer, Minus, ChevronRight,
  CalendarDays, BarChart3, Zap,
  TriangleAlert, FileText, ShieldCheck,
  Umbrella, FilePen, Building2, CalendarCheck,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import DashboardCover from '@/components/layout/DashboardCover';
import Card from '@/components/ui/Card';
import Badge, { TASK_STATUS_BADGE, TASK_PRIORITY_BADGE, ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ── 뷰 타입 ──────────────────────────────────────────────
type DashView = 'executive' | 'hr' | 'work' | 'personal';

const VIEW_META: Record<DashView, { label: string; desc: string }> = {
  executive: { label: '경영',   desc: '전체 현황 · 세무 · 결재' },
  hr:        { label: '인사',   desc: '근태 · 휴가 · 계약' },
  work:      { label: '업무',   desc: '업무 · 캘린더 · 보고' },
  personal:  { label: '개인',   desc: '내 근태 · 내 업무 · 휴가' },
};

const ROLE_DEFAULT_VIEW: Record<string, DashView> = {
  owner:    'executive',
  manager:  'hr',
  employee: 'personal',
};

function detectDefaultView(role: string, department?: string | null): DashView {
  if (role === 'owner') return 'executive';
  if (role === 'manager') {
    const dept = (department ?? '').toLowerCase();
    if (dept.includes('인사') || dept.includes('hr') || dept.includes('총무')) return 'hr';
    return 'work';
  }
  return 'personal';
}

const VIEW_OPTIONS: Record<string, DashView[]> = {
  owner:    ['executive', 'hr', 'work', 'personal'],
  manager:  ['hr', 'work', 'personal'],
  employee: ['work', 'personal'],
};

// ── 인사말 ──────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '안녕하세요';
  return '수고하셨어요';
}

// ── D-day ─────────────────────────────────────────────
function dday(dateStr: string | null): string {
  if (!dateStr) return '-';
  const diff = differenceInDays(parseISO(dateStr), new Date());
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return 'D-day';
  return `D-${diff}`;
}

const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  normal: 'bg-primary-400',
  low:    'bg-gray-300',
};

// ═══════════════════════════════════════════════════════
// ── 공통 위젯들 ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// ── StatCard ─────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, iconBg, trend, trendLabel, href,
}: {
  label: string; value: string | number;
  icon: any; iconBg: string;
  trend?: number; trendLabel?: string; href?: string;
}) {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend == null ? '' : trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  const inner = (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {TrendIcon && trend != null && (
          <span className={clsx('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />{Math.abs(trend)}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
        <p className="text-xs font-medium text-text-muted mt-0.5">{label}</p>
      </div>
      {trendLabel && <p className="text-[11px] text-text-muted border-t border-border pt-2">{trendLabel}</p>}
    </div>
  );

  if (href) return <Link href={href} className="block h-full hover:opacity-90 transition-opacity">{inner}</Link>;
  return inner;
}

// ── 출퇴근 카드 ──────────────────────────────────────
function ClockCard() {
  const [now, setNow] = useState(new Date());
  const today = format(now, 'yyyy-MM-dd');
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: record, isLoading } = useQuery({
    queryKey: ['attendance-me-today', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', { params: { start_date: today, end_date: today } });
      return data.data?.records?.[0] ?? null;
    },
  });

  const clockIn = useMutation({
    mutationFn: () => api.post('/attendance/clock-in'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-me-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      toast.success('출근 처리되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '출근 처리 실패'),
  });

  const clockOut = useMutation({
    mutationFn: () => api.post('/attendance/clock-out'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-me-today'] });
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      toast.success('퇴근 처리되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '퇴근 처리 실패'),
  });

  const canClockIn  = !record?.clockInAt;
  const canClockOut = !!record?.clockInAt && !record?.clockOutAt;
  const statusLabel: Record<string, string> = {
    normal: '정상 출근', late: '지각', early_leave: '조퇴',
    absent: '결근', vacation: '휴가', pending: '대기',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted">
            {format(now, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </p>
          <p className="text-4xl font-bold text-text-primary tabular-nums tracking-tight mt-1">
            {format(now, 'HH:mm:ss')}
          </p>
        </div>
        {record?.status && (
          <Badge value={record.status} colorMap={ATTENDANCE_STATUS_BADGE}
            label={(statusLabel)[record.status] ?? record.status} />
        )}
      </div>
      {record ? (
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
          {[
            { label: '출근', val: record.clockInAt  ? format(new Date(record.clockInAt),  'HH:mm') : '-' },
            { label: '퇴근', val: record.clockOutAt ? format(new Date(record.clockOutAt), 'HH:mm') : '-' },
            { label: '근무', val: record.clockOutAt && record.totalWorkMinutes != null
                ? `${Math.floor(record.totalWorkMinutes / 60)}h ${record.totalWorkMinutes % 60}m` : '-' },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-[11px] text-text-muted">{label}</p>
              <p className="text-sm font-semibold text-text-primary tabular-nums">{val}</p>
            </div>
          ))}
        </div>
      ) : !isLoading && (
        <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-text-muted">
          아직 출근 기록이 없습니다
        </div>
      )}
      <div className="flex gap-2.5">
        <button onClick={() => clockIn.mutate()} disabled={!canClockIn || clockIn.isPending}
          className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            canClockIn ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}>
          <LogIn className="h-4 w-4" />출근
        </button>
        <button onClick={() => clockOut.mutate()} disabled={!canClockOut || clockOut.isPending}
          className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            canClockOut ? 'bg-gray-700 hover:bg-gray-800 text-white shadow-sm' : 'bg-gray-100 text-gray-300 cursor-not-allowed')}>
          <LogOut className="h-4 w-4" />퇴근
        </button>
      </div>
    </div>
  );
}

// ── 팀 현황 ──────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  normal: 'bg-emerald-400', late: 'bg-amber-400',
  absent: 'bg-red-400', early_leave: 'bg-orange-400',
  vacation: 'bg-blue-400', pending: 'bg-gray-300',
};

function TeamPresence({ records, compact = false }: { records: any[]; compact?: boolean }) {
  const sorted = [...records].sort((a, b) => {
    const order: Record<string, number> = { normal: 0, late: 1, early_leave: 2, vacation: 3, pending: 4, absent: 5 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });
  if (sorted.length === 0) return <div className="text-center py-6 text-sm text-text-muted">오늘 출근 기록이 없습니다</div>;
  const displayed = compact ? sorted.slice(0, 12) : sorted;

  return (
    <div className="flex flex-wrap gap-3">
      {displayed.map((r) => (
        <Link key={r.userId ?? r.id} href={`/team/${r.userId ?? r.id}`}
          className="flex flex-col items-center gap-1.5 group">
          <div className="relative">
            <Avatar name={r.userName ?? r.name ?? '?'} size="md" />
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
              STATUS_DOT[r.status] ?? 'bg-gray-300')} />
          </div>
          <span className="text-[11px] text-text-muted group-hover:text-text-primary transition-colors max-w-[48px] truncate text-center">
            {r.userName ?? r.name}
          </span>
        </Link>
      ))}
      {compact && sorted.length > 12 && (
        <Link href="/attendance" className="flex flex-col items-center gap-1.5 group">
          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-text-muted group-hover:bg-zinc-200 transition-colors">
            +{sorted.length - 12}
          </div>
          <span className="text-[11px] text-text-muted">더보기</span>
        </Link>
      )}
    </div>
  );
}

// ── 내 이번달 통계 ─────────────────────────────────
function MyMonthStats() {
  const year  = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end   = format(new Date(), 'yyyy-MM-dd');

  const { data } = useQuery({
    queryKey: ['my-month-stats', year, month],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', { params: { start_date: start, end_date: end } });
      return data.data ?? null;
    },
  });

  const records  = data?.records ?? [];
  const workDays = records.filter((r: any) => r.clockOutAt).length;
  const lateDays = records.filter((r: any) => r.status === 'late').length;
  const totalMin = records.reduce((acc: number, r: any) => acc + (r.totalWorkMinutes ?? 0), 0);
  const totalH   = Math.floor(totalMin / 60);

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: '이번달 근무', value: `${workDays}일`, icon: CalendarDays, color: 'bg-primary-500' },
        { label: '지각',       value: `${lateDays}회`, icon: AlertCircle, color: lateDays > 0 ? 'bg-amber-500' : 'bg-gray-300' },
        { label: '총 근무시간', value: `${totalH}h`,   icon: Timer,        color: 'bg-emerald-500' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-white rounded-xl border border-border shadow-card p-4 flex flex-col gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <p className="text-lg font-bold text-text-primary tabular-nums">{value}</p>
          <p className="text-[11px] text-text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── 업무 행 ──────────────────────────────────────────
function TaskRow({ task }: { task: any }) {
  const dd = dday(task.dueDate);
  const ddColor =
    dd === 'D-day'      ? 'text-red-500 font-bold' :
    dd.startsWith('D+') ? 'text-red-400' :
    dd === 'D-1'        ? 'text-orange-500' : 'text-text-muted';

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 px-1 -mx-1 rounded-lg transition-colors group">
        <div className={clsx('w-1 h-8 rounded-full flex-shrink-0', PRIORITY_BAR[task.priority] ?? 'bg-gray-200')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
          <p className="text-xs text-text-muted">{task.assignee?.name ?? '미배정'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx('text-xs tabular-nums', ddColor)}>{dd}</span>
          <Badge value={task.status} colorMap={TASK_STATUS_BADGE} />
        </div>
      </div>
    </Link>
  );
}

// ── 세무 할 일 위젯 ───────────────────────────────
function TaxTodoWidget({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-500" />세무·노무 할 일
          </h3>
          <p className="text-xs text-text-muted mt-0.5">35일 이내 마감 기준</p>
        </div>
        <Link href="/tax-documents" className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors">
          서류 관리 <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="px-6 pb-5 space-y-2">
        {items.slice(0, 5).map((item: any) => {
          const urgencyColor = item.urgency === 'urgent' ? 'border-l-red-400 bg-red-50' : item.urgency === 'warning' ? 'border-l-amber-400 bg-amber-50' : 'border-l-gray-200 bg-gray-50';
          const badgeColor   = item.urgency === 'urgent' ? 'bg-red-100 text-red-700' : item.urgency === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
          const Icon = item.category === 'tax' ? FileText : item.category === 'insurance' ? ShieldCheck : TriangleAlert;
          return (
            <Link key={item.id} href={item.actionUrl ?? '/tax-documents'}>
              <div className={clsx('flex items-center gap-3 p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity', urgencyColor)}>
                <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-text-primary truncate">{item.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{item.description}</p>
                </div>
                <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', badgeColor)}>
                  {item.daysLeft <= 0 ? '오늘' : `D-${item.daysLeft}`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── 진행 중 업무 위젯 ─────────────────────────────
function TasksWidget({ tasks, isLoading }: { tasks: any[]; isLoading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary-500" />진행 중 업무
          </h3>
          <p className="text-xs text-text-muted mt-0.5">진행 중 상태 최근 8건</p>
        </div>
        <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors">
          전체 보기 <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="px-6 pb-5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
              <div className="w-1 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-gray-50 rounded animate-pulse w-1/4" />
              </div>
              <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))
        ) : tasks.length > 0 ? (
          tasks.map((task: any) => <TaskRow key={task.id} task={task} />)
        ) : (
          <div className="py-10 text-center text-sm text-text-muted">진행 중인 업무가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ── 휴가 대기 위젯 ────────────────────────────────
function VacationPendingWidget({ items }: { items: any[] }) {
  const VACATION_TYPE: Record<string, string> = {
    annual: '연차', half: '반차', sick: '병가', special: '특별', unpaid: '무급',
  };
  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <Umbrella className="h-4 w-4 text-blue-500" />휴가 승인 대기
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{items.length}건 대기 중</p>
        </div>
        <Link href="/vacations" className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors">
          전체 보기 <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="px-6 pb-5 space-y-2">
        {items.length === 0 ? (
          <p className="text-center py-6 text-sm text-text-muted">대기 중인 휴가 신청이 없습니다</p>
        ) : items.slice(0, 5).map((v: any) => (
          <Link key={v.id} href="/vacations">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <Avatar name={v.user?.name ?? '?'} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary truncate">{v.user?.name}</p>
                <p className="text-[11px] text-text-muted">
                  {VACATION_TYPE[v.type] ?? v.type} · {v.startDate?.slice(0, 10)} ~ {v.endDate?.slice(0, 10)}
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                {v.days}일
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── 내 휴가 잔여 위젯 ─────────────────────────────
function MyVacationWidget({ balance }: { balance: any }) {
  const remaining = balance?.remaining ?? 0;
  const total     = balance?.total ?? 0;
  const used      = balance?.used ?? 0;
  const pct       = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
          <Umbrella className="h-4 w-4 text-blue-500" />내 휴가 현황
        </h3>
        <Link href="/vacations" className="text-xs text-primary-500 hover:text-primary-600">
          신청 →
        </Link>
      </div>
      <div className="flex items-end gap-1 mb-2">
        <p className="text-3xl font-bold text-text-primary tabular-nums">{remaining}</p>
        <p className="text-sm text-text-muted mb-1">/ {total}일 남음</p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-text-muted">사용 {used}일 · 잔여 {remaining}일</p>
    </div>
  );
}

// ── 이번 주 캘린더 위젯 ───────────────────────────
function CalendarMiniWidget({ events }: { events: any[] }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const EVENT_COLOR: Record<string, string> = {
    meeting: 'bg-blue-400', deadline: 'bg-red-400',
    event: 'bg-emerald-400', reminder: 'bg-amber-400', other: 'bg-gray-400',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary-500" />이번 주 일정
        </h3>
        <Link href="/calendar" className="text-xs text-primary-500 hover:text-primary-600">전체 →</Link>
      </div>
      <div className="space-y-1">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = format(today, 'yyyy-MM-dd') === dateStr;
          const dayEvents = events.filter((e: any) => {
            const s = e.startDate?.slice(0, 10) ?? e.start_date?.slice(0, 10);
            return s === dateStr;
          });
          return (
            <div key={dateStr} className={clsx('flex items-start gap-3 py-2 px-2.5 rounded-lg', isToday && 'bg-primary-50')}>
              <div className="flex-shrink-0 w-10 text-center">
                <p className={clsx('text-[10px] font-medium', isToday ? 'text-primary-600' : 'text-text-muted')}>
                  {format(day, 'E', { locale: ko })}
                </p>
                <p className={clsx('text-sm font-bold tabular-nums', isToday ? 'text-primary-700' : 'text-text-primary')}>
                  {format(day, 'd')}
                </p>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                {dayEvents.length === 0 ? (
                  <p className="text-[11px] text-text-muted py-0.5">일정 없음</p>
                ) : dayEvents.slice(0, 2).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-1.5">
                    <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', EVENT_COLOR[e.type] ?? 'bg-gray-400')} />
                    <p className="text-[11px] text-text-primary truncate">{e.title}</p>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-text-muted">+{dayEvents.length - 2}건 더</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 결재 대기 위젯 ────────────────────────────────
function ApprovalWidget({ count }: { count: number }) {
  return (
    <Link href="/approvals">
      <div className="bg-white rounded-xl border border-border shadow-card p-5 flex items-center gap-4 hover:border-primary-200 hover:shadow-card-hover transition-all">
        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <FilePen className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{count}</p>
          <p className="text-xs text-text-muted mt-0.5">결재 대기 건</p>
        </div>
        <ChevronRight className="h-4 w-4 text-text-muted ml-auto" />
      </div>
    </Link>
  );
}

// ── 팀 현황 패널 (공통 래퍼) ─────────────────────
function TeamPresencePanel({ records, summary, compact = false }: { records: any[]; summary: any; compact?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary">오늘 팀 현황</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {records.length > 0
              ? `${records.length}명 기록됨 · ${summary?.normal ?? 0}명 정상 출근`
              : '아직 출근 기록이 없습니다'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          {[
            { dot: 'bg-emerald-400', label: '정상' },
            { dot: 'bg-amber-400',   label: '지각' },
            { dot: 'bg-red-400',     label: '결근' },
            { dot: 'bg-blue-400',    label: '휴가' },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={clsx('w-2 h-2 rounded-full', dot)} />{label}
            </span>
          ))}
        </div>
      </div>
      <TeamPresence records={records} compact={compact} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── 뷰 레이아웃 컴포넌트들 ──────────────────────────────
// ═══════════════════════════════════════════════════════

function ExecutiveView({ data }: { data: any }) {
  const { summary, records, tasks, tasksLoading, todoItems, approvalCount, subscriptionData, user } = data;
  return (
    <div className="space-y-6">
      {/* 구독 배너 */}
      {subscriptionData?.status === 'trialing' && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-primary-50 border border-primary-100 rounded-xl px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-primary-700">무료 체험 중 — {Math.max(0, subscriptionData.daysRemaining ?? 0)}일 남음</p>
            <p className="text-xs text-primary-500 mt-0.5">체험 기간 종료 전에 플랜을 선택하세요.</p>
          </div>
          <Link href="/onboarding/plan" className="text-xs font-semibold bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex-shrink-0">플랜 선택</Link>
        </div>
      )}
      {subscriptionData?.status === 'past_due' && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-red-50 border border-red-100 rounded-xl px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-red-700">결제 실패 — 서비스가 곧 정지될 수 있습니다</p>
            <p className="text-xs text-red-500 mt-0.5">결제 수단을 확인하거나 변경하세요.</p>
          </div>
          <Link href="/settings" className="text-xs font-semibold bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex-shrink-0">결제 수단 확인</Link>
        </div>
      )}

      {/* 상단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1"><ClockCard /></div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard label="오늘 출근"   value={summary.normal ?? 0} icon={CheckCircle2} iconBg="bg-emerald-500" trendLabel="정상 출근 인원" href="/attendance" />
          <StatCard label="지각"        value={summary.late ?? 0}   icon={Clock}        iconBg="bg-amber-500"  trendLabel="오늘 지각 인원" href="/attendance" />
          <StatCard label="결근"        value={summary.absent ?? 0} icon={AlertCircle}  iconBg="bg-red-500"    trendLabel="오늘 결근 인원" href="/attendance" />
          <StatCard label="결재 대기"   value={approvalCount ?? 0}  icon={FilePen}      iconBg="bg-purple-500" trendLabel="승인 대기 건수" href="/approvals" />
        </div>
      </div>

      {/* 세무 할 일 */}
      <TaxTodoWidget items={todoItems ?? []} />

      {/* 팀 현황 */}
      <TeamPresencePanel records={records} summary={summary} />

      {/* 진행 업무 */}
      <TasksWidget tasks={tasks} isLoading={tasksLoading} />
    </div>
  );
}

function HrView({ data }: { data: any }) {
  const { summary, records, tasks, tasksLoading, vacationPending } = data;
  return (
    <div className="space-y-6">
      {/* 상단 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1"><ClockCard /></div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="정상 출근"   value={summary.normal ?? 0}  icon={CheckCircle2} iconBg="bg-emerald-500" href="/attendance" />
          <StatCard label="지각"        value={summary.late ?? 0}    icon={Clock}        iconBg="bg-amber-500"  href="/attendance" />
          <StatCard label="결근"        value={summary.absent ?? 0}  icon={AlertCircle}  iconBg="bg-red-500"    href="/attendance" />
          <StatCard label="휴가"        value={summary.vacation ?? 0} icon={Umbrella}    iconBg="bg-blue-500"   href="/vacations" />
          <StatCard label="전체 인원"   value={records.length}        icon={Users}        iconBg="bg-primary-500" href="/team" />
          <StatCard label="출근율"
            value={records.length > 0 ? `${Math.round(((summary.normal ?? 0) / records.length) * 100)}%` : '-'}
            icon={BarChart3} iconBg="bg-teal-500" />
        </div>
      </div>

      {/* 팀 현황 (대형) */}
      <TeamPresencePanel records={records} summary={summary} compact={false} />

      {/* 휴가 대기 */}
      <VacationPendingWidget items={vacationPending ?? []} />

      {/* 업무 (간략) */}
      <TasksWidget tasks={tasks.slice(0, 5)} isLoading={tasksLoading} />
    </div>
  );
}

function WorkView({ data }: { data: any }) {
  const { tasks, tasksLoading, calendarEvents, records, summary, isManager } = data;
  return (
    <div className="space-y-6">
      {/* 상단 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1"><ClockCard /></div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard label="진행 중 업무" value={tasks.filter((t: any) => t.status === 'in_progress').length} icon={ClipboardCheck} iconBg="bg-primary-500" href="/tasks" />
          <StatCard label="완료 업무"    value={tasks.filter((t: any) => t.status === 'done').length}        icon={CheckCircle2}   iconBg="bg-emerald-500" href="/tasks" />
          <StatCard label="이번 주 일정" value={calendarEvents.length}                                        icon={CalendarDays}   iconBg="bg-indigo-500" href="/calendar" />
          {isManager
            ? <StatCard label="팀 출근 인원" value={summary?.normal ?? 0} icon={Users} iconBg="bg-teal-500" href="/attendance" />
            : <StatCard label="지각 횟수"    value={0}                     icon={Clock} iconBg="bg-amber-500" href="/attendance" />
          }
        </div>
      </div>

      {/* 2컬럼: 업무 + 캘린더 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TasksWidget tasks={tasks} isLoading={tasksLoading} />
        <CalendarMiniWidget events={calendarEvents} />
      </div>

      {/* 팀 현황 (manager만) */}
      {isManager && records.length > 0 && (
        <TeamPresencePanel records={records} summary={summary} compact />
      )}
    </div>
  );
}

function PersonalView({ data }: { data: any }) {
  const { tasks, tasksLoading, calendarEvents, vacationBalance } = data;
  return (
    <div className="space-y-6">
      {/* 상단 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ClockCard />
        <div className="space-y-4">
          <MyMonthStats />
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/attendance', icon: Clock,          label: '출퇴근 기록', desc: '이번 달 근태 확인' },
              { href: '/tasks',      icon: ClipboardCheck, label: '내 업무',     desc: '할당된 업무 보기' },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="bg-white rounded-xl border border-border shadow-card p-4 hover:border-primary-200 hover:shadow-card-hover transition-all">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-primary-500" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TasksWidget tasks={tasks.slice(0, 6)} isLoading={tasksLoading} />
        </div>
        <div className="space-y-4">
          <MyVacationWidget balance={vacationBalance} />
          <CalendarMiniWidget events={calendarEvents} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── 메인 대시보드 ────────────────────────────────────────
// ═══════════════════════════════════════════════════════
export default function DashboardPage() {
  usePageTitle('대시보드');
  const user = useAuthStore((s) => s.user);
  const today = format(new Date(), 'yyyy-MM-dd');
  const role  = user?.role ?? 'employee';
  const isManager = role !== 'employee';

  // 기본 뷰 결정 (localStorage → 자동 감지 순)
  const [view, setView] = useState<DashView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_view') as DashView | null;
      if (saved && Object.keys(VIEW_META).includes(saved)) return saved;
    }
    return detectDefaultView(role, user?.department);
  });

  const handleViewChange = useCallback((v: DashView) => {
    setView(v);
    localStorage.setItem('dashboard_view', v);
  }, []);

  const availableViews = VIEW_OPTIONS[role] ?? ['personal'];

  // ── 데이터 fetch ─────────────────────────────────
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-today', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data?.data ?? data;
    },
    enabled: isManager,
    refetchInterval: 60_000,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-recent'],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { limit: 8, status: 'in_progress' } });
      return data?.data ?? data;
    },
  });

  const { data: todoItems } = useQuery({
    queryKey: ['tax-todo'],
    queryFn: async () => {
      const { data } = await api.get('/tax-documents/todo');
      return (data?.data ?? data ?? []) as any[];
    },
    enabled: isManager,
    staleTime: 1000 * 60 * 30,
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data?.currentSubscription ?? null;
    },
    enabled: role === 'owner',
  });

  const { data: vacationPending } = useQuery({
    queryKey: ['vacation-pending'],
    queryFn: async () => {
      const { data } = await api.get('/vacations', { params: { status: 'pending', limit: 10 } });
      return (data?.data?.items ?? data?.data ?? []) as any[];
    },
    enabled: isManager,
  });

  const { data: approvalPending } = useQuery({
    queryKey: ['approval-pending-count'],
    queryFn: async () => {
      const { data } = await api.get('/approvals', { params: { status: 'pending', limit: 1 } });
      return data?.data?.meta?.total ?? data?.meta?.total ?? 0;
    },
    enabled: isManager,
  });

  const { data: vacationBalance } = useQuery({
    queryKey: ['vacation-balance-me'],
    queryFn: async () => {
      const { data } = await api.get('/vacations/balance');
      return data?.data ?? null;
    },
    enabled: !isManager,
  });

  // 이번 주 캘린더
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: calendarData } = useQuery({
    queryKey: ['calendar-week', weekStart],
    queryFn: async () => {
      const { data } = await api.get('/calendar/events', { params: { start_date: weekStart, end_date: weekEnd } });
      return (data?.data?.events ?? data?.data ?? []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  // ── 집계 ────────────────────────────────────────
  const summary  = attendanceData?.meta?.summary ?? attendanceData?.summary ?? {};
  const records: any[] = attendanceData?.records ?? attendanceData?.data ?? [];
  const tasks: any[]   = tasksData?.tasks ?? tasksData?.data ?? [];
  const calendarEvents: any[] = calendarData ?? [];

  const sharedData = {
    summary, records, tasks, tasksLoading,
    todoItems: todoItems ?? [],
    vacationPending: vacationPending ?? [],
    approvalCount: approvalPending ?? 0,
    vacationBalance: vacationBalance ?? null,
    calendarEvents,
    subscriptionData,
    isManager,
    user,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <DashboardCover height={160}>
        <p className="text-base font-semibold opacity-90">{greeting()}, {user?.name ?? ''}님</p>
        <p className="text-xs opacity-70 mt-0.5">{format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko })}</p>
      </DashboardCover>

      <main className="page-container space-y-6">
        {/* 헤더 + 뷰 전환 탭 */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {greeting()}, {user?.name}님 <span className="text-2xl">👋</span>
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            </p>
          </div>

          {/* 뷰 전환 탭 */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
            {availableViews.map((v) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                title={VIEW_META[v].desc}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  view === v
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {VIEW_META[v].label}
              </button>
            ))}
          </div>
        </div>

        {/* 뷰 렌더링 */}
        {view === 'executive' && <ExecutiveView data={sharedData} />}
        {view === 'hr'        && <HrView        data={sharedData} />}
        {view === 'work'      && <WorkView       data={sharedData} />}
        {view === 'personal'  && <PersonalView   data={sharedData} />}
      </main>
    </div>
  );
}
