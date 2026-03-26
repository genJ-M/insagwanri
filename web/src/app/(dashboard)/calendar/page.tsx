'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, X, Building2, Users, User as UserIcon,
  Pencil, Trash2, CalendarDays, Table2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── 타입 ────────────────────────────────────────────
type EventScope = 'company' | 'team' | 'personal';

interface CalendarEvent {
  id: string;
  scope: EventScope;
  targetDepartment: string | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string | null;
  isMine: boolean;
  creator: { id: string; name: string } | null;
}

interface AttendanceCell {
  status: string;
  isLate: boolean;
  clockIn: string | null;
  clockOut: string | null;
  totalMin: number | null;
}

// ─── 상수 ────────────────────────────────────────────
const SCOPE_CONFIG: Record<EventScope, { label: string; color: string; bg: string; Icon: any }> = {
  company:  { label: '전사',   color: 'text-blue-700',    bg: 'bg-blue-500',    Icon: Building2 },
  team:     { label: '팀',     color: 'text-teal-700',    bg: 'bg-teal-500',    Icon: Users },
  personal: { label: '개인',   color: 'text-violet-700',  bg: 'bg-violet-500',  Icon: UserIcon },
};

const ATT_STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  normal:      { bg: 'bg-emerald-400', label: '정상' },
  late:        { bg: 'bg-amber-400',   label: '지각' },
  early_leave: { bg: 'bg-orange-400',  label: '조퇴' },
  absent:      { bg: 'bg-red-400',     label: '결근' },
  half_day:    { bg: 'bg-sky-400',     label: '반차' },
  vacation:    { bg: 'bg-blue-400',    label: '휴가' },
  pending:     { bg: 'bg-gray-300',    label: '대기' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 이벤트 생성/수정 모달 ───────────────────────────
function EventModal({
  departments, isAdmin, editEvent, defaultDate, onClose, onSuccess,
}: {
  departments: string[];
  isAdmin: boolean;
  editEvent?: CalendarEvent;
  defaultDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [scope, setScope] = useState<EventScope>(
    editEvent?.scope ?? (isAdmin ? 'company' : 'personal'),
  );
  const [dept, setDept] = useState(editEvent?.targetDepartment ?? '');
  const [title, setTitle] = useState(editEvent?.title ?? '');
  const [desc, setDesc] = useState(editEvent?.description ?? '');
  const [startDate, setStartDate] = useState(editEvent?.startDate ?? defaultDate ?? '');
  const [endDate, setEndDate] = useState(editEvent?.endDate ?? defaultDate ?? '');
  const [color, setColor] = useState(editEvent?.color ?? '');
  const [loading, setLoading] = useState(false);

  const availableScopes: EventScope[] = isAdmin
    ? ['company', 'team', 'personal']
    : ['personal'];

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!startDate || !endDate) { toast.error('날짜를 선택하세요.'); return; }
    if (startDate > endDate) { toast.error('종료일은 시작일 이후여야 합니다.'); return; }
    setLoading(true);
    try {
      const body = {
        scope, title, description: desc || undefined,
        start_date: startDate, end_date: endDate,
        target_department: scope === 'team' ? (dept || undefined) : undefined,
        color: color || undefined,
      };
      if (editEvent) {
        await api.patch(`/calendar/events/${editEvent.id}`, body);
      } else {
        await api.post('/calendar/events', body);
      }
      toast.success(editEvent ? '수정되었습니다.' : '일정이 등록되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const COLOR_PRESETS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">{editEvent ? '일정 수정' : '일정 등록'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-4 space-y-3.5">
          {/* 공개 범위 */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">공개 범위</label>
            <div className="flex gap-1.5">
              {availableScopes.map(s => {
                const cfg = SCOPE_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all',
                      scope === s
                        ? `${cfg.bg} text-white border-transparent`
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    <cfg.Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 팀 선택 */}
          {scope === 'team' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">대상 부서 (전체 팀 = 공란)</label>
              <select
                value={dept} onChange={e => setDept(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
              >
                <option value="">전체 팀</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">제목</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
            />
          </div>

          {/* 기간 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">시작일</label>
              <input type="date" value={startDate}
                onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">종료일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">내용 (선택)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400 resize-none" />
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">색상</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(color === c ? '' : c)}
                  className={clsx('w-6 h-6 rounded-full transition-all', color === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : '')}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-[11px] text-gray-400">직접입력:</span>
                <input
                  type="text" value={color} onChange={e => setColor(e.target.value)}
                  placeholder="#hex"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 disabled:opacity-50">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [currentDate, setCurrentDate] = useState(new Date());
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const [view, setView] = useState<'events' | 'attendance'>('events');
  const [deptFilter, setDeptFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | undefined>();
  const [clickedDate, setClickedDate] = useState<string | undefined>();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['calendar'] });

  // 부서 목록
  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ['calendar-departments'],
    queryFn: () => api.get('/calendar/departments').then(r => r.data.data),
    enabled: isAdmin,
  });

  // 이벤트
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', year, month, deptFilter],
    queryFn: () =>
      api.get(`/calendar/events?year=${year}&month=${month}${deptFilter ? `&department=${deptFilter}` : ''}`).then(r => r.data.data),
  });

  // 근태 캘린더 (관리자)
  const { data: attData } = useQuery({
    queryKey: ['calendar', 'attendance', year, month, deptFilter],
    queryFn: () =>
      api.get(`/calendar/attendance?year=${year}&month=${month}${deptFilter ? `&department=${deptFilter}` : ''}`).then(r => r.data.data),
    enabled: isAdmin && view === 'attendance',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제 실패'),
  });

  // ─── 달력 계산 ──────────────────────────────────────
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = getDay(startOfMonth(currentDate)); // 0=일
  const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;

  // 날짜별 이벤트 맵
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const s = new Date(ev.startDate);
      const e = new Date(ev.endDate);
      const cur = new Date(s);
      while (cur <= e) {
        const key = cur.toISOString().split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const prevMonth = () => setCurrentDate(d => subMonths(d, 1));
  const nextMonth = () => setCurrentDate(d => addMonths(d, 1));
  const goToday  = () => setCurrentDate(new Date());

  const handleDayClick = (dateStr: string) => {
    setClickedDate(dateStr);
    setEditEvent(undefined);
    setShowModal(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[18px] font-bold text-gray-900 w-28 text-center">
                {format(currentDate, 'yyyy년 M월', { locale: ko })}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button onClick={goToday} className="px-2.5 py-1 text-[12px] font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
              오늘
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 부서 필터 (관리자) */}
            {isAdmin && departments.length > 0 && (
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
                <option value="">전체 팀</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {/* 뷰 전환 (관리자) */}
            {isAdmin && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {[
                  { id: 'events', label: '일정', Icon: CalendarDays },
                  { id: 'attendance', label: '근태', Icon: Table2 },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id as 'events' | 'attendance')}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                      view === v.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500',
                    )}
                  >
                    <v.Icon className="w-3.5 h-3.5" />
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => { setEditEvent(undefined); setClickedDate(undefined); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" />
              일정 추가
            </button>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {Object.entries(SCOPE_CONFIG).map(([k, cfg]) => (
            <div key={k} className="flex items-center gap-1">
              <div className={clsx('w-2.5 h-2.5 rounded-full', cfg.bg)} />
              <span className="text-[11px] text-gray-500">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">

        {/* ── 이벤트 캘린더 뷰 ── */}
        {view === 'events' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={clsx(
                  'py-2.5 text-center text-[12px] font-semibold',
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500',
                )}>
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDayOfWeek + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth
                  ? `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                  : '';
                const dayEvents = dateStr ? (eventsByDate.get(dateStr) ?? []) : [];
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const dow = idx % 7;

                return (
                  <div
                    key={idx}
                    className={clsx(
                      'min-h-[100px] border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-gray-50/80 transition-colors',
                      !isCurrentMonth && 'bg-gray-50/50',
                      isToday && 'bg-primary-50/30',
                    )}
                    onClick={() => isCurrentMonth && handleDayClick(dateStr)}
                  >
                    {isCurrentMonth && (
                      <>
                        <div className={clsx(
                          'w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold mb-1',
                          isToday ? 'bg-primary-500 text-white' :
                          dow === 0 ? 'text-red-500' :
                          dow === 6 ? 'text-blue-500' : 'text-gray-700',
                        )}>
                          {dayNum}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map(ev => {
                            const scopeColor = ev.color
                              ? ev.color
                              : ev.scope === 'company' ? '#3b82f6'
                              : ev.scope === 'team'    ? '#14b8a6'
                              : '#8b5cf6';
                            return (
                              <div
                                key={ev.id}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate cursor-pointer hover:opacity-90"
                                style={{ backgroundColor: scopeColor }}
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditEvent(ev);
                                  setShowModal(true);
                                }}
                                title={ev.title}
                              >
                                <span className="truncate">{ev.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3}개 더</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 근태 캘린더 뷰 (관리자) ── */}
        {view === 'attendance' && isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {!attData ? (
              <div className="py-16 text-center text-[13px] text-gray-400">근태 데이터를 불러오는 중...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-[11px] border-collapse w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[120px] border-r border-gray-100">
                        직원
                      </th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                        const date = new Date(year, month - 1, d);
                        const dow = date.getDay();
                        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        const eventsOnDay = eventsByDate.get(dateStr) ?? [];
                        return (
                          <th key={d} className={clsx(
                            'py-1 text-center font-semibold relative border-l border-gray-50 min-w-[36px]',
                            isToday && 'bg-primary-50',
                            dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-500',
                          )}>
                            <div>{d}</div>
                            <div className="text-[9px] font-normal">{WEEKDAYS[dow]}</div>
                            {/* 이벤트 도트 */}
                            {eventsOnDay.length > 0 && (
                              <div className="flex justify-center gap-0.5 mt-0.5">
                                {eventsOnDay.slice(0, 2).map(ev => {
                                  const c = ev.color ?? (ev.scope === 'company' ? '#3b82f6' : ev.scope === 'team' ? '#14b8a6' : '#8b5cf6');
                                  return <div key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} title={ev.title} />;
                                })}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(attData.users as any[]).map((emp: any) => {
                      const empRecords: Record<string, AttendanceCell> = attData.records[emp.id] ?? {};
                      return (
                        <tr key={emp.id} className="hover:bg-gray-50/80">
                          <td className="px-3 py-1.5 sticky left-0 bg-white z-10 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-600 flex-shrink-0">
                                {emp.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-[12px]">{emp.name}</p>
                                <p className="text-[10px] text-gray-400">{emp.department ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const d = i + 1;
                            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const rec = empRecords[dateStr];
                            const date = new Date(year, month - 1, d);
                            const dow = date.getDay();
                            const isWeekend = dow === 0 || dow === 6;
                            const isToday = dateStr === new Date().toISOString().split('T')[0];

                            const statusStyle = rec ? (ATT_STATUS_STYLE[rec.status] ?? ATT_STATUS_STYLE.pending) : null;

                            return (
                              <td key={d} className={clsx(
                                'text-center py-1.5 border-l border-gray-50',
                                isWeekend && 'bg-gray-50/40',
                                isToday && 'bg-primary-50/30',
                              )}>
                                {rec ? (
                                  <div className="flex flex-col items-center gap-0.5" title={`${rec.clockIn ?? ''} ~ ${rec.clockOut ?? ''}`}>
                                    <div className={clsx('w-3 h-3 rounded-full mx-auto', statusStyle?.bg)} />
                                    {rec.isLate && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="지각" />
                                    )}
                                  </div>
                                ) : isWeekend ? (
                                  <span className="text-[9px] text-gray-200">—</span>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {(attData.users as any[]).length === 0 && (
                      <tr>
                        <td colSpan={daysInMonth + 1} className="py-10 text-center text-[13px] text-gray-400">
                          직원이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* 근태 범례 */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 flex-wrap">
                  {Object.entries(ATT_STATUS_STYLE).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <div className={clsx('w-3 h-3 rounded-full', v.bg)} />
                      <span className="text-[11px] text-gray-500">{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 이벤트 목록 사이드 패널 (이번 달 전체) */}
        {view === 'events' && events.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-[13px] font-bold text-gray-700 mb-3">
              {format(currentDate, 'M월', { locale: ko })} 전체 일정 ({events.length}건)
            </h3>
            <div className="space-y-1.5">
              {events.map(ev => {
                const scopeColor = ev.color
                  ? ev.color
                  : ev.scope === 'company' ? '#3b82f6'
                  : ev.scope === 'team'    ? '#14b8a6'
                  : '#8b5cf6';
                const cfg = SCOPE_CONFIG[ev.scope];
                const canEdit = ev.isMine || isAdmin;
                return (
                  <div key={ev.id} className="flex items-center gap-3 group px-2 py-2 rounded-xl hover:bg-gray-50">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: scopeColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', cfg.bg, 'text-white')}>
                          {cfg.label}
                        </span>
                        {ev.targetDepartment && (
                          <span className="text-[10px] text-gray-400">({ev.targetDepartment})</span>
                        )}
                        <span className="text-[12px] font-semibold text-gray-800 truncate">{ev.title}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} ~ ${ev.endDate}`}
                        {ev.description && ` · ${ev.description}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditEvent(ev); setShowModal(true); }}
                          className="p-1 rounded text-gray-400 hover:text-gray-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(ev.id); }}
                          className="p-1 rounded text-gray-300 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <EventModal
          departments={departments}
          isAdmin={isAdmin}
          editEvent={editEvent}
          defaultDate={clickedDate}
          onClose={() => { setShowModal(false); setEditEvent(undefined); setClickedDate(undefined); }}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
