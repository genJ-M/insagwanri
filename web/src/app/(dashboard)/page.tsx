'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Users, Clock, ClipboardCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, { TASK_STATUS_BADGE, ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonStatCard, SkeletonCard } from '@/components/ui/Skeleton';

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: any; color: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  usePageTitle('대시보드');
  const user = useAuthStore((s) => s.user);
  const today = format(new Date(), 'yyyy-MM-dd');

  // 오늘 근태 현황
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: user?.role !== 'employee',
  });

  // 내 근태
  const { data: myAttendance, isLoading: myAttLoading } = useQuery({
    queryKey: ['attendance-me', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', {
        params: { start_date: today, end_date: today },
      });
      return data.data?.records?.[0] ?? null;
    },
  });

  // 업무 목록 (최근 5개)
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-recent'],
    queryFn: async () => {
      const { data } = await api.get('/tasks', {
        params: { limit: 5, status: 'in_progress' },
      });
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

      <main className="p-6 space-y-6">
        {/* 구독 상태 배너 (owner만) */}
        {user?.role === 'owner' && subscriptionData?.status === 'trialing' && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-800">
                무료 체험 중 — {Math.max(0, subscriptionData.daysRemaining ?? 0)}일 남음
              </p>
              <p className="text-xs text-blue-600 mt-0.5">체험 기간 종료 전에 플랜을 선택하세요.</p>
            </div>
            <Link href="/onboarding/plan" className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex-shrink-0">
              플랜 선택
            </Link>
          </div>
        )}
        {user?.role === 'owner' && subscriptionData?.status === 'past_due' && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-red-800">결제 실패 — 서비스가 곧 정지될 수 있습니다</p>
              <p className="text-xs text-red-600 mt-0.5">결제 수단을 확인하거나 변경하세요.</p>
            </div>
            <Link href="/subscription" className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 flex-shrink-0">
              결제 수단 확인
            </Link>
          </div>
        )}

        {/* 인사말 */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            안녕하세요, {user?.name}님 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </p>
        </div>

        {/* 내 출퇴근 상태 */}
        {myAttLoading ? (
          <SkeletonCard lines={2} />
        ) : (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">오늘 내 근태</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {myAttendance?.clockInAt
                    ? `출근 ${format(new Date(myAttendance.clockInAt), 'HH:mm')}`
                    : '미출근'}
                  {myAttendance?.clockOutAt &&
                    ` → 퇴근 ${format(new Date(myAttendance.clockOutAt), 'HH:mm')}`}
                </p>
              </div>
              {myAttendance?.status && (
                <Badge value={myAttendance.status} colorMap={ATTENDANCE_STATUS_BADGE} />
              )}
            </div>
          </Card>
        )}

        {/* 관리자용 통계 */}
        {user?.role !== 'employee' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tasksLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
            ) : (
              <>
                <StatCard label="정상 출근" value={summary.normal ?? 0} icon={Users} color="bg-green-500" />
                <StatCard label="지각" value={summary.late ?? 0} icon={Clock} color="bg-yellow-500" />
                <StatCard label="결근" value={summary.absent ?? 0} icon={AlertCircle} color="bg-red-500" />
                <StatCard label="진행 중 업무" value={tasksData?.meta?.status_summary?.in_progress ?? 0} icon={ClipboardCheck} color="bg-blue-500" />
              </>
            )}
          </div>
        )}

        {/* 진행 중 업무 */}
        <Card>
          <CardHeader title="진행 중 업무" description="최근 업무 목록" />
          {tasksLoading ? (
            <div className="space-y-2 mt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                    <div className="h-3 bg-gray-200 animate-pulse rounded w-1/3" />
                  </div>
                  <div className="h-5 w-12 bg-gray-200 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {tasksData?.tasks?.length ? (
                tasksData.tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        담당: {task.assignee?.name ?? '미배정'} · 마감 {task.dueDate ?? '-'}
                      </p>
                    </div>
                    <Badge value={task.priority} colorMap={TASK_STATUS_BADGE} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">진행 중인 업무가 없습니다.</p>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
