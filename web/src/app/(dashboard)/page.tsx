'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Users, Clock, AlertCircle, ClipboardCheck,
  LogIn, LogOut, TrendingUp, TrendingDown,
  CheckCircle2, Timer, Minus, ChevronRight,
  CalendarDays, BarChart3, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, {
  TASK_STATUS_BADGE, TASK_PRIORITY_BADGE, ATTENDANCE_STATUS_BADGE,
} from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ── 시간대 인사말 ──────────────────────────────────────
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

// ── 우선순위 색상 바 ──────────────────────────────────
const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-primary-400',
  low: 'bg-gray-300',
};

// ── StatCard ──────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, iconBg, trend, trendLabel,
}: {
  label: string;
  value: string | number;
  icon: any;
  iconBg: string;
  trend?: number;
  trendLabel?: string;
}) {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend == null ? '' : trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {TrendIcon && trend != null && (
          <span className={clsx('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(trend)}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
        <p className="text-xs font-medium text-text-muted mt-0.5">{label}</p>
      </div>
      {trendLabel && (
        <p className="text-[11px] text-text-muted border-t border-border pt-2">{trendLabel}</p>
      )}
    </div>
  );
}

// ── 출퇴근 카드 ───────────────────────────────────────
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
      const { data } = await api.get('/attendance/me', {
        params: { start_date: today, end_date: today },
      });
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
    normal: '정상 출근', late: '지각', early_leave: '조퇴', absent: '결근', vacation: '휴가', pending: '대기',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-6 flex flex-col gap-5">
      {/* 시계 */}
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
          <Badge
            value={record.status}
            colorMap={ATTENDANCE_STATUS_BADGE}
            label={(statusLabel as Record<string, string>)[record.status] ?? record.status}
          />
        )}
      </div>

      {/* 오늘 기록 */}
      {record ? (
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
          {[
            { label: '출근', val: record.clockInAt ? format(new Date(record.clockInAt), 'HH:mm') : '-' },
            { label: '퇴근', val: record.clockOutAt ? format(new Date(record.clockOutAt), 'HH:mm') : '-' },
            {
              label: '근무',
              val: record.clockOutAt && record.totalWorkMinutes != null
                ? `${Math.floor(record.totalWorkMinutes / 60)}h ${record.totalWorkMinutes % 60}m`
                : '-',
            },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-[11px] text-text-muted">{label}</p>
              <p className="text-sm font-semibold text-text-primary tabular-nums">{val}</p>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-text-muted">
            아직 출근 기록이 없습니다
          </div>
        )
      )}

      {/* 버튼 */}
      <div className="flex gap-2.5">
        <button
          onClick={() => clockIn.mutate()}
          disabled={!canClockIn || clockIn.isPending}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            canClockIn
              ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed',
          )}
        >
          <LogIn className="h-4 w-4" />
          출근
        </button>
        <button
          onClick={() => clockOut.mutate()}
          disabled={!canClockOut || clockOut.isPending}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
            canClockOut
              ? 'bg-gray-700 hover:bg-gray-800 text-white shadow-sm'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed',
          )}
        >
          <LogOut className="h-4 w-4" />
          퇴근
        </button>
      </div>
    </div>
  );
}

// ── 팀 현황 아바타 그리드 ──────────────────────────────
const STATUS_DOT: Record<string, string> = {
  normal: 'bg-emerald-400',
  late: 'bg-amber-400',
  absent: 'bg-red-400',
  early_leave: 'bg-orange-400',
  vacation: 'bg-blue-400',
  pending: 'bg-gray-300',
};

