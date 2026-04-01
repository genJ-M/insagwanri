'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO,
  startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, LayoutList, CalendarDays } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { Schedule } from '@/types';

const SCHEDULE_COLORS: Record<string, string> = {
  general: '#6B7280', meeting: '#3B82F6', vacation: '#10B981',
  business_trip: '#F59E0B', training: '#8B5CF6', holiday: '#EF4444',
};

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280',
];

const SCHEDULE_TYPE_KO: Record<string, string> = {
  general: '일반', meeting: '회의', vacation: '휴가',
  business_trip: '출장', training: '교육', holiday: '공휴일',
};

// ─── 공통 폼 컴포넌트 ─────────────────────────────────────────────────────────
type ScheduleForm = {
  title: string; type: string; start_at: string; end_at: string;
  location: string; is_all_day: boolean; color: string; description: string;
};

const EMPTY_FORM: ScheduleForm = {
  title: '', type: 'general', start_at: '', end_at: '',
  location: '', is_all_day: false, color: '#3B82F6', description: '',
};

function validateForm(form: ScheduleForm): string {
  if (!form.title.trim()) return '제목을 입력해주세요.';
  if (!form.start_at) return '시작 일시를 입력해주세요.';
  if (!form.end_at) return '종료 일시를 입력해주세요.';
  if (new Date(form.end_at) <= new Date(form.start_at)) return '종료 일시는 시작 일시보다 이후여야 합니다.';
  return '';
}

