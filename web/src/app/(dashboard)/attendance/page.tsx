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
  Users, Clock, AlertTriangle, TrendingDown, QrCode, RefreshCw, Zap,
  Home, Wifi, TriangleAlert, ShieldCheck, Printer, Moon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
import { OvertimeRequestModal } from '@/components/templates/OvertimeRequestModal';

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

// ── 52시간 위젯 ──────────────────────────────────────────────
function WeeklyHoursWidget({ data }: { data: any }) {
  if (!data) return null;
  const { totalHours, remainHours, overtimeHours, percentage, isOver52h, inProgress, weekStart, weekEnd } = data;
  const barColor = isOver52h ? 'bg-red-500' : percentage >= 80 ? 'bg-amber-400' : 'bg-primary-500';
  const textColor = isOver52h ? 'text-red-600' : percentage >= 80 ? 'text-amber-600' : 'text-primary-600';

  return (
    <div className={clsx(
      'rounded-2xl border p-4 space-y-3',
      isOver52h ? 'bg-red-50 border-red-200' : 'bg-white border-border',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={clsx('h-4 w-4', textColor)} />
          <span className="text-sm font-semibold text-text-primary">주간 근무시간</span>
          {inProgress && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">진행중</span>
          )}
        </div>
        <span className="text-xs text-text-muted">{weekStart?.slice(5)} ~ {weekEnd?.slice(5)}</span>
      </div>

      {/* 진행 바 */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className={clsx('font-bold text-base tabular-nums', textColor)}>{totalHours}h</span>
          <span className="text-text-muted">/ 52h</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="flex justify-between text-xs">
        {isOver52h ? (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <TriangleAlert className="h-3.5 w-3.5" /> 52시간 초과 {overtimeHours}h
          </span>
        ) : (
          <span className="text-text-muted">잔여 <b className="text-text-primary">{remainHours}h</b></span>
        )}
        <span className={clsx('font-semibold tabular-nums', textColor)}>{percentage}%</span>
      </div>
    </div>
  );
}

// ── 임금 내역 탭 (파트타임/아르바이트) ────────────────────────
function WageReportTab({ userId }: { userId: string }) {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(now, 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['wage-report', userId, startDate, endDate],
    queryFn: () =>
      api.get('/attendance/wage-report', { params: { start_date: startDate, end_date: endDate } })
         .then(r => r.data.data),
    enabled: !!startDate && !!endDate,
  });

  return (
    <div className="space-y-4">
      {/* 기간 선택 */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-text-muted">시작일</label>
            <input type="date" className="input text-xs py-1.5 w-36" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-text-muted">종료일</label>
            <input type="date" className="input text-xs py-1.5 w-36" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card><div className="text-center py-6 text-sm text-text-secondary">임금 계산 중...</div></Card>
      )}

      {data && (
        <>
          {/* 시급 미설정 안내 */}
          {!data.hourlyRate && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              시급이 설정되지 않아 임금 계산이 불가합니다. 관리자에게 시급 등록을 요청해주세요.
            </div>
          )}

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '총 근무 시간', value: `${data.totalNetHours}h` },
              { label: '시급', value: data.hourlyRate ? `${data.hourlyRate.toLocaleString()}원` : '미설정' },
              { label: '총 임금', value: data.totalWage ? `${data.totalWage.toLocaleString()}원` : '—' },
              {
                label: '주휴수당 발생',
                value: data.qualifiesForWeeklyHolidayPay
                  ? (data.weeklyHolidayPay ? `${data.weeklyHolidayPay.toLocaleString()}원` : '발생')
                  : '미발생',
              },
            ].map(({ label, value }) => (
              <Card key={label} className="text-center p-4">
                <p className="text-xs text-text-muted mb-1">{label}</p>
                <p className="text-base font-bold text-text-primary">{value}</p>
              </Card>
            ))}
          </div>

          {/* 주휴수당 발생 배너 */}
          {data.qualifiesForWeeklyHolidayPay && (
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-xs text-violet-800">
              이 기간에 주 15시간 이상 근무하여 <b>주휴수당이 발생</b>했습니다. (근로기준법 제55조)
              {data.weeklyHolidayPay ? ` 예상 주휴수당: 약 ${data.weeklyHolidayPay.toLocaleString()}원` : ''}
            </div>
          )}

          {/* 일별 내역 테이블 */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="px-3 py-2 text-left font-medium">날짜</th>
                    <th className="px-3 py-2 text-right font-medium">총 근무</th>
                    <th className="px-3 py-2 text-right font-medium">인정 분수</th>
                    <th className="px-3 py-2 text-right font-medium">당일 임금</th>
                    <th className="px-3 py-2 text-center font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data.records ?? []).map((r: any) => (
                    <tr key={r.workDate} className="hover:bg-surface-secondary">
                      <td className="px-3 py-2 text-text-primary font-medium">{r.workDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                        {r.totalWorkMinutes != null
                          ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                        {r.roundedWorkMinutes != null
                          ? `${Math.floor(r.roundedWorkMinutes / 60)}h ${r.roundedWorkMinutes % 60}m`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                        {r.wageAmount ? `${Number(r.wageAmount).toLocaleString()}원` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          r.status === 'normal' ? 'bg-green-100 text-green-700' :
                          r.status === 'late' ? 'bg-amber-100 text-amber-700' :
                          r.status === 'absent' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600',
                        )}>
                          {STATUS_KO[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.totalWage > 0 && (
                  <tfoot className="border-t-2 border-border">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-text-primary">합계</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-emerald-700 tabular-nums">
                        {data.totalWage.toLocaleString()}원
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── 감사 로그 탭 (공공기관) ──────────────────────────────────
const FLEX_TYPE_LABEL: Record<string, string> = {
  regular:       '일반',
  staggered:     '시차출퇴근',
  discretionary: '재량근무',
  intensive:     '집중근무',
};

function AuditLogTab() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(today);
  const [userId,    setUserId]    = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['team'],
    queryFn: async () => { const { data } = await api.get('/users'); return data.data ?? data; },
  });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audit-log', startDate, endDate, userId],
    queryFn: async () => {
      const params: any = { start_date: startDate, end_date: endDate };
      if (userId) params.user_id = userId;
      const { data } = await api.get('/attendance/audit-log', { params });
      return data.data;
    },
    enabled: false,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win || !data) return;
    const rows = (data.records ?? []).map((r: any) => `
      <tr>
        <td>${r.workDate}</td>
        <td>${r.user?.name ?? '—'} (${r.user?.department ?? ''})</td>
        <td>${r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>${r.clockOutAt ? new Date(r.clockOutAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>${r.totalWorkMinutes != null ? `${Math.floor(r.totalWorkMinutes/60)}h ${r.totalWorkMinutes%60}m` : '—'}</td>
        <td>${r.workLocation ?? '—'}</td>
        <td>${FLEX_TYPE_LABEL[r.flexType] ?? r.flexType ?? '—'}</td>
        <td>${r.status}</td>
        <td style="font-family:monospace;font-size:10px">${r.integrityHash}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>출퇴근 감사 로그 (${data.period?.start} ~ ${data.period?.end})</title>
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; margin: 20px; }
        h2 { font-size: 15px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background: #fafafa; }
        .chain { font-family: monospace; font-size: 10px; color: #555; margin-top: 8px; }
        @media print { .no-print { display:none; } }
      </style>
      </head><body>
      <h2>출퇴근 원본 감사 로그</h2>
      <div class="meta">
        기간: ${data.period?.start} ~ ${data.period?.end} &nbsp;|&nbsp;
        총 ${data.total}건 &nbsp;|&nbsp;
        생성: ${new Date(data.generatedAt).toLocaleString('ko-KR')}
      </div>
      <table>
        <thead><tr>
          <th>날짜</th><th>직원</th><th>출근</th><th>퇴근</th>
          <th>근무시간</th><th>위치</th><th>유연근무</th><th>상태</th><th>무결성 해시</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="chain">체인 해시: ${data.chainHash}</div>
      <div class="no-print" style="margin-top:16px">
        <button onclick="window.print()" style="padding:8px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">PDF로 저장 / 인쇄</button>
      </div>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-5">
      {/* 조회 조건 */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">시작일</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input w-40" />
        </div>
        <div>
          <label className="label">종료일</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input w-40" />
        </div>
        <div>
          <label className="label">직원 (선택)</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="input w-40">
            <option value="">전체</option>
            {(members as any[]).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? '조회 중...' : '조회'}
        </Button>
        {data && (
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> PDF 출력
          </Button>
        )}
      </div>

      {/* 결과 */}
      {data && (
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          {/* 헤더 */}
          <div className="px-5 py-3 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ShieldCheck className="h-4 w-4 text-primary-500" />
              총 {data.total}건
            </div>
            <span className="text-xs text-text-muted font-mono">체인 해시: {data.chainHash?.slice(0, 20)}…</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  {['날짜','직원','출근','퇴근','근무시간','위치','유연근무','상태','해시'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data.records ?? []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2 tabular-nums text-text-primary font-medium whitespace-nowrap">{r.workDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{r.user?.name ?? '—'}</span>
                      {r.user?.department && <span className="text-text-muted ml-1">{r.user.department}</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary whitespace-nowrap">
                      {r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm:ss') : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary whitespace-nowrap">
                      {r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm:ss') : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary whitespace-nowrap">
                      {r.totalWorkMinutes != null ? `${Math.floor(r.totalWorkMinutes/60)}h ${r.totalWorkMinutes%60}m` : '—'}
                    </td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{r.workLocation ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{FLEX_TYPE_LABEL[r.flexType] ?? '일반'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                        r.status === 'normal' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'late'   ? 'bg-amber-100 text-amber-700' :
                        r.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600',
                      )}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-text-muted">{r.integrityHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data && !isFetching && (
        <div className="text-center py-16 text-text-muted text-sm">
          기간을 선택하고 조회 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}

// ── 현장 외근 탭 ─────────────────────────────────────────────
const FIELD_CAT_KO: Record<string, string> = {
  customer: '고객사', site: '현장', warehouse: '창고', office: '사무소', other: '기타',
};

function FieldVisitPanel({ userId, isManager }: { userId: string; isManager: boolean }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [checkInLat, setCheckInLat] = useState('');
  const [checkInLng, setCheckInLng] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const qc = useQueryClient();

  const { data: locations = [] } = useQuery({
    queryKey: ['field-locations'],
    queryFn: async () => {
      const { data } = await api.get('/field-visits/locations', { params: { activeOnly: true } });
      return data.data ?? [];
    },
  });

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['field-visits', date, userId],
    queryFn: async () => {
      const { data } = await api.get('/field-visits/my', { params: { date } });
      return data.data ?? [];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['field-visits-summary', date, userId],
    queryFn: async () => {
      const { data } = await api.get('/field-visits/daily-summary', { params: { userId, date } });
      return data.data ?? null;
    },
    enabled: !!userId,
  });

  // 현재 열린 방문 (체크아웃 안 한 것)
  const openVisit = (visits as any[]).find((v: any) => !v.checkedOutAt);

  const checkInMut = useMutation({
    mutationFn: async () => {
      await api.post('/field-visits/check-in', {
        lat:             parseFloat(checkInLat),
        lng:             parseFloat(checkInLng),
        fieldLocationId: selectedLocId || undefined,
        purpose:         purpose || undefined,
        visitDate:       date,
      });
    },
    onSuccess: () => {
      toast.success('체크인 완료');
      setShowCheckInModal(false);
      setPurpose(''); setSelectedLocId(''); setCheckInLat(''); setCheckInLng('');
      qc.invalidateQueries({ queryKey: ['field-visits'] });
      qc.invalidateQueries({ queryKey: ['field-visits-summary'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '체크인 실패'),
  });

  const checkOutMut = useMutation({
    mutationFn: async (visitId: string) => {
      await api.patch(`/field-visits/${visitId}/check-out`, {
        lat: parseFloat(checkInLat) || 37.5,
        lng: parseFloat(checkInLng) || 127.0,
      });
    },
    onSuccess: () => {
      toast.success('체크아웃 완료');
      qc.invalidateQueries({ queryKey: ['field-visits'] });
      qc.invalidateQueries({ queryKey: ['field-visits-summary'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '체크아웃 실패'),
  });

  const getGps = () => {
    if (!navigator.geolocation) { toast.error('GPS를 지원하지 않는 브라우저입니다.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCheckInLat(pos.coords.latitude.toFixed(7));
        setCheckInLng(pos.coords.longitude.toFixed(7));
        toast.success('GPS 좌표를 가져왔습니다.');
      },
      () => toast.error('GPS 권한을 허용해주세요.'),
    );
  };

  return (
    <div className="space-y-4">
      {/* 날짜 + 요약 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-700"
            onClick={() => setDate(d => format(new Date(new Date(d).getTime() - 86400000), 'yyyy-MM-dd'))} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 font-medium" />
          <ChevronRight className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-700"
            onClick={() => setDate(d => format(new Date(new Date(d).getTime() + 86400000), 'yyyy-MM-dd'))} />
        </div>
        {summary && (
          <div className="flex items-center gap-3 text-sm">
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-semibold">
              방문 {summary.totalVisits}곳
            </span>
            {summary.totalFieldMin != null && (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
                총 {Math.floor(summary.totalFieldMin / 60)}h {summary.totalFieldMin % 60}m
              </span>
            )}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {openVisit ? (
            <Button size="sm" variant="danger" onClick={() => checkOutMut.mutate(openVisit.id)}
              loading={checkOutMut.isPending}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> 체크아웃
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowCheckInModal(true)}>
              <MapPin className="h-3.5 w-3.5 mr-1" /> 현장 체크인
            </Button>
          )}
        </div>
      </div>

      {/* 방문 목록 */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (visits as any[]).length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {date}에 방문 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {(visits as any[]).map((v: any) => {
            const inTime  = new Date(v.checkedInAt);
            const outTime = v.checkedOutAt ? new Date(v.checkedOutAt) : null;
            const durMin  = outTime ? Math.round((outTime.getTime() - inTime.getTime()) / 60000) : null;
            return (
              <div key={v.id} className={clsx(
                'bg-white rounded-xl border p-4 flex items-start gap-4 transition-shadow hover:shadow-sm',
                !v.checkedOutAt ? 'border-blue-300 shadow-blue-50 shadow-sm' : 'border-border',
              )}>
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-text-primary">
                      {v.fieldLocation?.name ?? '미등록 장소'}
                    </span>
                    {v.fieldLocation?.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {FIELD_CAT_KO[v.fieldLocation.category] ?? v.fieldLocation.category}
                      </span>
                    )}
                    {v.isOutOfRange && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        범위 밖 {v.inDistanceM}m
                      </span>
                    )}
                    {!v.checkedOutAt && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">진행 중</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span>{inTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 체크인</span>
                    {outTime && <span>→ {outTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 체크아웃</span>}
                    {durMin != null && <span className="font-semibold text-text-primary">{Math.floor(durMin/60)}h {durMin%60}m</span>}
                  </div>
                  {v.purpose && <p className="text-xs text-text-muted mt-1 truncate">{v.purpose}</p>}
                  {v.linkedTaskId && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      업무 일지 연결됨
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 체크인 모달 */}
      <Modal open={showCheckInModal} onClose={() => setShowCheckInModal(false)} title="현장 체크인">
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">방문지 선택 (선택)</label>
            <select value={selectedLocId} onChange={e => setSelectedLocId(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2">
              <option value="">미등록 장소 (Spot 체크인)</option>
              {(locations as any[]).map((loc: any) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({FIELD_CAT_KO[loc.category] ?? loc.category}, 반경 {loc.radiusM}m)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">방문 목적</label>
            <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
              placeholder="예: 신규 계약 미팅, A/S 방문"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">GPS 좌표</label>
            <div className="flex gap-2">
              <input type="number" step="0.0000001" placeholder="위도" value={checkInLat}
                onChange={e => setCheckInLat(e.target.value)}
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2" />
              <input type="number" step="0.0000001" placeholder="경도" value={checkInLng}
                onChange={e => setCheckInLng(e.target.value)}
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2" />
              <Button size="sm" variant="secondary" onClick={getGps}>
                <MapPin className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-1">GPS 버튼을 눌러 현재 위치를 자동 입력하거나 직접 입력하세요.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" variant="secondary" onClick={() => setShowCheckInModal(false)}>취소</Button>
            <Button className="flex-1" onClick={() => checkInMut.mutate()}
              loading={checkInMut.isPending}
              disabled={!checkInLat || !checkInLng}>
              체크인
            </Button>
          </div>
        </div>
      </Modal>
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

// ── 돌봄 기록 탭 (의료·돌봄직) ────────────────────────────────
const SESSION_TYPE_KO: Record<string, string> = {
  elderly_care: '노인 요양', disability_care: '장애인 지원',
  childcare: '보육', nursing: '간호', therapy: '재활치료',
  home_care: '방문 요양', other: '기타',
};
const LICENSE_TYPE_KO: Record<string, string> = {
  nurse: '간호사', nurse_aid: '간호조무사', care_worker: '요양보호사',
  social_worker: '사회복지사', childcare_teacher: '보육교사',
  physical_therapist: '물리치료사', occupational_therapist: '작업치료사',
  radiographer: '방사선사', medical_technologist: '임상병리사',
  paramedic: '응급구조사', dental_hygienist: '치위생사', other: '기타',
};

function CareWorkerPanel({ userId }: { userId: string }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'session' | 'license' | 'pay'>('session');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ type: 'elderly_care', recipientName: '', recipientId: '', voucherCode: '' });
  const [licenseForm, setLicenseForm] = useState({ type: 'care_worker', licenseNumber: '', label: '', issuedAt: '', expiresAt: '', issuer: '' });
  const [payRange, setPayRange] = useState({ start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), end: today });
  const qc = useQueryClient();

  const { data: sessions = [], isLoading: sessLoading } = useQuery({
    queryKey: ['care-sessions', date, userId],
    queryFn: async () => (await api.get('/care-worker/sessions', { params: { userId, date } })).data.data ?? [],
  });

  const { data: summary } = useQuery({
    queryKey: ['care-daily-summary', date, userId],
    queryFn: async () => (await api.get('/care-worker/sessions/daily-summary', { params: { userId, date } })).data.data ?? null,
    enabled: !!userId,
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['care-licenses', userId],
    queryFn: async () => (await api.get('/care-worker/licenses', { params: { userId } })).data.data ?? [],
  });

  const { data: fatigue } = useQuery({
    queryKey: ['care-fatigue', userId],
    queryFn: async () => (await api.get('/care-worker/fatigue', { params: { userId } })).data.data ?? null,
    enabled: !!userId,
  });

  const { data: payReport } = useQuery({
    queryKey: ['care-holiday-pay', payRange, userId],
    queryFn: async () => (await api.get('/care-worker/holiday-pay', {
      params: { userId, startDate: payRange.start, endDate: payRange.end },
    })).data.data ?? null,
  });

  const openSession  = (sessions as any[]).find((s: any) => !s.endedAt);

  const startMut = useMutation({
    mutationFn: async () => api.post('/care-worker/sessions/start', { ...sessionForm, sessionDate: date }),
    onSuccess: () => {
      toast.success('세션 시작');
      setShowSessionModal(false);
      setSessionForm({ type: 'elderly_care', recipientName: '', recipientId: '', voucherCode: '' });
      qc.invalidateQueries({ queryKey: ['care-sessions'] });
      qc.invalidateQueries({ queryKey: ['care-daily-summary'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '세션 시작 실패'),
  });

  const endMut = useMutation({
    mutationFn: async (id: string) => api.patch(`/care-worker/sessions/${id}/end`, {}),
    onSuccess: () => {
      toast.success('세션 종료');
      qc.invalidateQueries({ queryKey: ['care-sessions'] });
      qc.invalidateQueries({ queryKey: ['care-daily-summary'] });
    },
  });

  const addLicenseMut = useMutation({
    mutationFn: async () => api.post('/care-worker/licenses', { ...licenseForm, userId }),
    onSuccess: () => {
      toast.success('자격증 등록 완료');
      setShowLicenseModal(false);
      setLicenseForm({ type: 'care_worker', licenseNumber: '', label: '', issuedAt: '', expiresAt: '', issuer: '' });
      qc.invalidateQueries({ queryKey: ['care-licenses'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '등록 실패'),
  });

  const deleteLicenseMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/care-worker/licenses/${id}`),
    onSuccess: () => { toast.success('삭제됨'); qc.invalidateQueries({ queryKey: ['care-licenses'] }); },
  });

  // 만료 임박 자격증 (30일 이내)
  const expiringLicenses = (licenses as any[]).filter((l: any) => {
    if (!l.expiresAt) return false;
    const days = Math.ceil((new Date(l.expiresAt).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-4">
      {/* 피로도 경고 배너 */}
      {fatigue?.isOverThreshold && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span>이번 주 누적 돌봄 <b>{fatigue.weeklyHours}시간</b>으로 기준({fatigue.threshold}h)을 초과했습니다. 충분한 휴식이 필요합니다.</span>
        </div>
      )}
      {expiringLicenses.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <b>자격증 만료 임박:</b>{' '}
          {expiringLicenses.map((l: any) => `${LICENSE_TYPE_KO[l.type] ?? l.type} (${l.expiresAt})`).join(', ')}
        </div>
      )}

      {/* 서브탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['session', '돌봄 세션'], ['license', '자격증 관리'], ['pay', '가산수당']] as [string, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setActiveTab(k as any)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === k ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-primary')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 돌봄 세션 탭 ── */}
      {activeTab === 'session' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-700"
                onClick={() => setDate(d => format(new Date(new Date(d).getTime() - 86400000), 'yyyy-MM-dd'))} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="text-sm border border-border rounded-lg px-3 py-1.5 font-medium" />
              <ChevronRight className="h-4 w-4 cursor-pointer text-gray-400 hover:text-gray-700"
                onClick={() => setDate(d => format(new Date(new Date(d).getTime() + 86400000), 'yyyy-MM-dd'))} />
            </div>
            {summary && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full font-semibold">
                  수급자 {summary.recipientCount}명
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
                  {Math.floor(summary.totalMin / 60)}h {summary.totalMin % 60}m
                </span>
                {summary.nightSessions > 0 && (
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-semibold">
                    야간 {summary.nightSessions}건
                  </span>
                )}
                {summary.holidaySessions > 0 && (
                  <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-semibold">
                    휴일 {summary.holidaySessions}건
                  </span>
                )}
              </div>
            )}
            <div className="ml-auto flex gap-2">
              {openSession ? (
                <Button size="sm" variant="danger" onClick={() => endMut.mutate(openSession.id)} loading={endMut.isPending}>
                  <LogOut className="h-3.5 w-3.5 mr-1" /> 세션 종료
                </Button>
              ) : (
                <Button size="sm" onClick={() => setShowSessionModal(true)}>
                  <Users className="h-3.5 w-3.5 mr-1" /> 세션 시작
                </Button>
              )}
            </div>
          </div>

          {sessLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (sessions as any[]).length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {date}에 돌봄 세션 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {(sessions as any[]).map((s: any) => {
                const inT  = new Date(s.startedAt);
                const outT = s.endedAt ? new Date(s.endedAt) : null;
                const isOpen = !s.endedAt;
                return (
                  <div key={s.id} className={clsx(
                    'bg-white rounded-xl border p-4 flex items-start gap-4 transition-shadow hover:shadow-sm',
                    isOpen ? 'border-violet-300 shadow-violet-50 shadow-sm' : 'border-border',
                  )}>
                    <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{s.recipientName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {SESSION_TYPE_KO[s.type] ?? s.type}
                        </span>
                        {s.isHoliday && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">휴일</span>}
                        {s.hasNightHours && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">야간 포함</span>}
                        {Number(s.payRate) > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            ×{Number(s.payRate).toFixed(1)} 가산
                          </span>
                        )}
                        {isOpen && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 animate-pulse">진행 중</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                        <span>{inT.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {outT && <span>→ {outT.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        {s.durationMin != null && <span className="font-semibold text-text-primary">{Math.floor(s.durationMin/60)}h {s.durationMin%60}m</span>}
                        {s.voucherCode && <span className="font-mono">바우처 {s.voucherCode}</span>}
                      </div>
                      {s.note && <p className="text-xs text-text-muted mt-1 truncate">{s.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 자격증 관리 탭 ── */}
      {activeTab === 'license' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowLicenseModal(true)}>+ 자격증 추가</Button>
          </div>
          {(licenses as any[]).length === 0 ? (
            <div className="py-10 text-center text-text-muted text-sm">등록된 자격증이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {(licenses as any[]).map((l: any) => {
                const daysLeft = l.expiresAt
                  ? Math.ceil((new Date(l.expiresAt).getTime() - Date.now()) / 86400000)
                  : null;
                const expired  = daysLeft != null && daysLeft < 0;
                const expiring = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;
                return (
                  <div key={l.id} className={clsx(
                    'bg-white rounded-xl border p-4 flex items-center gap-4',
                    expired ? 'border-red-300 bg-red-50' : expiring ? 'border-amber-300 bg-amber-50' : 'border-border',
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{LICENSE_TYPE_KO[l.type] ?? l.type}</span>
                        {l.licenseNumber && <span className="text-xs text-text-muted font-mono">{l.licenseNumber}</span>}
                        {expired  && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">만료됨</span>}
                        {expiring && !expired && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">D-{daysLeft}</span>}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5 flex gap-3">
                        {l.issuedAt && <span>발급일 {l.issuedAt}</span>}
                        {l.expiresAt ? <span>만료일 {l.expiresAt}</span> : <span>무기한</span>}
                        {l.issuer && <span>{l.issuer}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteLicenseMut.mutate(l.id)}
                      className="text-xs text-red-400 hover:text-red-700 px-2 py-1 flex-shrink-0">삭제</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 가산수당 탭 ── */}
      {activeTab === 'pay' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input type="date" value={payRange.start} onChange={e => setPayRange(r => ({ ...r, start: e.target.value }))}
              className="border border-border rounded-lg px-3 py-1.5" />
            <span className="text-text-muted">~</span>
            <input type="date" value={payRange.end} onChange={e => setPayRange(r => ({ ...r, end: e.target.value }))}
              className="border border-border rounded-lg px-3 py-1.5" />
          </div>
          {payReport ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '일반', color: 'gray', data: payReport.regular },
                  { label: '야간', color: 'indigo', data: payReport.night },
                  { label: '휴일', color: 'red', data: payReport.holiday },
                  { label: '야간+휴일', color: 'amber', data: payReport.combined },
                ].map(({ label, color, data }) => (
                  <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
                    <p className={`text-xs font-semibold text-${color}-700 mb-1`}>{label}</p>
                    <p className={`text-lg font-bold tabular-nums text-${color}-900`}>{data.count}건</p>
                    <p className={`text-xs text-${color}-600 mt-0.5`}>
                      {Math.floor(data.totalMin / 60)}h {data.totalMin % 60}m
                      {data.count > 0 && ` · ×${Number(data.payRate).toFixed(1)}`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted bg-gray-50 rounded-lg px-3 py-2">
                ※ 가산수당 배율은 회사 설정 기준 (기본 ×1.5). 실 임금 계산 시 시급과 곱하여 산출합니다. 본 통계는 참고용이며 법적 효력을 갖지 않습니다.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted text-sm">기간을 선택하면 가산수당 내역이 표시됩니다.</div>
          )}
        </div>
      )}

      {/* 세션 시작 모달 */}
      <Modal open={showSessionModal} onClose={() => setShowSessionModal(false)} title="돌봄 세션 시작">
        <div className="space-y-3 p-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">서비스 유형</label>
              <select value={sessionForm.type} onChange={e => setSessionForm(f => ({ ...f, type: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2">
                {Object.entries(SESSION_TYPE_KO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">수급자/환자 성명 *</label>
              <input type="text" value={sessionForm.recipientName}
                onChange={e => setSessionForm(f => ({ ...f, recipientName: e.target.value }))}
                placeholder="홍길동"
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">수급자 ID (선택)</label>
              <input type="text" value={sessionForm.recipientId}
                onChange={e => setSessionForm(f => ({ ...f, recipientId: e.target.value }))}
                placeholder="내부 관리 ID"
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">바우처 코드 (선택)</label>
              <input type="text" value={sessionForm.voucherCode}
                onChange={e => setSessionForm(f => ({ ...f, voucherCode: e.target.value }))}
                placeholder="바우처 코드"
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
          </div>
          <p className="text-xs text-text-muted">시작 시각은 현재 시각으로 자동 기록됩니다. 휴일 및 야간 가산은 종료 시 자동 계산됩니다.</p>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" variant="secondary" onClick={() => setShowSessionModal(false)}>취소</Button>
            <Button className="flex-1" onClick={() => startMut.mutate()}
              loading={startMut.isPending} disabled={!sessionForm.recipientName}>
              시작
            </Button>
          </div>
        </div>
      </Modal>

      {/* 자격증 등록 모달 */}
      <Modal open={showLicenseModal} onClose={() => setShowLicenseModal(false)} title="자격증 등록">
        <div className="space-y-3 p-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">자격증 종류</label>
              <select value={licenseForm.type} onChange={e => setLicenseForm(f => ({ ...f, type: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2">
                {Object.entries(LICENSE_TYPE_KO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">면허/자격증 번호</label>
              <input type="text" value={licenseForm.licenseNumber}
                onChange={e => setLicenseForm(f => ({ ...f, licenseNumber: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">발급일</label>
              <input type="date" value={licenseForm.issuedAt}
                onChange={e => setLicenseForm(f => ({ ...f, issuedAt: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">만료일 (무기한이면 비워두세요)</label>
              <input type="date" value={licenseForm.expiresAt}
                onChange={e => setLicenseForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">발급 기관</label>
            <input type="text" value={licenseForm.issuer}
              onChange={e => setLicenseForm(f => ({ ...f, issuer: e.target.value }))}
              placeholder="예: 보건복지부, 국가자격검정원"
              className="w-full text-sm border border-border rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" variant="secondary" onClick={() => setShowLicenseModal(false)}>취소</Button>
            <Button className="flex-1" onClick={() => addLicenseMut.mutate()} loading={addLicenseMut.isPending}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── 현황판 패널 (사업주·관리자) ──────────────────────────────
const LOCATION_LABEL: Record<string, string> = {
  office: '사무실', remote: '재택', field: '외근',
};
const LOCATION_COLOR: Record<string, string> = {
  office: 'bg-blue-50 text-blue-700',
  remote: 'bg-purple-50 text-purple-700',
  field:  'bg-orange-50 text-orange-700',
};

function OwnerBoardPanel({
  boardData, trendData, locations, onRefresh,
}: {
  boardData: {
    date: string; totalEmployees: number; present: number; late: number;
    absent: number; vacation: number; pending: number;
    currentlyWorking: { userId: string; name: string; department: string | null; position: string | null; clockInAt: string; workLocation: string }[];
  } | undefined;
  trendData: { date: string; present: number; late: number; absent: number }[];
  locations: { id: string; name: string }[];
  onRefresh: () => void;
}) {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [lookupDate, setLookupDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [lookupTime, setLookupTime] = useState(() => format(new Date(), 'HH:mm'));

  // 선택된 지점의 직원 목록 (ID 집합)
  const { data: locationEmpData } = useQuery({
    queryKey: ['location-employees-board', selectedLocation],
    queryFn: async () => {
      const { data } = await api.get(`/locations/${selectedLocation}/employees`);
      return new Set<string>((data.data ?? []).map((e: any) => e.id as string));
    },
    enabled: !!selectedLocation,
    staleTime: 2 * 60 * 1000,
  });

  const currentlyWorking = boardData?.currentlyWorking ?? [];
  const filteredWorking = selectedLocation && locationEmpData
    ? currentlyWorking.filter((w) => locationEmpData.has(w.userId))
    : currentlyWorking;
  const [lookupResult, setLookupResult] = useState<{ userId: string; name: string; department: string | null; position: string | null; clockInAt: string; clockOutAt: string | null; workLocation: string; status: string }[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleLookup = async () => {
    if (!lookupDate || !lookupTime) return;
    setLookupLoading(true);
    try {
      const { data } = await api.get('/attendance/who-was-there', {
        params: { date: lookupDate, time: lookupTime },
      });
      setLookupResult(data.data);
    } catch {
      toast.error('조회 실패');
    } finally {
      setLookupLoading(false);
    }
  };

  // 추이 차트: present 기준 최대값
  const maxPresent = Math.max(...trendData.map(d => d.present), 1);

  const statCards = boardData ? [
    { label: '전체 직원', value: boardData.totalEmployees, color: 'text-text-primary', bg: 'bg-surface-1' },
    { label: '출근', value: boardData.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '지각', value: boardData.late, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '결근', value: boardData.absent, color: 'text-red-600', bg: 'bg-red-50' },
    { label: '휴가', value: boardData.vacation, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '미처리', value: boardData.pending, color: 'text-gray-500', bg: 'bg-gray-50' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-secondary">{boardData?.date ?? ''} 기준 · 5분마다 자동 갱신</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-surface-1 transition-colors"
        >
          <RefreshCw size={13}/> 새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {statCards.map((c) => (
          <div key={c.label} className={clsx('rounded-xl p-3 text-center', c.bg)}>
            <div className={clsx('text-2xl font-bold tabular-nums', c.color)}>{c.value}</div>
            <div className="text-xs text-text-secondary mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 지점 필터 (다지점 운영 시) */}
      {locations.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary flex-shrink-0">지점 필터</span>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="">전체 지점</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 현재 근무 중 */}
      <Card>
        <CardHeader
          title={`현재 근무 중 ${filteredWorking.length}명`}
          description={selectedLocation ? '선택된 지점 기준' : '출근 후 아직 퇴근하지 않은 직원'}
        />
        {filteredWorking.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">현재 근무 중인 직원이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredWorking.map((w) => {
              const clockIn = new Date(w.clockInAt);
              const elapsed = Math.floor((Date.now() - clockIn.getTime()) / 60000);
              const h = Math.floor(elapsed / 60);
              const m = elapsed % 60;
              return (
                <div key={w.userId} className="flex items-center gap-3 py-2.5 px-1">
                  <Avatar name={w.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{w.name}</div>
                    <div className="text-xs text-text-secondary truncate">
                      {w.department ?? ''}{w.position ? ` · ${w.position}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-text-primary">
                      {format(clockIn, 'HH:mm')} 출근
                    </div>
                    <div className="text-[10px] text-text-secondary">{h}시간 {m}분 경과</div>
                  </div>
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    LOCATION_COLOR[w.workLocation] ?? 'bg-gray-50 text-gray-600',
                  )}>
                    {LOCATION_LABEL[w.workLocation] ?? w.workLocation}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 30일 추이 차트 */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader title="최근 30일 출근 추이" description="날짜별 출근·지각·결근 현황"/>
          <div className="flex items-end gap-[2px] h-20 mt-3">
            {trendData.map((d) => {
              const pct = maxPresent > 0 ? (d.present / maxPresent) * 100 : 0;
              const latePct = d.present > 0 ? (d.late / d.present) * 100 : 0;
              const dow = new Date(d.date).getDay();
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {/* 툴팁 */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                      <div>{d.date.slice(5)} 출근 {d.present}명</div>
                      {d.late > 0 && <div className="text-amber-300">지각 {d.late}명</div>}
                      {d.absent > 0 && <div className="text-red-300">결근 {d.absent}명</div>}
                    </div>
                  </div>
                  {/* 바 */}
                  <div
                    className={clsx(
                      'w-full rounded-t-sm transition-all',
                      d.absent > 0 ? 'bg-red-300' : latePct > 20 ? 'bg-amber-300' : 'bg-emerald-400',
                      (dow === 0 || dow === 6) && 'opacity-40',
                    )}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"/>정상</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-300 inline-block"/>지각 20%↑</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block"/>결근 있음</span>
          </div>
        </Card>
      )}

      {/* 시간대 조회 */}
      <Card>
        <CardHeader title="시간대 조회" description="특정 날짜·시각에 누가 근무 중이었는지 확인합니다"/>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div>
            <label className="label">날짜</label>
            <input
              type="date"
              value={lookupDate}
              onChange={(e) => { setLookupDate(e.target.value); setLookupResult(null); }}
              className="input"
            />
          </div>
          <div>
            <label className="label">시각 (KST)</label>
            <input
              type="time"
              value={lookupTime}
              onChange={(e) => { setLookupTime(e.target.value); setLookupResult(null); }}
              className="input"
            />
          </div>
          <Button onClick={handleLookup} disabled={lookupLoading} size="sm">
            {lookupLoading ? '조회 중...' : '조회'}
          </Button>
        </div>

        {lookupResult !== null && (
          <div className="mt-4">
            {lookupResult.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">
                {lookupDate} {lookupTime}에 근무 중인 직원이 없습니다.
              </p>
            ) : (
              <div>
                <p className="text-xs text-text-secondary mb-2">
                  {lookupDate} {lookupTime} 기준 <strong>{lookupResult.length}명</strong> 근무 중
                </p>
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {lookupResult.map((r) => (
                    <div key={r.userId} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                      <Avatar name={r.name} size="sm"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-text-secondary">
                          {r.department ?? ''}{r.position ? ` · ${r.position}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-text-secondary text-right shrink-0">
                        <div>{format(new Date(r.clockInAt), 'HH:mm')} 출근</div>
                        {r.clockOutAt && (
                          <div>{format(new Date(r.clockOutAt), 'HH:mm')} 퇴근</div>
                        )}
                      </div>
                      <span className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                        LOCATION_COLOR[r.workLocation] ?? 'bg-gray-50 text-gray-600',
                      )}>
                        {LOCATION_LABEL[r.workLocation] ?? r.workLocation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
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

  type TabKey = 'me' | 'today' | 'stats' | 'grid' | 'audit' | 'wage' | 'field' | 'care' | 'board';
  const [tab, setTab] = useState<TabKey>('me');
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);

  const TABS: { key: TabKey; label: string; managerOnly?: boolean }[] = [
    { key: 'me',    label: '내 근태' },
    { key: 'wage',  label: '임금 내역' },
    { key: 'field', label: '현장 외근' },
    { key: 'care',  label: '돌봄 기록' },
    { key: 'board', label: '현황판',    managerOnly: true },
    { key: 'today', label: '오늘 현황', managerOnly: true },
    { key: 'stats', label: '팀 통계',   managerOnly: true },
    { key: 'grid',  label: '월간 뷰',   managerOnly: true },
    { key: 'audit', label: '감사 로그', managerOnly: true },
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

  const { data: weeklyHours } = useQuery({
    queryKey: ['attendance-weekly-hours'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/weekly-hours');
      return data.data;
    },
    refetchInterval: myToday?.clockInAt && !myToday?.clockOutAt ? 60_000 : false, // 근무중이면 1분마다 갱신
  });

  const { data: allAttendance } = useQuery({
    queryKey: ['attendance-all', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: isManager && tab === 'today',
  });

  // ── 현황판 ─────────────────────────────────────────────────────────────
  const { data: boardData, refetch: refetchBoard } = useQuery({
    queryKey: ['attendance-board', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance/board');
      return data.data as {
        date: string; totalEmployees: number;
        present: number; late: number; absent: number; vacation: number; pending: number;
        currentlyWorking: { userId: string; name: string; department: string | null; position: string | null; clockInAt: string; workLocation: string }[];
      };
    },
    enabled: isManager && tab === 'board',
    refetchInterval: tab === 'board' ? 5 * 60 * 1000 : false, // 5분마다 갱신
  });

  const { data: trendData } = useQuery({
    queryKey: ['attendance-trend-30'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/trend', { params: { days: 30 } });
      return data.data as { date: string; present: number; late: number; absent: number }[];
    },
    enabled: isManager && tab === 'board',
    staleTime: 10 * 60 * 1000, // 10분 캐시
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations-board'],
    queryFn: async () => {
      const { data } = await api.get('/locations');
      return (data.data?.locations ?? []) as { id: string; name: string }[];
    },
    enabled: isManager && tab === 'board',
    staleTime: 5 * 60 * 1000,
  });

  const { data: attendanceMethods } = useQuery({
    queryKey: ['attendance-methods'],
    queryFn: async () => { const { data } = await api.get('/attendance/methods'); return data.data; },
    enabled: isManager,
  });
  const qrEnabled = attendanceMethods?.enabled?.includes('qr');

  const [showQr, setShowQr] = useState(false);
  const { data: qrData, refetch: refetchQr, isFetching: qrFetching } = useQuery({
    queryKey: ['qr-token'],
    queryFn: async () => { const { data } = await api.get('/attendance/qr-token'); return data.data; },
    enabled: false,
    staleTime: 0,
  });

  const handleShowQr = async () => {
    setShowQr(true);
    await refetchQr();
    // 자동 갱신: windowMinutes마다 재호출
    if (qrData?.windowMinutes) {
      const ms = qrData.windowMinutes * 60_000;
      const timeout = setTimeout(() => refetchQr(), ms);
      return () => clearTimeout(timeout);
    }
  };

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


  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-4 md:p-8 space-y-5 max-w-[1200px]">
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

        {/* ── 현황판 탭 (사업주·관리자 전용) ── */}
        {tab === 'board' && isManager && (
          <OwnerBoardPanel
            boardData={boardData}
            trendData={trendData ?? []}
            locations={locationsData ?? []}
            onRefresh={refetchBoard}
          />
        )}

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

                {/* 이미 출근 → 근무중 상태 표시 */}
                {myToday?.clockInAt && !myToday?.clockOutAt ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-6 py-3 text-base font-semibold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      근무중입니다
                    </div>
                    <Button onClick={handleClockOut} loading={clockOutMutation.isPending} variant="secondary" size="lg" className="px-10">
                      <LogOut className="h-5 w-5" /> 퇴근
                    </Button>
                  </div>
                ) : myToday?.clockOutAt ? (
                  /* 퇴근 완료 */
                  <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 rounded-2xl px-6 py-3 text-base font-semibold">
                    <LogOut className="h-5 w-5" /> 오늘 근무 종료
                  </div>
                ) : (
                  /* 아직 출근 전 */
                  <div className="flex justify-center gap-3">
                    <Button onClick={handleClockIn} loading={clockInMutation.isPending} size="lg" className="px-10">
                      <LogIn className="h-5 w-5" /> 출근
                    </Button>
                    <Button disabled variant="secondary" size="lg" className="px-10 opacity-40">
                      <LogOut className="h-5 w-5" /> 퇴근
                    </Button>
                  </div>
                )}
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setShowOvertimeModal(true)}
                    className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors border border-orange-200"
                  >
                    <Zap size={14}/> 초과근무 신청
                  </button>
                </div>

                {myToday && (
                  <div className="mt-6 inline-flex flex-wrap justify-center gap-3 md:gap-6 bg-gray-50 rounded-2xl px-4 md:px-6 py-3 text-sm text-text-secondary">
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

                {/* 야근 면책 배지 */}
                {(myToday as any)?.lateExempted && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium">
                    <Wifi className="h-3.5 w-3.5" /> 야근 면책 적용 — 지각 처리 제외됨
                  </div>
                )}

                {/* 재택 배지 */}
                {(myToday as any)?.workLocation === 'remote' && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-sky-50 border border-sky-200 text-sky-700 px-3 py-1.5 rounded-full font-medium">
                    <Home className="h-3.5 w-3.5" /> 재택근무
                  </div>
                )}

                {/* 야간 근무 배지 (현장직 특화) */}
                {(myToday as any)?.nightWorkMinutes > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full font-medium">
                    <Moon className="h-3.5 w-3.5" />
                    야간 근무 {Math.floor((myToday as any).nightWorkMinutes / 60)}h {(myToday as any).nightWorkMinutes % 60}m
                  </div>
                )}

                {/* 장시간 근무 경고 배지 (현장직 특화) */}
                {(myToday as any)?.isLongWork && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-full font-medium">
                    <TriangleAlert className="h-3.5 w-3.5" /> 장시간 근무 — 연속 근무 기준 초과
                  </div>
                )}

                {/* 파트타임 임금 배지 */}
                {(myToday as any)?.wageAmount != null && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                    오늘 임금 {Number((myToday as any).wageAmount).toLocaleString()}원
                    {(myToday as any).roundedWorkMinutes != null && (
                      <span className="text-emerald-500 ml-1">
                        ({Math.floor((myToday as any).roundedWorkMinutes / 60)}h {(myToday as any).roundedWorkMinutes % 60}m 기준)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* 52h 위젯 */}
            <WeeklyHoursWidget data={weeklyHours} />
          </div>
        )}

        {/* ── 오늘 현황 탭 ── */}
        {tab === 'today' && isManager && (
          <>
          {/* QR 코드 패널 (QR 방식 활성화 시만 표시) */}
          {qrEnabled && (
            <Card>
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <QrCode className="h-5 w-5 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">QR 출퇴근 코드</p>
                    <p className="text-xs text-text-muted">직원이 이 QR을 스캔해 출퇴근합니다</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleShowQr}
                  loading={qrFetching}
                >
                  {showQr ? '새로고침' : 'QR 표시'}
                </Button>
              </div>
              {showQr && qrData && (
                <div className="border-t border-border flex flex-col items-center py-6 gap-3">
                  <QRCodeSVG value={qrData.token} size={200} includeMargin />
                  <div className="text-center">
                    <p className="text-xs text-text-muted font-mono">{qrData.token}</p>
                    <p className="text-xs text-text-muted mt-1">
                      만료: {qrData.expiresAt ? format(new Date(qrData.expiresAt), 'HH:mm:ss') : '-'}
                      {' · '}매 {qrData.windowMinutes}분 자동 갱신
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => refetchQr()}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />코드 갱신
                  </Button>
                </div>
              )}
            </Card>
          )}
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
          </>
        )}

        {/* ── 팀 통계 탭 ── */}
        {tab === 'stats' && isManager && (
          <TeamStatsTab onSelectEmployee={setSelectedEmployee} />
        )}

        {/* ── 월간 뷰 탭 ── */}
        {tab === 'grid' && isManager && (
          <MonthlyGridTab />
        )}

        {/* ── 감사 로그 탭 ── */}
        {tab === 'audit' && isManager && (
          <AuditLogTab />
        )}

        {/* ── 임금 내역 탭 (파트타임 특화) ── */}
        {tab === 'wage' && (
          <WageReportTab userId={user?.id ?? ''} />
        )}

        {/* ── 현장 외근 탭 ── */}
        {tab === 'field' && (
          <FieldVisitPanel userId={user?.id ?? ''} isManager={isManager} />
        )}

        {/* ── 돌봄 기록 탭 (의료·돌봄직) ── */}
        {tab === 'care' && (
          <CareWorkerPanel userId={user?.id ?? ''} />
        )}
      </main>

      {selectedEmployee && (
        <EmployeeAttendanceModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
      <OvertimeRequestModal open={showOvertimeModal} onClose={() => setShowOvertimeModal(false)} />
    </div>
  );
}
