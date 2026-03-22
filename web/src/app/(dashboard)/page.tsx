'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Users, Clock, AlertCircle, ClipboardCheck,
  LogIn, LogOut, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, { TASK_STATUS_BADGE, TASK_PRIORITY_BADGE, ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonStatCard } from '@/components/ui/Skeleton';

// ── 통계 카드 ──────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, trend }: {
  label: string; value: string | number; icon: any; iconBg: string; trend?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
        <p className="text-xs font-medium text-text-muted mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

// ── 출퇴근 액션 카드 ──────────────────────────────────
function ClockCard() {
  const [now, setNow] = useState(new Date());
  const today = format(now, 'yyyy-MM-dd');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: myAttendance, isLoading } = useQuery({
    queryKey: ['attendance-me-today', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', {
        params: { start_date: today, end_date: today },
      });
      return data.data?.records?.[0] ?? null;
    },
  });

  const canClockIn  = !myAttendance?.clockInAt;
  const canClockOut = !!myAttendance?.clockInAt && !myAttendance?.clockOutAt;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-text-secondary">
            {format(now, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </p>
          <p className="text-4xl font-bold text-text-primary tabular-nums mt-0.5">
            {format(now, 'HH:mm:ss')}
          </p>
        </div>
        {myAttendance?.status && (
          <Badge value={myAttendance.status} colorMap={ATTENDANCE_STATUS_BADGE}
            label={({ normal: '정상', late: '지각', early_leave: '조퇴', absent: '결근', vacation: '휴가', pending: '대기' } as Record<string, string>)[myAttendance.status] ?? myAttendance.status}
          />
        )}
      </div>

      {myAttendance && (
        <div className="flex gap-6 text-sm text-text-secondary mb-5 pb-5 border-b border-border">
          <span>출근 <b className="text-text-primary font-semibold">
            {myAttendance.clockInAt ? format(new Date(myAttendance.clockInAt), 'HH:mm') : '-'}
          </b></span>
          <span>퇴근 <b className="text-text-primary font-semibold">
            {myAttendance.clockOutAt ? format(new Date(myAttendance.clockOutAt), 'HH:mm') : '-'}
          </b></span>
          {myAttendance.totalWorkMinutes != null && myAttendance.clockOutAt && (
            <span>근무 <b className="text-text-primary font-semibold">
              {Math.floor(myAttendance.totalWorkMinutes / 60)}h {myAttendance.totalWorkMinutes % 60}m
            </b></span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/attendance"
          className={buttonVariants({
            variant: 'primary',
            size: 'lg',
            className: clsx('flex-1 justify-center', !canClockIn && 'pointer-events-none opacity-40'),
          })}
        >
          <LogIn className="h-4 w-4" />
          출근
        </Link>
        <Link
          href="/attendance"
          className={buttonVariants({
            variant: 'secondary',
            size: 'lg',
            className: clsx('flex-1 justify-center', !canClockOut && 'pointer-events-none opacity-40'),
          })}
        >
          <LogOut className="h-4 w-4" />
          퇴근
        </Link>
      </div>
    </Card>
  );
}

// ── 메인 ──────────────────────────────────────────────
export default function DashboardPage() {
  usePageTitle('대시보드');
  const user = useAuthStore((s) => s.user);
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: attendanceData } = useQuery({
    queryKey: ['attendance', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: user?.role !== 'employee',
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-recent'],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { limit: 5, status: 'in_progress' } });
      return data;
    },
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data?.currentSubscription ?? null;
    },
    enabled: user?.role === 'owner',
  });

  const summary = attendanceData?.meta?.summary ?? {};

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="대시보드" />

      <main className="page-container">
        {/* 구독 배너 */}
        {user?.role === 'owner' && subscriptionData?.status === 'trialing' && (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-primary-700">
                무료 체험 중 — {Math.max(0, subscriptionData.daysRemaining ?? 0)}일 남음
              </p>
              <p className="text-xs text-primary-500 mt-0.5">체험 기간 종료 전에 플랜을 선택하세요.</p>
            </div>
            <Link
              href="/onboarding/plan"
              className="text-xs font-semibold bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex-shrink-0"
            >
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
            <Link
              href="/settings"
              className="text-xs font-semibold bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex-shrink-0"
            >
              결제 수단 확인
            </Link>
          </div>
        )}

        {/* 인사말 */}
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            안녕하세요, {user?.name}님
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </p>
        </div>

        {/* 상단 그리드: 출퇴근 + 통계 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 출퇴근 액션 */}
          <div className="lg:col-span-1">
            <ClockCard />
          </div>

          {/* 통계 카드 (관리자) */}
          {user?.role !== 'employee' ? (
            <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
              {tasksLoading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
              ) : (
                <>
                  <StatCard label="오늘 출근" value={summary.normal ?? 0} icon={Users} iconBg="bg-emerald-500" />
                  <StatCard label="지각" value={summary.late ?? 0} icon={Clock} iconBg="bg-amber-500" />
                  <StatCard label="결근" value={summary.absent ?? 0} icon={AlertCircle} iconBg="bg-red-500" />
                  <StatCard label="진행 중 업무" value={tasksData?.meta?.status_summary?.in_progress ?? 0} icon={ClipboardCheck} iconBg="bg-primary-500" />
                </>
              )}
            </div>
          ) : (
            /* 직원: 빠른 링크 */
            <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
              {[
                { href: '/attendance', icon: Clock, label: '출퇴근 기록', desc: '이번 달 근태 확인' },
                { href: '/tasks', icon: ClipboardCheck, label: '내 업무', desc: '할당된 업무 보기' },
                { href: '/schedule', icon: TrendingUp, label: '일정', desc: '오늘 일정 확인' },
                { href: '/messages', icon: Users, label: '메시지', desc: '팀 커뮤니케이션' },
              ].map(({ href, icon: Icon, label, desc }) => (
                <Link key={href} href={href}>
                  <Card className="p-5 cursor-pointer hover:border-primary-200 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-primary-500" />
                    </div>
                    <p className="text-sm font-semibold text-text-primary">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 진행 중 업무 */}
        <Card>
          <CardHeader
            title="진행 중 업무"
            description="in_progress 상태 최근 5건"
            action={
              <Link href="/tasks" className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors">
                전체 보기 →
              </Link>
            }
          />
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  {['업무명', '담당자', '마감일', '우선순위', '상태'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasksLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3.5 border-b border-border/60">
                          <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : tasksData?.tasks?.length ? (
                  tasksData.tasks.map((task: any) => (
                    <tr key={task.id} className="border-b border-border/60 hover:bg-background transition-colors">
                      <td className="px-4 py-3.5 text-sm text-text-primary font-medium max-w-[240px] truncate">
                        {task.title}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">
                        {task.assignee?.name ?? '미배정'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary tabular-nums">
                        {task.dueDate ?? '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge value={task.priority} colorMap={TASK_PRIORITY_BADGE} />
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge value={task.status} colorMap={TASK_STATUS_BADGE} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">
                      진행 중인 업무가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