function TeamPresence({ records }: { records: any[] }) {
  const sorted = [...records].sort((a, b) => {
    const order: Record<string, number> = { normal: 0, late: 1, early_leave: 2, vacation: 3, pending: 4, absent: 5 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-text-muted">오늘 출근 기록이 없습니다</div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {sorted.map((r) => (
        <Link
          key={r.userId ?? r.id}
          href={`/team/${r.userId ?? r.id}`}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="relative">
            <Avatar name={r.userName ?? r.name ?? '?'} size="md" />
            <span
              className={clsx(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                STATUS_DOT[r.status] ?? 'bg-gray-300',
              )}
            />
          </div>
          <span className="text-[11px] text-text-muted group-hover:text-text-primary transition-colors max-w-[48px] truncate text-center">
            {r.userName ?? r.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── 내 통계 (직원용) ──────────────────────────────────
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

  const records = data?.records ?? [];
  const workDays = records.filter((r: any) => r.clockOutAt).length;
  const lateDays = records.filter((r: any) => r.status === 'late').length;
  const totalMin = records.reduce((acc: number, r: any) => acc + (r.totalWorkMinutes ?? 0), 0);
  const totalH   = Math.floor(totalMin / 60);
  const totalM   = totalMin % 60;

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: '이번달 근무', value: `${workDays}일`, icon: CalendarDays, color: 'bg-primary-500' },
        { label: '지각', value: `${lateDays}회`, icon: AlertCircle, color: lateDays > 0 ? 'bg-amber-500' : 'bg-gray-300' },
        { label: '총 근무시간', value: `${totalH}h`, icon: Timer, color: 'bg-emerald-500' },
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

// ── 업무 행 ───────────────────────────────────────────
function TaskRow({ task }: { task: any }) {
  const dd = dday(task.dueDate);
  const ddColor =
    dd === 'D-day'       ? 'text-red-500 font-bold' :
    dd.startsWith('D+')  ? 'text-red-400' :
    dd === 'D-1'         ? 'text-orange-500' : 'text-text-muted';

  return (
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
  );
}

// ── 메인 ──────────────────────────────────────────────
export default function DashboardPage() {
  usePageTitle('대시보드');
  const user = useAuthStore((s) => s.user);
  const today = format(new Date(), 'yyyy-MM-dd');
  const isManager = user?.role !== 'employee';

  // 오늘 팀 출근 현황
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-today', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data?.data ?? data;
    },
    enabled: isManager,
    refetchInterval: 60_000,
  });

  // 진행 중 업무
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-recent'],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { limit: 8, status: 'in_progress' } });
      return data?.data ?? data;
    },
  });

  // 구독 상태 (owner)
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data?.currentSubscription ?? null;
    },
    enabled: user?.role === 'owner',
  });

  const summary = attendanceData?.meta?.summary ?? attendanceData?.summary ?? {};
  const records: any[] = attendanceData?.records ?? attendanceData?.data ?? [];

  const tasks: any[] = tasksData?.tasks ?? tasksData?.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="대시보드" />

      <main className="page-container space-y-6">
        {/* 구독 배너 */}
        {user?.role === 'owner' && subscriptionData?.status === 'trialing' && (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-primary-700">
                무료 체험 중 — {Math.max(0, subscriptionData.daysRemaining ?? 0)}일 남음
              </p>
              <p className="text-xs text-primary-500 mt-0.5">체험 기간 종료 전에 플랜을 선택하세요.</p>
            </div>
            <Link href="/onboarding/plan" className="text-xs font-semibold bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex-shrink-0">
              플랜 선택
            </Link>
          </div>
        )}
        {user?.role === 'owner' && subscriptionData?.status === 'past_due' && (
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-red-700">결제 실패 — 서비스가 곧 정지될 수 있습니다</p>
              <p className="text-xs text-red-500 mt-0.5">결제 수단을 확인하거나 변경하세요.</p>
            </div>
            <Link href="/settings" className="text-xs font-semibold bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex-shrink-0">
              결제 수단 확인
            </Link>
          </div>
        )}

        {/* 인사말 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {greeting()}, {user?.name}님 <span className="text-2xl">👋</span>
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            </p>
          </div>
          {isManager && (
            <Link href="/attendance" className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors">
              <BarChart3 className="h-4 w-4" />
              근태 통계 보기
            </Link>
          )}
        </div>

        {/* 상단 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 출퇴근 카드 */}
          <div className="lg:col-span-1">
            <ClockCard />
          </div>

          {isManager ? (
            /* 관리자: 통계 4카드 */
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <StatCard
                label="오늘 출근"
                value={summary.normal ?? 0}
                icon={CheckCircle2}
                iconBg="bg-emerald-500"
                trendLabel="정상 출근 인원"
              />
              <StatCard
                label="지각"
                value={summary.late ?? 0}
                icon={Clock}
                iconBg="bg-amber-500"
                trendLabel="오늘 지각 인원"
              />
              <StatCard
                label="결근"
                value={summary.absent ?? 0}
                icon={AlertCircle}
                iconBg="bg-red-500"
                trendLabel="오늘 결근 인원"
              />
              <StatCard
                label="진행 중 업무"
                value={tasksData?.meta?.status_summary?.in_progress ?? tasks.length}
                icon={ClipboardCheck}
                iconBg="bg-primary-500"
                trendLabel="in_progress 상태"
              />
            </div>
          ) : (
            /* 직원: 내 이번달 통계 */
            <div className="lg:col-span-2 flex flex-col gap-4">
              <MyMonthStats />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/attendance', icon: Clock,         label: '출퇴근 기록', desc: '이번 달 근태 확인' },
                  { href: '/tasks',      icon: ClipboardCheck, label: '내 업무',   desc: '할당된 업무 보기' },
                ].map(({ href, icon: Icon, label, desc }) => (
                  <Link key={href} href={href}>
                    <div className="bg-white rounded-xl border border-border shadow-card p-4 hover:border-primary-200 hover:shadow-card-hover transition-all cursor-pointer">
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
          )}
        </div>

        {/* 관리자 전용: 오늘 팀 현황 */}
        {isManager && (
          <div className="bg-white rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-semibold text-text-primary">오늘 팀 현황</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {records.length > 0
                    ? `${records.length}명 기록됨 · ${summary.normal ?? 0}명 정상 출근`
                    : '아직 출근 기록이 없습니다'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                {[
                  { dot: 'bg-emerald-400', label: '정상' },
                  { dot: 'bg-amber-400',   label: '지각' },
                  { dot: 'bg-red-400',     label: '결근' },
                  { dot: 'bg-blue-400',    label: '휴가' },
                  { dot: 'bg-gray-300',    label: '대기' },
                ].map(({ dot, label }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className={clsx('w-2 h-2 rounded-full', dot)} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <TeamPresence records={records} />
          </div>
        )}

        {/* 진행 중 업무 */}
        <div className="bg-white rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary-500" />
                진행 중 업무
              </h3>
              <p className="text-xs text-text-muted mt-0.5">in_progress 상태 최근 8건</p>
            </div>
            <Link
              href="/tasks"
              className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              전체 보기 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-6 pb-5">
            {tasksLoading ? (
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
      </main>
    </div>
  );
}
