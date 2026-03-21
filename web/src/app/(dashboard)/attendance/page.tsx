'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LogIn, LogOut, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, { ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
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

// ── 직원 근태 상세 모달 ───────────────────────────
interface EmployeeInfo { id: string; name: string; department?: string }

function EmployeeAttendanceModal({
  employee,
  onClose,
}: {
  employee: EmployeeInfo;
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

  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={employee.name}
      subtitle={employee.department}
      size="md"
      scrollable
      bodyClassName="p-0"
    >
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">
          {format(month, 'yyyy년 M월', { locale: ko })}
        </span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={month >= new Date()}
          className="p-1.5 rounded-lg hover:bg-background text-text-secondary disabled:opacity-30 transition-colors"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 요약 */}
      <div className="flex gap-4 px-5 py-3 bg-background border-b border-border text-xs">
        {[
          { key: 'normal',      label: '정상',  color: 'text-emerald-600' },
          { key: 'late',        label: '지각',  color: 'text-amber-600' },
          { key: 'absent',      label: '결근',  color: 'text-red-600' },
          { key: 'early_leave', label: '조퇴',  color: 'text-orange-500' },
          { key: 'vacation',    label: '휴가',  color: 'text-primary-500' },
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

      {/* 기록 목록 */}
      <div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-10">이 달 근태 기록이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border">
                {['날짜', '출근', '퇴근', '근무시간', '상태'].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-background transition-colors">
                  <td className="py-2.5 px-4 text-text-primary tabular-nums">
                    {format(new Date(r.workDate), 'M/d (EEE)', { locale: ko })}
                  </td>
                  <td className="py-2.5 px-4 tabular-nums text-text-secondary">
                    {r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}
                  </td>
                  <td className="py-2.5 px-4 tabular-nums text-text-secondary">
                    {r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-text-secondary">
                    {r.totalWorkMinutes
                      ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m`
                      : '-'}
                  </td>
                  <td className="py-2.5 px-4">
                    <Badge value={r.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[r.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export default function AttendancePage() {
  usePageTitle('출퇴근');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const today = format(now, 'yyyy-MM-dd');
  const [geoError, setGeoError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeInfo | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: myToday } = useQuery({
    queryKey: ['attendance-me-today'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', {
        params: { start_date: today, end_date: today },
      });
      return (data.data?.records?.[0] ?? null) as AttendanceRecord | null;
    },
  });

  const { data: allAttendance } = useQuery({
    queryKey: ['attendance-all', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: user?.role !== 'employee',
  });

  const clockInMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) =>
      api.post('/attendance/clock-in', pos),
    onSuccess: () => {
      toast.success(`출근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '출근 처리에 실패했습니다.');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) =>
      api.post('/attendance/clock-out', pos),
    onSuccess: () => {
      toast.success(`퇴근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '퇴근 처리에 실패했습니다.');
    },
  });

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => {
          setGeoError('위치 정보를 가져올 수 없습니다. 위치 없이 처리합니다.');
          setTimeout(() => setGeoError(''), 3000);
          resolve(null);
        },
        { timeout: 5000 },
      );
    });

  const handleClockIn = async () => {
    setGeoError('');
    const pos = await getLocation();
    clockInMutation.mutate(pos ?? {});
  };

  const handleClockOut = async () => {
    setGeoError('');
    const pos = await getLocation();
    clockOutMutation.mutate(pos ?? {});
  };

  const canClockIn  = !myToday?.clockInAt;
  const canClockOut = !!myToday?.clockInAt && !myToday?.clockOutAt;

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="출퇴근" />

      <main className="p-8 space-y-6 max-w-[1200px]">
        {/* 출퇴근 버튼 영역 */}
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-1">
              {format(now, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            </p>
            <p className="text-4xl font-bold text-text-primary tabular-nums mb-6">
              {format(now, 'HH:mm:ss')}
            </p>

            <div className="flex justify-center gap-4">
              <Button
                onClick={handleClockIn}
                disabled={!canClockIn}
                loading={clockInMutation.isPending}
                size="lg"
                className="gap-2 px-8"
              >
                <LogIn className="h-5 w-5" />
                출근
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={!canClockOut}
                loading={clockOutMutation.isPending}
                variant="secondary"
                size="lg"
                className="gap-2 px-8"
              >
                <LogOut className="h-5 w-5" />
                퇴근
              </Button>
            </div>

            {/* 오늘 내 상태 */}
            {myToday && (
              <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-text-secondary">
                <span>출근: <b className="text-text-primary font-semibold">
                  {myToday.clockInAt ? format(new Date(myToday.clockInAt), 'HH:mm') : '-'}
                </b></span>
                <span>퇴근: <b className="text-text-primary font-semibold">
                  {myToday.clockOutAt ? format(new Date(myToday.clockOutAt), 'HH:mm') : '-'}
                </b></span>
                {myToday.clockOutAt && myToday.totalWorkMinutes != null && (
                  <span>근무: <b className="text-text-primary font-semibold">
                    {Math.floor(myToday.totalWorkMinutes / 60)}h {myToday.totalWorkMinutes % 60}m
                  </b></span>
                )}
                <span>상태: <Badge value={myToday.status} colorMap={ATTENDANCE_STATUS_BADGE} /></span>
              </div>
            )}

            {/* 에러/경고 */}
            {geoError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg mx-auto max-w-sm">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {geoError}
              </div>
            )}
          </div>
        </Card>

        {/* 관리자: 오늘 전체 근태 현황 */}
        {user?.role !== 'employee' && (
          <Card padding="none">
            <div className="px-6 py-4 border-b border-border">
              <CardHeader
                title="오늘 근태 현황"
                description={`${today} 기준 · 이름 클릭 시 월별 상세 이력`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['이름', '부서', '출근', '퇴근', '근무시간', '상태'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAttendance?.records?.map((r: AttendanceRecord) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 hover:bg-background transition-colors cursor-pointer"
                      onClick={() => r.user && setSelectedEmployee({
                        id: r.user.id,
                        name: r.user.name,
                        department: r.user.department,
                      })}
                    >
                      <td className="px-4 py-3.5 text-sm font-medium text-primary-500 hover:underline">{r.user?.name}</td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">{r.user?.department ?? '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-text-primary tabular-nums">
                        {r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-primary tabular-nums">
                        {r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">
                        {r.totalWorkMinutes ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m` : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge value={r.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[r.status]} />
                      </td>
                    </tr>
                  ))}
                  {!allAttendance?.records?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">
                        근태 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {selectedEmployee && (
        <EmployeeAttendanceModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
