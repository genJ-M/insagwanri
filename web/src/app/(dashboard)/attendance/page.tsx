'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth,
  addMonths, subMonths, getDaysInMonth, getDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  LogIn, LogOut, MapPin, ChevronLeft, ChevronRight,
  Users, Clock, AlertTriangle, TrendingDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, { ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AttendanceRecord } from '@/types';

const STATUS_KO: Record<string, string> = {
  pending: '대기', normal: '정상', late: '지각',
  early_leave: '조퇴', absent: '결근', half_day: '반차', vacation: '휴가',
};

// ── 이 달 평일 수 계산 ──────────────────────────────────────
function workingDaysInMonth(year: number, month: number): number {
  const days = getDaysInMonth(new Date(year, month - 1));
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const day = getDay(new Date(year, month - 1, d));
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// ── 근무율 바 ────────────────────────────────────────────────
function WorkRateBar({ rate }: { rate: number }) {
  const color =
    rate >= 90 ? 'bg-emerald-400' :
    rate >= 70 ? 'bg-amber-400'   : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <span className={clsx(
        'text-xs font-semibold tabular-nums w-9 text-right',
        rate >= 90 ? 'text-emerald-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600',
      )}>
        {rate.toFixed(0)}%
      </span>
    </div>
  );
}

// ── 직원 근태 상세 모달 ──────────────────────────────────────
function EmployeeAttendanceModal({ employee, onClose }: {
  employee: { id: string; name: string; department?: string };
  onClose: () => void;
}) {
  const [month, setMonth] = useState(new Date());
  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate   = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-employee', employee.id, startDate],
    queryFn: async () => {
      const { data } = await api.get('/attendance', {
        params: { user_id: employee.id, start_date: startDate, end_date: endDate },
      });
      return (data.data?.records ?? data.records ?? []) as AttendanceRecord[];
    },
  });

  const records = data ?? [];
  const summary = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Modal open onClose={onClose} title={employee.name} subtitle={employee.department} size="md" scrollable bodyClassName="p-0">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors" aria-label="이전 달">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">{format(month, 'yyyy년 M월', { locale: ko })}</span>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} disabled={month >= new Date()} className="p-1.5 rounded-lg hover:bg-background text-text-secondary disabled:opacity-30 transition-colors" aria-label="다음 달">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-4 px-5 py-3 bg-background border-b border-border text-xs">
        {[
          { key: 'normal', label: '정상', color: 'text-emerald-600' },
          { key: 'late', label: '지각', color: 'text-amber-600' },
          { key: 'absent', label: '결근', color: 'text-red-600' },
          { key: 'early_leave', label: '조퇴', color: 'text-orange-500' },
          { key: 'vacation', label: '휴가', color: 'text-primary-500' },
        ].map(({ key, label, color }) => (
          <div key={key} className="text-center">
            <p className={`text-base font-bold ${color}`}>{summary[key] ?? 0}</p>
            <p className="text-text-muted">{label}</p>
          </div>
        ))}
        <div className="text-center ml-auto">
          <p className="text-base font-bold text-text-primary">{records.length}</p>
          <p className="text-text-muted">기록</p>
        </div>
      </div>
      <div>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : records.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-10">이 달 근태 기록이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border">
                {['날짜', '출근', '퇴근', '근무시간', '상태'].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-background transition-colors">
                  <td className="py-2.5 px-4 text-text-primary tabular-nums">{format(new Date(r.workDate), 'M/d (EEE)', { locale: ko })}</td>
                  <td className="py-2.5 px-4 tabular-nums text-text-secondary">{r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}</td>
                  <td className="py-2.5 px-4 tabular-nums text-text-secondary">{r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}</td>
                  <td className="py-2.5 px-4 text-text-secondary">{r.totalWorkMinutes ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m` : '-'}</td>
                  <td className="py-2.5 px-4"><Badge value={r.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[r.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

// ── 요약 카드 ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-primary tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── 팀 통계 탭 ──────────────────────────────────────────────
function TeamStatsTab({ onSelectEmployee }: {
  onSelectEmployee: (e: { id: string; name: string; department?: string }) => void;
}) {
  const [month, setMonth] = useState(new Date());
  const year  = month.getFullYear();
  const mon   = month.getMonth() + 1;
  const wdays = workingDaysInMonth(year, mon);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-report', year, mon],
    queryFn: async () => {
      const { data } = await api.get('/attendance/report', { params: { year, month: mon } });
      return data.data ?? data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.data ?? data;
    },
  });

  // 멤버 리스트 기준으로 rows 구성 (근태 데이터 없어도 표시)
  const rows = useMemo(() => {
    const empMap = new Map<string, any>();
    (data?.employees ?? []).forEach((e: any) => empMap.set(e.user_id, e));

    return (members as any[]).map((m) => {
      const stat = empMap.get(m.id);
      const workDays = stat?.work_days ?? 0;
      const rate = wdays > 0 ? (workDays / wdays) * 100 : 0;
      return {
        id:          m.id,
        name:        m.name,
        department:  m.department,
        position:    m.position,
        workDays,
        rate,
        late:        stat?.late_days ?? 0,
        absent:      stat?.absent_days ?? 0,
        avgClockIn:  stat?.avg_clock_in ?? null,
        totalHours:  stat ? Math.round(stat.total_work_minutes / 60 * 10) / 10 : 0,
      };
    });
  }, [data, members, wdays]);

  const summary = data?.summary;
  const isFuture = month > new Date();

  return (
    <div className="space-y-5">
      {/* 월 네비 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 text-text-secondary transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold text-text-primary w-28 text-center">
            {format(month, 'yyyy년 M월', { locale: ko })}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={isFuture}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 text-text-secondary disabled:opacity-30 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-text-muted">평일 {wdays}일 기준</span>
      </div>

      {/* 요약 카드 4종 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Users}         label="총 인원"        value={isLoading ? '-' : summary?.total_employees ?? members.length} sub="명" accent="bg-primary-500" />
        <StatCard icon={Clock}         label="평균 근무"       value={isLoading ? '-' : `${summary?.avg_work_hours ?? 0}h`} sub="월 평균" accent="bg-emerald-500" />
        <StatCard icon={AlertTriangle} label="지각 건수"       value={isLoading ? '-' : summary?.total_late_count ?? 0} sub="건" accent="bg-amber-400" />
        <StatCard icon={TrendingDown}  label="결근 건수"       value={isLoading ? '-' : summary?.total_absent_count ?? 0} sub="건" accent="bg-red-400" />
      </div>

      {/* 통계 테이블 */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                {[
                  { label: '직원',     w: '' },
                  { label: '근무율',   w: 'w-40' },
                  { label: '근무일',   w: 'w-20' },
                  { label: '지각',     w: 'w-16' },
                  { label: '결근',     w: 'w-16' },
                  { label: '평균출근', w: 'w-24' },
                  { label: '총근무',   w: 'w-24' },
                ].map(({ label, w }) => (
                  <th key={label} className={clsx('px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide', w)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-text-muted text-sm">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-primary-50/40 cursor-pointer transition-colors group"
                    onClick={() => onSelectEmployee({ id: row.id, name: row.name, department: row.department })}
                  >
                    {/* 직원 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} size="md" />
                        <div>
                          <p className="text-sm font-medium text-text-primary group-hover:text-primary-600 transition-colors">
                            {row.name}
                          </p>
                          <p className="text-xs text-text-muted">
                            {[row.department, row.position].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 근무율 바 */}
                    <td className="px-4 py-3">
                      <WorkRateBar rate={row.rate} />
                    </td>

                    {/* 근무일 */}
                    <td className="px-4 py-3 tabular-nums text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">{row.workDays}</span>
                      <span className="text-text-muted">/{wdays}일</span>
                    </td>

                    {/* 지각 */}
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-sm font-semibold tabular-nums',
                        row.late > 0 ? 'text-amber-500' : 'text-text-muted',
                      )}>
                        {row.late > 0 ? row.late : '—'}
                      </span>
                    </td>

                    {/* 결근 */}
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-sm font-semibold tabular-nums',
                        row.absent > 0 ? 'text-red-500' : 'text-text-muted',
                      )}>
                        {row.absent > 0 ? row.absent : '—'}
                      </span>
                    </td>

                    {/* 평균출근 */}
                    <td className="px-4 py-3 tabular-nums text-sm text-text-secondary">
                      {row.avgClockIn ?? <span className="text-text-muted">—</span>}
                    </td>

                    {/* 총근무시간 */}
                    <td className="px-4 py-3 tabular-nums text-sm text-text-secondary">
                      {row.totalHours > 0
                        ? <><span className="font-medium text-text-primary">{row.totalHours}</span>h</>
                        : <span className="text-text-muted">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 범례 */}
        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex items-center gap-5 text-xs text-text-muted">
          <span>근무율:</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />90% 이상</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />70–90%</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />70% 미만</span>
          <span className="ml-auto">행 클릭 시 월별 상세 이력 조회</span>
        </div>
      </div>
    </div>
  );
}

// 상태별 셀 색상
const CELL_COLOR: Record<string, string> = {
  normal:      'bg-emerald-100 text-emerald-700',
  late:        'bg-amber-100 text-amber-700',
  absent:      'bg-red-100 text-red-700',
  early_leave: 'bg-orange-100 text-orange-700',
  vacation:    'bg-primary-100 text-primary-600',
  half_day:    'bg-indigo-100 text-indigo-600',
  pending:     'bg-gray-100 text-gray-400',
};
const CELL_SHORT: Record<string, string> = {
  normal: '정', late: '지', absent: '결', early_leave: '조', vacation: '휴', half_day: '반', pending: '?',
};

function MonthlyGridTab() {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear();
  const mon  = month.getMonth() + 1;
  const daysInMonth = getDaysInMonth(month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate   = format(endOfMonth(month), 'yyyy-MM-dd');

  // 월간 전체 출결 레코드 (관리자용)
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance-monthly-grid', year, mon],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { start_date: startDate, end_date: endDate } });
      return (data.data?.records ?? data.records ?? []) as AttendanceRecord[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team'],
    queryFn: async () => { const { data } = await api.get('/users'); return data.data ?? data; },
  });

  // userId → (day → status) 맵
  const grid = useMemo(() => {
    const map = new Map<string, Map<number, string>>();
    for (const r of records as any[]) {
      const uid = r.userId ?? r.user_id;
      if (!uid) continue;
      if (!map.has(uid)) map.set(uid, new Map());
      const d = new Date(r.workDate ?? r.work_date);
      map.get(uid)!.set(d.getDate(), r.status);
    }
    return map;
  }, [records]);

  const isFuture = month > new Date();

  return (
    <div className="space-y-4">
      {/* 월 네비 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 text-text-secondary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold text-text-primary w-28 text-center">
          {format(month, 'yyyy년 M월', { locale: ko })}
        </span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={isFuture}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 text-text-secondary disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(CELL_SHORT).filter(([k]) => k !== 'pending').map(([k, v]) => (
          <span key={k} className={clsx('px-2 py-0.5 rounded-full font-medium', CELL_COLOR[k])}>
            {v} {STATUS_KO[k]}
          </span>
        ))}
      </div>

      {/* 그리드 */}
      <div className="bg-white rounded-2xl border border-border overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <table className="text-xs border-collapse w-max min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[100px] border-b border-r border-border">직원</th>
                {days.map((d) => {
                  const date = new Date(year, mon - 1, d);
                  const dow = getDay(date);
                  return (
                    <th
                      key={d}
                      className={clsx(
                        'w-8 min-w-[32px] py-2 text-center font-semibold border-b border-border',
                        dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-500',
                      )}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(members as any[]).map((m) => {
                const dayMap = grid.get(m.id);
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-primary-50/30 transition-colors">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text-primary truncate max-w-[70px]">{m.name}</span>
                        {m.department && <span className="text-text-muted truncate max-w-[40px]">{m.department}</span>}
                      </div>
                    </td>
                    {days.map((d) => {
                      const status = dayMap?.get(d);
                      const date = new Date(year, mon - 1, d);
                      const isWeekend = [0, 6].includes(getDay(date));
                      return (
                        <td
                          key={d}
                          className={clsx(
                            'text-center py-1.5 border-r border-gray-50',
                            isWeekend && 'bg-gray-50/60',
                          )}
                        >
                          {status ? (
                            <span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold', CELL_COLOR[status])}>
                              {CELL_SHORT[status]}
                            </span>
                          ) : (
                            <span className="text-gray-200">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────
export default function AttendancePage() {
  usePageTitle('출퇴근');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const today = format(now, 'yyyy-MM-dd');
  const [geoError, setGeoError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; department?: string } | null>(null);
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  type TabKey = 'me' | 'today' | 'stats' | 'grid';
  const [tab, setTab] = useState<TabKey>('me');

  const TABS: { key: TabKey; label: string; managerOnly?: boolean }[] = [
    { key: 'me',    label: '내 근태' },
    { key: 'today', label: '오늘 현황', managerOnly: true },
    { key: 'stats', label: '팀 통계',   managerOnly: true },
    { key: 'grid',  label: '월간 뷰',   managerOnly: true },
  ];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: myToday } = useQuery({
    queryKey: ['attendance-me-today'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', { params: { start_date: today, end_date: today } });
      return (data.data?.records?.[0] ?? null) as AttendanceRecord | null;
    },
  });

  const { data: allAttendance } = useQuery({
    queryKey: ['attendance-all', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: isManager && tab === 'today',
  });

  const clockInMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) => api.post('/attendance/clock-in', pos),
    onSuccess: () => {
      toast.success(`출근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '출근 처리에 실패했습니다.'),
  });

  const clockOutMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) => api.post('/attendance/clock-out', pos),
    onSuccess: () => {
      toast.success(`퇴근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '퇴근 처리에 실패했습니다.'),
  });

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => { setGeoError('위치 정보를 가져올 수 없습니다.'); setTimeout(() => setGeoError(''), 3000); resolve(null); },
        { timeout: 5000 },
      );
    });

  const handleClockIn  = async () => { const pos = await getLocation(); clockInMutation.mutate(pos ?? {}); };
  const handleClockOut = async () => { const pos = await getLocation(); clockOutMutation.mutate(pos ?? {}); };

  const canClockIn  = !myToday?.clockInAt;
  const canClockOut = !!myToday?.clockInAt && !myToday?.clockOutAt;

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-5 max-w-[1200px]">
        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.filter((t) => !t.managerOnly || isManager).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                tab === t.key
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 내 근태 탭 ── */}
        {tab === 'me' && (
          <div className="space-y-5">
            <Card>
              <div className="text-center py-4">
                <p className="text-sm text-text-secondary mb-1">
                  {format(now, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                </p>
                <p className="text-5xl font-bold text-text-primary tabular-nums mb-6 tracking-tight">
                  {format(now, 'HH:mm:ss')}
                </p>

                <div className="flex justify-center gap-3">
                  <Button onClick={handleClockIn} disabled={!canClockIn} loading={clockInMutation.isPending} size="lg" className="px-10">
                    <LogIn className="h-5 w-5" /> 출근
                  </Button>
                  <Button onClick={handleClockOut} disabled={!canClockOut} loading={clockOutMutation.isPending} variant="secondary" size="lg" className="px-10">
                    <LogOut className="h-5 w-5" /> 퇴근
                  </Button>
                </div>

                {myToday && (
                  <div className="mt-6 inline-flex gap-6 bg-gray-50 rounded-2xl px-6 py-3 text-sm text-text-secondary">
                    <span>출근 <b className="text-text-primary">{myToday.clockInAt ? format(new Date(myToday.clockInAt), 'HH:mm') : '-'}</b></span>
                    <span>퇴근 <b className="text-text-primary">{myToday.clockOutAt ? format(new Date(myToday.clockOutAt), 'HH:mm') : '-'}</b></span>
                    {myToday.totalWorkMinutes != null && myToday.clockOutAt && (
                      <span>근무 <b className="text-text-primary">{Math.floor(myToday.totalWorkMinutes / 60)}h {myToday.totalWorkMinutes % 60}m</b></span>
                    )}
                    <Badge value={myToday.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[myToday.status]} />
                  </div>
                )}

                {geoError && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl mx-auto max-w-sm">
                    <MapPin className="h-4 w-4 flex-shrink-0" />{geoError}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── 오늘 현황 탭 ── */}
        {tab === 'today' && isManager && (
          <Card padding="none">
            <div className="px-6 py-4 border-b border-border">
              <CardHeader title="오늘 근태 현황" description={`${today} 기준`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['이름', '부서', '출근', '퇴근', '근무시간', '상태'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAttendance?.records?.map((r: AttendanceRecord) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 hover:bg-background transition-colors cursor-pointer"
                      onClick={() => r.user && setSelectedEmployee({ id: r.user.id, name: r.user.name, department: r.user.department })}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.user?.name ?? '?'} size="sm" />
                          <span className="text-sm font-medium text-text-primary">{r.user?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">{r.user?.department ?? '-'}</td>
                      <td className="px-4 py-3.5 text-sm tabular-nums">{r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}</td>
                      <td className="px-4 py-3.5 text-sm tabular-nums">{r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">{r.totalWorkMinutes ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m` : '-'}</td>
                      <td className="px-4 py-3.5"><Badge value={r.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[r.status]} /></td>
                    </tr>
                  ))}
                  {!allAttendance?.records?.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">근태 데이터가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── 팀 통계 탭 ── */}
        {tab === 'stats' && isManager && (
          <TeamStatsTab onSelectEmployee={setSelectedEmployee} />
        )}

        {/* ── 월간 뷰 탭 ── */}
        {tab === 'grid' && isManager && (
          <MonthlyGridTab />
        )}
      </main>

      {selectedEmployee && (
        <EmployeeAttendanceModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