function ScheduleFormFields({ form, setForm }: { form: ScheduleForm; setForm: (f: ScheduleForm) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label">제목 *</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="input"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_all_day}
          onChange={(e) => setForm({ ...form, is_all_day: e.target.checked, start_at: '', end_at: '' })}
          className="rounded border-border text-primary-500 focus:ring-primary-100"
        />
        <span className="text-sm text-text-primary">종일 일정</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">시작 *</label>
          <input
            type={form.is_all_day ? 'date' : 'datetime-local'}
            value={form.start_at}
            onChange={(e) => setForm({ ...form, start_at: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">종료 *</label>
          <input
            type={form.is_all_day ? 'date' : 'datetime-local'}
            value={form.end_at}
            min={form.start_at}
            onChange={(e) => setForm({ ...form, end_at: e.target.value })}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">유형</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="input"
          >
            {Object.entries(SCHEDULE_TYPE_KO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">장소</label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="선택 사항"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">색상</label>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: form.color === c ? '#1D4ED8' : 'transparent',
                transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 일정 생성 모달 ───────────────────────────────────────────────────────────
function CreateScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/schedules', payload),
    onSuccess: () => {
      toast.success('일정이 추가되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
      setForm(EMPTY_FORM);
      setError('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '일정 추가에 실패했습니다.');
    },
  });

  const handleSave = () => {
    const err = validateForm(form);
    if (err) { setError(err); return; }
    setError('');
    const toISO = (v: string) => new Date(v).toISOString();
    mutation.mutate({ ...form, start_at: toISO(form.start_at), end_at: toISO(form.end_at) });
  };

  return (
    <Modal open={open} onClose={onClose} title="일정 추가">
      <ScheduleFormFields form={form} setForm={setForm} />
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button loading={mutation.isPending} onClick={handleSave}>저장</Button>
      </div>
    </Modal>
  );
}

// ─── 일정 수정 모달 ───────────────────────────────────────────────────────────
function EditScheduleModal({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const queryClient = useQueryClient();

  const toLocal = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [form, setForm] = useState<ScheduleForm>({
    title: schedule.title,
    type: schedule.type,
    start_at: schedule.isAllDay ? schedule.startAt.split('T')[0] : toLocal(schedule.startAt),
    end_at: schedule.isAllDay ? schedule.endAt.split('T')[0] : toLocal(schedule.endAt),
    location: schedule.location ?? '',
    is_all_day: schedule.isAllDay,
    color: schedule.color ?? '#3B82F6',
    description: schedule.description ?? '',
  });
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/schedules/${schedule.id}`, payload),
    onSuccess: () => {
      toast.success('일정이 수정되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '일정 수정에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/schedules/${schedule.id}`),
    onSuccess: () => {
      toast.success('일정이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '일정 삭제에 실패했습니다.');
    },
  });

  const handleSave = () => {
    const err = validateForm(form);
    if (err) { setError(err); return; }
    setError('');
    const toISO = (v: string) => new Date(v).toISOString();
    updateMutation.mutate({ ...form, start_at: toISO(form.start_at), end_at: toISO(form.end_at) });
  };

  const handleDelete = () => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    deleteMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title="일정 수정">
      <ScheduleFormFields form={form} setForm={setForm} />
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      <div className="flex items-center justify-between pt-3">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" /> 삭제
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button loading={updateMutation.isPending} onClick={handleSave}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 주간 카드 뷰 ─────────────────────────────────────────────────────────────
function WeeklyView({
  schedules, weekStart, onEdit,
}: { schedules: Schedule[]; weekStart: Date; onEdit: (s: Schedule) => void }) {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const daySchedules = schedules.filter((s) => isSameDay(parseISO(s.startAt), day));
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} className="min-h-[140px]">
            {/* 요일 헤더 */}
            <div className={clsx(
              'text-center py-2 rounded-t-xl mb-1.5',
              isToday ? 'bg-primary-500' : 'bg-background border border-border',
            )}>
              <p className={clsx('text-[11px] font-medium', isToday ? 'text-white' : 'text-text-muted')}>
                {format(day, 'EEE', { locale: ko })}
              </p>
              <p className={clsx('text-base font-bold tabular-nums', isToday ? 'text-white' : 'text-text-primary')}>
                {format(day, 'd')}
              </p>
            </div>
            {/* 일정 카드 */}
            <div className="space-y-1">
              {daySchedules.length === 0 ? (
                <p className="text-[11px] text-text-muted text-center py-2">—</p>
              ) : daySchedules.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onEdit(s)}
                  className="w-full text-left rounded-lg px-2 py-1.5 text-[11px] font-medium text-white truncate shadow-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: s.color ?? SCHEDULE_COLORS[s.type] ?? '#6B7280' }}
                  title={s.title}
                >
                  {!s.isAllDay && (
                    <span className="opacity-80 mr-1">{format(parseISO(s.startAt), 'HH:mm')}</span>
                  )}
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
type ViewMode = 'list' | 'week';

export default function SchedulePage() {
  usePageTitle('스케줄');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);

  // 뷰 모드에 따라 fetch 범위 결정
  const startDate = viewMode === 'week'
    ? format(currentWeek, 'yyyy-MM-dd')
    : format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = viewMode === 'week'
    ? format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get('/schedules', { params: { start_date: startDate, end_date: endDate } });
      return data.data as Schedule[];
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-4 max-w-[1200px]">
        {/* 상단 컨트롤 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => viewMode === 'week'
                ? setCurrentWeek(subWeeks(currentWeek, 1))
                : setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-background text-text-secondary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-text-primary w-40 text-center">
              {viewMode === 'week'
                ? `${format(currentWeek, 'M/d', { locale: ko })} ~ ${format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'M/d', { locale: ko })}`
                : format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h2>
            <button
              onClick={() => viewMode === 'week'
                ? setCurrentWeek(addWeeks(currentWeek, 1))
                : setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-background text-text-secondary transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setCurrentMonth(new Date());
                setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-500 hover:bg-primary-100 font-medium transition-colors"
            >
              오늘
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 뷰 전환 토글 */}
            <div className="flex gap-0.5 bg-background border border-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'list' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" /> 목록
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'week' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" /> 주간
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> 일정 추가
            </Button>
          </div>
        </div>

        {/* 주간 카드 뷰 */}
        {viewMode === 'week' && (
          <Card>
            <WeeklyView
              schedules={schedules}
              weekStart={currentWeek}
              onEdit={setEditTarget}
            />
          </Card>
        )}

        {/* 월별 목록 뷰 */}
        {viewMode === 'list' && (
          <Card>
            {!schedules.length ? (
              <p className="text-sm text-text-muted text-center py-8">이번 달 일정이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {[...schedules]
                  .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setEditTarget(s)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-background text-left transition-colors"
                      >
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color ?? SCHEDULE_COLORS[s.type] ?? '#6B7280' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{s.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {s.isAllDay
                              ? format(parseISO(s.startAt), 'M월 d일 (EEE)', { locale: ko }) + ' 종일'
                              : `${format(parseISO(s.startAt), 'M/d HH:mm')} ~ ${format(parseISO(s.endAt), 'HH:mm')}`}
                            {s.location && ` · ${s.location}`}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-text-secondary flex-shrink-0">
                          {SCHEDULE_TYPE_KO[s.type]}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        )}
      </main>

      <CreateScheduleModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && (
        <EditScheduleModal schedule={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
