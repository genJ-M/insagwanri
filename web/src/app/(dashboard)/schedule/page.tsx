'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
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
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 종일 체크박스 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_all_day}
          onChange={(e) => setForm({ ...form, is_all_day: e.target.checked, start_at: '', end_at: '' })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">종일 일정</span>
      </label>

      {/* 시작/종료 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">시작 *</label>
          <input
            type={form.is_all_day ? 'date' : 'datetime-local'}
            value={form.start_at}
            onChange={(e) => setForm({ ...form, start_at: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">종료 *</label>
          <input
            type={form.is_all_day ? 'date' : 'datetime-local'}
            value={form.end_at}
            min={form.start_at}
            onChange={(e) => setForm({ ...form, end_at: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 유형 + 장소 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(SCHEDULE_TYPE_KO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="선택 사항"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">색상</label>
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
    const toISO = (v: string) => form.is_all_day ? new Date(v).toISOString() : new Date(v).toISOString();
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
    start_at: schedule.isAllDay
      ? schedule.startAt.split('T')[0]
      : toLocal(schedule.startAt),
    end_at: schedule.isAllDay
      ? schedule.endAt.split('T')[0]
      : toLocal(schedule.endAt),
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
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
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

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function SchedulePage() {
  usePageTitle('스케줄');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate   = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get('/schedules', { params: { start_date: startDate, end_date: endDate } });
      return data.data as Schedule[];
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="스케줄" />

      <main className="p-6 space-y-4">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())}
              className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
              오늘
            </button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 일정 추가
          </Button>
        </div>

        {/* 일정 목록 */}
        <Card>
          {!schedules.length ? (
            <p className="text-sm text-gray-400 text-center py-8">이번 달 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {[...schedules]
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setEditTarget(s)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color ?? SCHEDULE_COLORS[s.type] ?? '#6B7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.isAllDay
                            ? format(parseISO(s.startAt), 'M월 d일 (EEE)', { locale: ko }) + ' 종일'
                            : `${format(parseISO(s.startAt), 'M/d HH:mm')} ~ ${format(parseISO(s.endAt), 'HH:mm')}`}
                          {s.location && ` · ${s.location}`}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                        {SCHEDULE_TYPE_KO[s.type]}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </main>

      <CreateScheduleModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && (
        <EditScheduleModal schedule={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
