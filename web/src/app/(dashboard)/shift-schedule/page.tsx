'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, addDays, parseISO, startOfWeek, addWeeks, subWeeks, getDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Send, RotateCcw, Clock,
  MapPin, Laptop, Briefcase, Zap, X, Check, CalendarDays, Users,
  Star, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import {
  ShiftSchedule, ShiftAssignment, ShiftType,
  TeamMemberAvailability, EmployeeAvailability,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';

// ── 상수 ───────────────────────────────────────────────────────────────────
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_DAYS  = [1, 2, 3, 4, 5, 6, 0]; // 월~일 순서

const SHIFT_META: Record<ShiftType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  office:     { label: '사무실',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   icon: <Briefcase size={12}/> },
  field_work: { label: '외근',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <MapPin size={12}/> },
  remote:     { label: '재택',     color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <Laptop size={12}/> },
  overtime:   { label: '초과근무', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',     icon: <Zap size={12}/> },
  off:        { label: '휴무',     color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200',   icon: <X size={12}/> },
};

type TabType = 'schedule' | 'availability';

// ── 주의 월요일 계산 ─────────────────────────────────────────────────────
function getWeekMonday(date: Date): string {
  const d = startOfWeek(date, { weekStartsOn: 1 });
  return format(d, 'yyyy-MM-dd');
}

// ── 셀 컴포넌트 ────────────────────────────────────────────────────────────
function ShiftCell({
  assignment,
  availability,
  canEdit,
  onEdit,
}: {
  assignment?: ShiftAssignment;
  availability: { startTime: string; endTime: string; isAvailable: boolean }[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  if (assignment) {
    const meta = SHIFT_META[assignment.shiftType];
    return (
      <button
        onClick={canEdit ? onEdit : undefined}
        className={clsx(
          'w-full h-full min-h-[52px] p-1.5 rounded border text-xs text-left transition-opacity',
          meta.bg, meta.color,
          canEdit && 'hover:opacity-80 cursor-pointer',
          !canEdit && 'cursor-default',
        )}
      >
        <div className="flex items-center gap-1 font-medium">
          {meta.icon}
          <span>{meta.label}</span>
          {assignment.isConfirmed && <Check size={10} className="ml-auto text-green-600"/>}
        </div>
        {assignment.startTime && (
          <div className="mt-0.5 text-[10px] opacity-70">
            {assignment.startTime}~{assignment.endTime}
          </div>
        )}
        {assignment.location && (
          <div className="mt-0.5 text-[10px] opacity-70 truncate">{assignment.location}</div>
        )}
      </button>
    );
  }

  const avail = availability.filter((a) => a.isAvailable);
  if (avail.length > 0 && canEdit) {
    return (
      <button
        onClick={onEdit}
        className="w-full min-h-[52px] p-1.5 rounded border border-dashed border-gray-200 text-[10px] text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors text-left"
      >
        <div className="text-[9px] text-green-600 mb-0.5">가능</div>
        {avail[0].startTime}~{avail[0].endTime}
      </button>
    );
  }
  if (canEdit) {
    return (
      <button
        onClick={onEdit}
        className="w-full min-h-[52px] rounded border border-dashed border-gray-100 text-gray-300 hover:border-gray-300 transition-colors flex items-center justify-center"
      >
        <Plus size={14}/>
      </button>
    );
  }
  return <div className="w-full min-h-[52px] bg-gray-50 rounded"/>;
}

// ── 배정 편집 모달 ─────────────────────────────────────────────────────────
type AssignForm = {
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  location: string;
  note: string;
};

function AssignModal({
  open, onClose, userName, dateLabel, existing,
  onSave, onDelete,
}: {
  open: boolean; onClose: () => void; userName: string; dateLabel: string;
  existing?: ShiftAssignment;
  onSave: (form: AssignForm) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<AssignForm>(() => ({
    shift_type: existing?.shiftType ?? 'office',
    start_time: existing?.startTime ?? '09:00',
    end_time:   existing?.endTime   ?? '18:00',
    location:   existing?.location  ?? '',
    note:       existing?.note      ?? '',
  }));

  const needsTime = form.shift_type !== 'off';

  return (
    <Modal open={open} onClose={onClose} title={`${userName} — ${dateLabel}`}>
      <div className="space-y-4">
        {/* 근무 유형 */}
        <div>
          <label className="label">근무 유형</label>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(SHIFT_META) as ShiftType[]).map((t) => {
              const meta = SHIFT_META[t];
              return (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, shift_type: t })}
                  className={clsx(
                    'flex flex-col items-center gap-1 p-2 rounded border text-xs transition-all',
                    form.shift_type === t
                      ? `${meta.bg} ${meta.color} border-current font-semibold`
                      : 'border-border text-text-secondary hover:border-gray-300',
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {needsTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">시작 시간</label>
              <input type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">종료 시간</label>
              <input type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="input"
              />
            </div>
          </div>
        )}

        {form.shift_type === 'field_work' && (
          <div>
            <label className="label">외근 장소</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input"
              placeholder="고객사, 현장 주소 등"
            />
          </div>
        )}

        <div>
          <label className="label">메모</label>
          <textarea value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="input resize-none" rows={2}/>
        </div>

        <div className="flex justify-between pt-2">
          {existing && onDelete ? (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500">
              배정 삭제
            </Button>
          ) : <span/>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={() => onSave(form)}>저장</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── 가용시간 등록 모달 ─────────────────────────────────────────────────────
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function AvailabilityModal({
  open, onClose, existing,
  onSave,
}: {
  open: boolean; onClose: () => void;
  existing?: EmployeeAvailability;
  onSave: (data: {
    day_of_week?: number; specific_date?: string;
    start_time: string; end_time: string;
    is_available: boolean; note: string;
    effective_from?: string; effective_until?: string;
  }) => void;
}) {
  const [mode, setMode] = useState<'weekly' | 'specific'>('weekly');
  const [dow, setDow] = useState(existing?.dayOfWeek ?? 1);
  const [specificDate, setSpecificDate] = useState(existing?.specificDate ?? '');
  const [startTime, setStartTime] = useState(existing?.startTime ?? '09:00');
  const [endTime, setEndTime]     = useState(existing?.endTime   ?? '18:00');
  const [isAvailable, setIsAvailable] = useState(existing?.isAvailable ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [effectiveFrom, setEffectiveFrom]   = useState(existing?.effectiveFrom  ?? '');
  const [effectiveUntil, setEffectiveUntil] = useState(existing?.effectiveUntil ?? '');

  const handleSave = () => {
    const data: Parameters<typeof onSave>[0] = {
      start_time: startTime, end_time: endTime,
      is_available: isAvailable, note,
      effective_from: effectiveFrom || undefined,
      effective_until: effectiveUntil || undefined,
    };
    if (mode === 'specific') data.specific_date = specificDate;
    else data.day_of_week = dow;
    onSave(data);
  };

  return (
    <Modal open={open} onClose={onClose} title="가용시간 등록">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['weekly', 'specific'] as const).map((m) => (
            <button
              key={m} onClick={() => setMode(m)}
              className={clsx(
                'flex-1 py-1.5 rounded text-sm border transition-all',
                mode === m ? 'bg-primary-500 text-white border-primary-500' : 'border-border text-text-secondary',
              )}
            >
              {m === 'weekly' ? '요일 반복' : '특정 날짜'}
            </button>
          ))}
        </div>

        {mode === 'weekly' ? (
          <div>
            <label className="label">요일</label>
            <div className="flex gap-1">
              {DOW_LABELS.map((l, i) => (
                <button
                  key={i} onClick={() => setDow(i)}
                  className={clsx(
                    'flex-1 py-1.5 rounded text-sm border transition-all',
                    dow === i ? 'bg-primary-500 text-white border-primary-500' : 'border-border text-text-secondary hover:border-gray-300',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="label">날짜</label>
            <input type="date" value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="input"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="rounded border-border text-primary-500"
            />
            <span className="text-sm">근무 가능</span>
          </label>
        </div>

        {isAvailable && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">시작 시간</label>
              <input type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">종료 시간</label>
              <input type="time" value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input"
              />
            </div>
          </div>
        )}

        {mode === 'weekly' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">유효 시작일</label>
              <input type="date" value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">유효 종료일</label>
              <input type="date" value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
                className="input"
              />
            </div>
          </div>
        )}

        <div>
          <label className="label">메모</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="input" placeholder="외부 스케줄, 개인 사유 등"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 메인 페이지
// ═══════════════════════════════════════════════════════════════════════════
export default function ShiftSchedulePage() {
  usePageTitle('팀 근무표');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isManager = user?.role !== 'employee';

  // 팀장 여부 확인 (employee role이지만 리더인 경우)
  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => api.get('/teams/mine').then((r) => r.data.data as { id: string; leaderId: string | null }[]),
    enabled: user?.role === 'employee',
  });
  const isTeamLeader = isManager || (myTeams?.some((t) => t.leaderId === user?.id) ?? false);


  const [tab, setTab] = useState<TabType>('schedule');
  const [currentWeek, setCurrentWeek] = useState(() => getWeekMonday(new Date()));
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAvailModal, setShowAvailModal]   = useState(false);

  // 셀 편집
  const [editCell, setEditCell] = useState<{
    userId: string; userName: string; date: string; dateLabel: string;
    existing?: ShiftAssignment;
  } | null>(null);

  // 주간 날짜 배열 (월~일)
  const weekDates = WEEK_DAYS.map((dow) => {
    const base = parseISO(currentWeek); // 월요일
    const offset = dow === 0 ? 6 : dow - 1; // 월=0, ..., 일=6
    return format(addDays(base, offset), 'yyyy-MM-dd');
  });

  // ── 데이터 조회 ────────────────────────────────────────────────────────
  const { data: schedulesRes } = useQuery({
    queryKey: ['shift-schedules', currentWeek],
    queryFn:  () => api.get('/shift-schedule', { params: { week_start: currentWeek } }).then((r) => r.data.data as ShiftSchedule[]),
  });

  const schedules = schedulesRes ?? [];
  const currentSchedule = selectedScheduleId
    ? schedules.find((s) => s.id === selectedScheduleId)
    : schedules[0];

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['shift-schedule-detail', currentSchedule?.id],
    queryFn:  () => currentSchedule
      ? api.get(`/shift-schedule/${currentSchedule.id}`).then((r) => r.data.data as ShiftSchedule & { assignments: ShiftAssignment[] })
      : Promise.resolve(null),
    enabled: !!currentSchedule?.id,
  });

  const { data: teamAvailRes } = useQuery({
    queryKey: ['team-availability', currentWeek, currentSchedule?.department],
    queryFn:  () => api.get('/shift-schedule/team-availability', {
      params: { week_start: currentWeek, department: currentSchedule?.department },
    }).then((r) => r.data.data as { weekDates: string[]; team: TeamMemberAvailability[] }),
    enabled: isTeamLeader,
  });

  const { data: myAvailRes, refetch: refetchMyAvail } = useQuery({
    queryKey: ['my-availability'],
    queryFn:  () => api.get('/shift-schedule/availability').then((r) => r.data.data as EmployeeAvailability[]),
  });

  const teamMembers = teamAvailRes?.team ?? [];
  const assignments = detailRes?.assignments ?? [];

  // ── 뮤테이션 ──────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: { title: string; week_start: string; department?: string; note?: string }) =>
      api.post('/shift-schedule', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedules'] });
      setShowCreateModal(false);
      toast.success('근무표가 생성되었습니다.');
    },
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api.post(`/shift-schedule/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedules'] });
      qc.invalidateQueries({ queryKey: ['shift-schedule-detail'] });
      toast.success('근무표가 팀에 공유되었습니다.');
    },
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => api.post(`/shift-schedule/${id}/unpublish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedules'] });
      toast.success('초안으로 되돌렸습니다.');
    },
  });

  const assignMut = useMutation({
    mutationFn: (data: { schedId: string; assignments: object[] }) =>
      api.post(`/shift-schedule/${data.schedId}/assignments`, { assignments: data.assignments }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedule-detail'] });
      setEditCell(null);
      toast.success('배정이 저장되었습니다.');
    },
  });

  const deleteAssignMut = useMutation({
    mutationFn: (data: { schedId: string; userId: string; date: string }) =>
      api.delete(`/shift-schedule/${data.schedId}/assignments`, {
        params: { user_id: data.userId, date: data.date },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedule-detail'] });
      setEditCell(null);
      toast.success('배정이 삭제되었습니다.');
    },
  });

  const recommendMut = useMutation({
    mutationFn: (id: string) => api.post(`/shift-schedule/${id}/recommend`).then((r) => r.data.data),
    onSuccess: (recs, id) => {
      if (!recs || recs.length === 0) return toast('추천할 가용시간이 없습니다.');
      assignMut.mutate({ schedId: id, assignments: recs });
      toast.success(`${recs.length}건 추천 배정이 적용되었습니다.`);
    },
  });

  const confirmMut = useMutation({
    mutationFn: (data: { schedId: string; assignId: string }) =>
      api.post(`/shift-schedule/${data.schedId}/assignments/${data.assignId}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-schedule-detail'] });
      toast.success('확인 완료');
    },
  });

  const availMut = useMutation({
    mutationFn: (data: object) => api.post('/shift-schedule/availability', data),
    onSuccess: () => {
      refetchMyAvail();
      setShowAvailModal(false);
      toast.success('가용시간이 저장되었습니다.');
    },
  });

  const deleteAvailMut = useMutation({
    mutationFn: (id: string) => api.delete(`/shift-schedule/availability/${id}`),
    onSuccess: () => {
      refetchMyAvail();
      toast.success('가용시간이 삭제되었습니다.');
    },
  });

  // ── 헬퍼 ──────────────────────────────────────────────────────────────
  const getAssignment = useCallback((userId: string, date: string) =>
    assignments.find((a) => a.userId === userId && a.date === date),
  [assignments]);

  const getMemberAvail = useCallback((userId: string, date: string) =>
    teamMembers.find((m) => m.user.id === userId)?.availability[date] ?? [],
  [teamMembers]);

  // ── 근무표 생성 폼 ─────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ title: '', note: '', department: '' });
  const handleCreateSubmit = () => {
    if (!createForm.title.trim()) return toast.error('제목을 입력해주세요.');
    createMut.mutate({
      title:      createForm.title,
      week_start: currentWeek,
      department: createForm.department || undefined,
      note:       createForm.note || undefined,
    });
  };

  // ── 배정 저장 핸들러 ────────────────────────────────────────────────────
  const handleAssignSave = (form: AssignForm) => {
    if (!currentSchedule || !editCell) return;
    assignMut.mutate({
      schedId: currentSchedule.id,
      assignments: [{
        user_id:    editCell.userId,
        date:       editCell.date,
        shift_type: form.shift_type,
        start_time: form.shift_type !== 'off' ? form.start_time : undefined,
        end_time:   form.shift_type !== 'off' ? form.end_time   : undefined,
        location:   form.shift_type === 'field_work' ? form.location : undefined,
        note:       form.note || undefined,
      }],
    });
  };

  const handleAssignDelete = () => {
    if (!currentSchedule || !editCell) return;
    deleteAssignMut.mutate({ schedId: currentSchedule.id, userId: editCell.userId, date: editCell.date });
  };

  const isDraft = currentSchedule?.status === 'draft';

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="p-4 md:p-8 space-y-4 max-w-[1280px]">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">팀 근무표</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            직원별 가용시간 기반으로 주간 근무표를 작성하고 팀에 공유합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAvailModal(true)}>
            <Clock size={14}/> 내 가용시간
          </Button>
          {isTeamLeader && (
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14}/> 근무표 작성
            </Button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'schedule',     label: '근무표', icon: <CalendarDays size={14}/> },
          { id: 'availability', label: '가용시간', icon: <Clock size={14}/> },
        ] as { id: TabType; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary-500 text-primary-600 font-medium'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── 근무표 탭 ─────────────────────────────────────────────────── */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {/* 주 탐색 + 근무표 선택 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentWeek(getWeekMonday(subWeeks(parseISO(currentWeek), 1)))}
                className="p-1.5 rounded hover:bg-surface-2 transition-colors">
                <ChevronLeft size={16}/>
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(parseISO(currentWeek), 'M월 d일', { locale: ko })} 주
              </span>
              <button onClick={() => setCurrentWeek(getWeekMonday(addWeeks(parseISO(currentWeek), 1)))}
                className="p-1.5 rounded hover:bg-surface-2 transition-colors">
                <ChevronRight size={16}/>
              </button>
            </div>

            {schedules.length > 1 && (
              <select
                value={currentSchedule?.id ?? ''}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="input text-sm py-1 max-w-xs"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} ({s.department ?? '전체'})</option>
                ))}
              </select>
            )}

            {isTeamLeader && currentSchedule && (
              <div className="flex gap-2 ml-auto">
                {isDraft ? (
                  <>
                    <Button size="sm" variant="ghost"
                      onClick={() => recommendMut.mutate(currentSchedule.id)}
                      disabled={recommendMut.isPending}
                    >
                      <Star size={14}/> 자동 추천
                    </Button>
                    <Button size="sm"
                      onClick={() => publishMut.mutate(currentSchedule.id)}
                      disabled={publishMut.isPending}
                    >
                      <Send size={14}/> 팀 공유
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost"
                    onClick={() => unpublishMut.mutate(currentSchedule.id)}>
                    <RotateCcw size={14}/> 초안으로
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 상태 배지 */}
          {currentSchedule && (
            <div className="flex items-center gap-2">
              <span className={clsx(
                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                currentSchedule.status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700',
              )}>
                {currentSchedule.status === 'published' ? <Check size={10}/> : <AlertCircle size={10}/>}
                {currentSchedule.status === 'published' ? '공유됨' : '초안'}
              </span>
              {currentSchedule.department && (
                <span className="text-xs text-text-secondary">
                  <Users size={12} className="inline mr-1"/>
                  {currentSchedule.department}
                </span>
              )}
              {currentSchedule.note && (
                <span className="text-xs text-text-secondary">{currentSchedule.note}</span>
              )}
            </div>
          )}

          {/* 근무표 그리드 */}
          {currentSchedule ? (
            detailLoading ? (
              <div className="text-center py-8 text-text-secondary text-sm">불러오는 중...</div>
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-left text-sm font-medium text-text-secondary w-32 sticky left-0 bg-white z-10">
                        직원
                      </th>
                      {WEEK_DAYS.map((dow, i) => {
                        const dateStr = weekDates[i];
                        const dateObj = parseISO(dateStr);
                        const isWeekend = dow === 0 || dow === 6;
                        return (
                          <th key={dow} className={clsx(
                            'p-2 text-center text-xs font-medium min-w-[90px]',
                            isWeekend ? 'text-red-400' : 'text-text-secondary',
                          )}>
                            <div>{DAY_LABELS[dow]}</div>
                            <div className="font-normal opacity-70">{format(dateObj, 'M/d')}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.user.id} className="border-b border-border/50 hover:bg-surface-1/30">
                        <td className="p-3 sticky left-0 bg-white z-10">
                          <div className="text-sm font-medium text-text-primary">{member.user.name}</div>
                          <div className="text-xs text-text-secondary">{member.user.position ?? member.user.department ?? ''}</div>
                        </td>
                        {WEEK_DAYS.map((dow, i) => {
                          const dateStr    = weekDates[i];
                          const assignment = getAssignment(member.user.id, dateStr);
                          const avail      = getMemberAvail(member.user.id, dateStr);
                          const canEdit    = isTeamLeader && isDraft;

                          return (
                            <td key={dow} className="p-1">
                              <ShiftCell
                                assignment={assignment}
                                availability={avail}
                                canEdit={canEdit}
                                onEdit={() => setEditCell({
                                  userId:    member.user.id,
                                  userName:  member.user.name,
                                  date:      dateStr,
                                  dateLabel: `${DAY_LABELS[dow]} ${format(parseISO(dateStr), 'M/d')}`,
                                  existing:  assignment,
                                })}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {teamMembers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm text-text-secondary">
                          팀원 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            )
          ) : (
            <Card>
              <div className="text-center py-8">
                <CalendarDays size={32} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-text-secondary text-sm">이번 주 근무표가 없습니다.</p>
                {isTeamLeader && (
                  <Button size="sm" className="mt-3" onClick={() => setShowCreateModal(true)}>
                    <Plus size={14}/> 근무표 만들기
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* 범례 */}
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            {(Object.entries(SHIFT_META) as [ShiftType, typeof SHIFT_META[ShiftType]][]).map(([t, meta]) => (
              <span key={t} className={clsx('flex items-center gap-1 px-2 py-0.5 rounded border', meta.bg, meta.color)}>
                {meta.icon} {meta.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 가용시간 탭 ────────────────────────────────────────────────── */}
      {tab === 'availability' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              내가 근무 가능한 시간대를 등록하면 관리자가 근무표 작성 시 참고합니다.
            </p>
            <Button size="sm" onClick={() => setShowAvailModal(true)}>
              <Plus size={14}/> 가용시간 추가
            </Button>
          </div>

          {(myAvailRes ?? []).length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <Clock size={32} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-sm text-text-secondary">등록된 가용시간이 없습니다.</p>
              </div>
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {(myAvailRes ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      a.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    )}>
                      {a.isAvailable ? '가능' : '불가'}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {a.specificDate
                          ? format(parseISO(a.specificDate), 'M월 d일 (E)', { locale: ko })
                          : `매주 ${DOW_LABELS[a.dayOfWeek ?? 0]}요일`}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {a.isAvailable ? `${a.startTime} ~ ${a.endTime}` : '근무 불가'}
                        {a.effectiveFrom && ` · ${a.effectiveFrom}부터`}
                        {a.effectiveUntil && ` ~ ${a.effectiveUntil}까지`}
                        {a.note && ` · ${a.note}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAvailMut.mutate(a.id)}
                    className="p-1.5 text-text-secondary hover:text-red-500 rounded transition-colors"
                  >
                    <X size={14}/>
                  </button>
                </div>
              ))}
            </Card>
          )}

          {/* 팀원 가용시간 요약 (관리자 또는 팀장) */}
          {isTeamLeader && teamAvailRes && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">팀원 가용시간 현황</h3>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-2 text-left sticky left-0 bg-white">직원</th>
                      {WEEK_DAYS.map((dow, i) => (
                        <th key={dow} className={clsx('p-2 text-center', (dow === 0 || dow === 6) && 'text-red-400')}>
                          {DAY_LABELS[dow]}<br/>
                          <span className="font-normal opacity-70">{format(parseISO(weekDates[i]), 'M/d')}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamAvailRes.team.map((m) => (
                      <tr key={m.user.id} className="border-b border-border/50">
                        <td className="p-2 sticky left-0 bg-white font-medium">{m.user.name}</td>
                        {WEEK_DAYS.map((dow, i) => {
                          const slots = (m.availability[weekDates[i]] ?? []).filter((s) => s.isAvailable);
                          return (
                            <td key={dow} className="p-1 text-center">
                              {slots.length > 0 ? (
                                <span className="inline-block px-1 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">
                                  {slots[0].startTime}~{slots[0].endTime}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── 모달들 ──────────────────────────────────────────────────────── */}

      {/* 근무표 생성 */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="근무표 작성">
        <div className="space-y-4">
          <div>
            <label className="label">근무표 제목 *</label>
            <input value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="input" placeholder="예: 4월 3주차 영업팀 근무표"
            />
          </div>
          <div>
            <label className="label">대상 부서 (빈칸 = 전체)</label>
            <input value={createForm.department}
              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
              className="input" placeholder="영업팀, 개발팀 등"
            />
          </div>
          <div>
            <label className="label">메모</label>
            <textarea value={createForm.note}
              onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
              className="input resize-none" rows={2}/>
          </div>
          <p className="text-xs text-text-secondary">
            대상 주: <strong>{format(parseISO(currentWeek), 'M월 d일', { locale: ko })}</strong> ~ <strong>{format(addDays(parseISO(currentWeek), 6), 'M월 d일', { locale: ko })}</strong>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>취소</Button>
            <Button onClick={handleCreateSubmit} disabled={createMut.isPending}>
              생성
            </Button>
          </div>
        </div>
      </Modal>

      {/* 배정 편집 */}
      {editCell && (
        <AssignModal
          open={!!editCell}
          onClose={() => setEditCell(null)}
          userName={editCell.userName}
          dateLabel={editCell.dateLabel}
          existing={editCell.existing}
          onSave={handleAssignSave}
          onDelete={editCell.existing ? handleAssignDelete : undefined}
        />
      )}

      {/* 가용시간 등록 */}
      <AvailabilityModal
        open={showAvailModal}
        onClose={() => setShowAvailModal(false)}
        onSave={(data) => availMut.mutate(data)}
      />
    </div>
    </div>
  );
}
