'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LogIn, LogOut, MapPin, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge, { ATTENDANCE_STATUS_BADGE } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
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

  // 요약 집계
  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-base font-semibold text-gray-900">{employee.name}</p>
            {employee.department && (
              <p className="text-xs text-gray-400 mt-0.5">{employee.department}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-800">
            {format(month, 'yyyy년 M월', { locale: ko })}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={month >= new Date()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 요약 */}
        <div className="flex gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs">
          {[
            { key: 'normal',     label: '정상',  color: 'text-green-600' },
            { key: 'late',       label: '지각',  color: 'text-yellow-600' },
            { key: 'absent',     label: '결근',  color: 'text-red-600' },
            { key: 'early_leave', label: '조퇴', color: 'text-orange-500' },
            { key: 'vacation',   label: '휴가',  color: 'text-blue-500' },
          ].map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <p className={`text-base font-bold ${color}`}>{summary[key] ?? 0}</p>
              <p className="text-gray-500">{label}</p>
            </div>
          ))}
          <div className="text-center ml-auto">
            <p className="text-base font-bold text-gray-700">{records.length}</p>
            <p className="text-gray-500">기록</p>
          </div>
        </div>

        {/* 기록 목록 */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">이 달 근태 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  {['날짜', '출근', '퇴근', '근무시간', '상태'].map((h) => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-700 tabular-nums">
                      {format(new Date(r.workDate), 'M/d (EEE)', { locale: ko })}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums text-gray-600">
                      {r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums text-gray-600">
                      {r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500">
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
      </div>
    </div>
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

  // 내 오늘 근태
  const { data: myToday, isLoading } = useQuery({
    queryKey: ['attendance-me-today'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/me', {
        params: { start_date: today, end_date: today },
      });
      return (data.data?.records?.[0] ?? null) as AttendanceRecord | null;
    },
  });

  // 전체 근태 (관리자)
  const { data: allAttendance } = useQuery({
    queryKey: ['attendance-all', today],
    queryFn: async () => {
      const { data } = await api.get('/attendance', { params: { date: today } });
      return data;
    },
    enabled: user?.role !== 'employee',
  });

  // 출근 mutation
  const clockInMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) =>
      api.post('/attendance/clock-in', pos),
    onSuccess: () => {
      toast.success(`출근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '출근 처리에 실패했습니다.');
    },
  });

  // 퇴근 mutation
  const clockOutMutation = useMutation({
    mutationFn: (pos: { latitude?: number; longitude?: number }) =>
      api.post('/attendance/clock-out', pos),
    onSuccess: () => {
      toast.success(`퇴근 처리 완료 ${format(new Date(), 'HH:mm')}`);
      queryClient.invalidateQueries({ queryKey: ['attendance-me-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-me'] });
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

      <main className="p-6 space-y-6">
        {/* 출퇴근 버튼 영역 */}
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-1">
              {format(now, 'yyyy년 M월 d일')}
            </p>
            <p className="text-3xl font-bold text-gray-900 mb-6 tabular-nums">
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
              <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
                <span>출근: <b>{myToday.clockInAt ? format(new Date(myToday.clockInAt), 'HH:mm') : '-'}</b></span>
                <span>퇴근: <b>{myToday.clockOutAt ? format(new Date(myToday.clockOutAt), 'HH:mm') : '-'}</b></span>
                {myToday.clockOutAt && myToday.totalWorkMinutes != null && (
                  <span>근무: <b>{Math.floor(myToday.totalWorkMinutes / 60)}h {myToday.totalWorkMinutes % 60}m</b></span>
                )}
                <span>상태: <Badge value={myToday.status} colorMap={ATTENDANCE_STATUS_BADGE} /></span>
              </div>
            )}

            {/* 에러/경고 */}
            {(geoError || clockInMutation.error || clockOutMutation.error) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-lg mx-auto max-w-sm">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {geoError || (clockInMutation.error as any)?.response?.data?.error?.message || '처리 중 오류가 발생했습니다.'}
              </div>
            )}
          </div>
        </Card>

        {/* 관리자: 오늘 전체 근태 현황 */}
        {user?.role !== 'employee' && (
          <Card>
            <CardHeader
              title="오늘 근태 현황"
              description={`${today} 기준 · 이름 클릭 시 월별 상세 이력`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['이름', '부서', '출근', '퇴근', '근무시간', '상태'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAttendance?.records?.map((r: AttendanceRecord) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => r.user && setSelectedEmployee({
                        id: r.user.id,
                        name: r.user.name,
                        department: r.user.department,
                      })}
                    >
                      <td className="py-2.5 px-3 font-medium text-blue-600 hover:underline">{r.user?.name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{r.user?.department ?? '-'}</td>
                      <td className="py-2.5 px-3 tabular-nums">
                        {r.clockInAt ? format(new Date(r.clockInAt), 'HH:mm') : '-'}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums">
                        {r.clockOutAt ? format(new Date(r.clockOutAt), 'HH:mm') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">
                        {r.totalWorkMinutes ? `${Math.floor(r.totalWorkMinutes / 60)}h ${r.totalWorkMinutes % 60}m` : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge value={r.status} colorMap={ATTENDANCE_STATUS_BADGE} label={STATUS_KO[r.status]} />
                      </td>
                    </tr>
                  ))}
                  {!allAttendance?.records?.length && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">근태 데이터가 없습니다.</td></tr>
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
