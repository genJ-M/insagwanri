'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast, parseISO } from 'date-fns';
import {
  Plus, Search, AlertCircle, Sparkles, Copy, Trash2,
  ChevronDown, Loader2, X, CheckCircle2, FileText,
  Clock, AlignLeft, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';
import Badge, { TASK_STATUS_BADGE, TASK_PRIORITY_BADGE } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { TemplateManager } from '@/components/templates/TemplateManager';
import { Task, TaskStatus } from '@/types';
import {
  TASK_CATEGORIES, getCategoryById, CATEGORY_GROUPS,
  type TaskCategory,
} from '@/constants/taskTemplates';

// ── 상수 ─────────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: '',            label: '전체' },
  { value: 'pending',     label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'review',      label: '검토중' },
  { value: 'done',        label: '완료' },
];

const STATUS_KO: Record<string, string> = {
  pending: '대기', in_progress: '진행중', review: '검토중', done: '완료', cancelled: '취소',
};

const PRIORITY_KO: Record<string, string> = {
  low: '낮음', normal: '보통', high: '높음', urgent: '긴급',
};

// ── 담당자 아바타 (작은 버전) ─────────────────────────────────────────────────
function AssigneeAvatar({ user, size = 'sm' }: { user: { name?: string; profileImageUrl?: string | null }; size?: 'sm' | 'xs' }) {
  const dim = size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-xs';
  if (user.profileImageUrl) {
    return (
      <img
        src={user.profileImageUrl}
        alt={user.name ?? ''}
        className={clsx(dim, 'rounded-full object-cover ring-1 ring-white flex-shrink-0')}
      />
    );
  }
  return <Avatar name={user.name ?? '?'} size="sm" />;
}

// ── 담당자 선택 드롭다운 (프로필 사진 포함) ─────────────────────────────────
function AssigneeSelect({
  value, onChange, members,
}: {
  value: string;
  onChange: (id: string) => void;
  members: any[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = members.find((m) => m.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center gap-2 text-left w-full"
      >
        {selected ? (
          <>
            <AssigneeAvatar user={selected} size="xs" />
            <span className="flex-1 text-sm text-text-primary">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-text-muted">미배정</span>
        )}
        <ChevronDown className="h-4 w-4 text-text-muted flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 py-1 max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-50 text-sm text-text-muted"
          >
            미배정
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2 hover:bg-zinc-50 text-left',
                value === m.id && 'bg-primary-50',
              )}
            >
              <AssigneeAvatar user={m} size="xs" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{m.name}</p>
                {m.department && <p className="text-[11px] text-text-muted">{m.department}</p>}
              </div>
              {value === m.id && <CheckCircle2 className="h-4 w-4 text-primary-500 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 날짜+시간 피커 (1시간 단위) ───────────────────────────────────────────────
function DueDatetimePicker({
  value,
  onChange,
}: {
  value: { date: string; hour: string };
  onChange: (v: { date: string; hour: string }) => void;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={value.date}
        min={todayStr}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
        className="input flex-1 text-sm"
      />
      <select
        value={value.hour}
        onChange={(e) => onChange({ ...value, hour: e.target.value })}
        className="input w-24 text-sm"
        disabled={!value.date}
      >
        <option value="">시간</option>
        {hours.map((h) => (
          <option key={h} value={h}>{h}:00</option>
        ))}
      </select>
    </div>
  );
}

// ── 템플릿 선택 모달 ──────────────────────────────────────────────────────────
function TemplatePickerModal({
  open, onClose, onSelect, recommendedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (cat: TaskCategory) => void;
  recommendedId: string | null;
}) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = TASK_CATEGORIES.filter((c) => {
    const matchGroup = !selectedGroup || c.group === selectedGroup;
    const matchSearch = !search || c.label.includes(search) || c.keywords.some((k) => k.includes(search));
    return matchGroup && matchSearch;
  });

  return (
    <Modal open={open} onClose={onClose} title="업무 템플릿 선택" size="md">
      <div className="space-y-3">
        {recommendedId && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-primary-700">AI 추천 템플릿</p>
              <p className="text-sm text-primary-600">{getCategoryById(recommendedId)?.label}</p>
            </div>
            <button
              onClick={() => { const c = getCategoryById(recommendedId); if (c) onSelect(c); }}
              className="text-xs font-semibold bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
            >
              적용
            </button>
          </div>
        )}

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="템플릿 검색..."
            className="input pl-8 text-sm"
          />
        </div>

        {/* 그룹 필터 */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedGroup(null)}
            className={clsx('text-xs px-2.5 py-1 rounded-full border transition-colors',
              !selectedGroup ? 'bg-primary-500 text-white border-primary-500' : 'border-border text-text-muted hover:border-primary-300')}
          >전체</button>
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g === selectedGroup ? null : g)}
              className={clsx('text-xs px-2.5 py-1 rounded-full border transition-colors',
                selectedGroup === g ? 'bg-primary-500 text-white border-primary-500' : 'border-border text-text-muted hover:border-primary-300')}
            >{g}</button>
          ))}
        </div>

        {/* 카테고리 목록 */}
        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
          {filtered.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat)}
              className={clsx(
                'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl border text-left transition-all hover:border-primary-300 hover:bg-primary-50',
                cat.id === recommendedId ? 'border-primary-200 bg-primary-50' : 'border-border',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{cat.label}</p>
                <p className="text-[11px] text-text-muted">{cat.group}</p>
              </div>
              {cat.id === recommendedId && (
                <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">AI 추천</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── 기존 업무 복제 모달 ──────────────────────────────────────────────────────
function DuplicateTaskModal({
  open, onClose, onDuplicate,
}: {
  open: boolean;
  onClose: () => void;
  onDuplicate: (task: Task) => void;
}) {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['tasks-for-duplicate'],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { limit: 50 } });
      return (data?.tasks ?? data?.data ?? []) as Task[];
    },
    enabled: open,
  });

  const filtered = (data ?? []).filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal open={open} onClose={onClose} title="기존 업무에서 복제" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업무 검색..."
            className="input pl-8 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-text-muted">업무가 없습니다</p>
          ) : filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => onDuplicate(t)}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl border border-border text-left hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{t.title}</p>
                <p className="text-[11px] text-text-muted">{STATUS_KO[t.status]} · {PRIORITY_KO[t.priority]}</p>
              </div>
              <Copy className="h-4 w-4 text-text-muted flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── 업무 생성 모달 ────────────────────────────────────────────────────────────
function CreateTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({
    title: '', description: '', scope: '', priority: 'normal',
    due_date: '', assignee_id: '', category: '',
  });
  const [dueDatetime, setDueDatetime] = useState<{ date: string; hour: string }>({ date: '', hour: '' });
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return (data.data ?? data) as any[];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/tasks', payload),
    onSuccess: () => {
      toast.success('업무가 생성되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '업무 생성에 실패했습니다.');
    },
  });

  const resetForm = () => {
    setForm({ title: '', description: '', scope: '', priority: 'normal', due_date: '', assignee_id: '', category: '' });
    setDueDatetime({ date: '', hour: '' });
    setRecommendedId(null);
  };

  // AI 분류 → 템플릿 추천
  const handleAiRecommend = useCallback(async () => {
    if (!form.title.trim()) {
      toast.error('먼저 업무 제목을 입력해주세요.');
      return;
    }
    setClassifying(true);
    try {
      const { data } = await api.post('/ai/classify-task', { title: form.title });
      const catId = data?.data?.category_id ?? 'other';
      setRecommendedId(catId);
      setShowTemplatePicker(true);
    } catch {
      toast.error('AI 분류 중 오류가 발생했습니다.');
    } finally {
      setClassifying(false);
    }
  }, [form.title]);

  // 템플릿 적용
  const handleTemplateSelect = (cat: TaskCategory) => {
    setForm((f) => ({ ...f, description: cat.template, category: cat.id }));
    setShowTemplatePicker(false);
    toast.success(`"${cat.label}" 템플릿이 적용되었습니다.`);
  };

  // 반복업무 템플릿 적용 (백엔드 템플릿)
  const handleRecurringTemplateSelect = (tmpl: any) => {
    setForm((f) => ({
      ...f,
      title: tmpl.title,
      description: tmpl.description,
      scope: tmpl.scope,
      priority: tmpl.defaultPriority,
      category: tmpl.category,
    }));
  };

  // 기존 업무 복제
  const handleDuplicate = (task: Task) => {
    setForm({
      title: `[복제] ${task.title}`,
      description: task.description ?? '',
      scope: task.scope ?? '',
      priority: task.priority ?? 'normal',
      due_date: '',
      assignee_id: '',
      category: task.category ?? '',
    });
    setDueDatetime({ date: '', hour: '' });
    setShowDuplicate(false);
    toast.success('업무 내용이 복사되었습니다. 필요한 부분을 수정해주세요.');
  };

  const handleSubmit = () => {
    // due_datetime 조합
    let due_datetime: string | undefined;
    if (dueDatetime.date && dueDatetime.hour) {
      due_datetime = `${dueDatetime.date}T${dueDatetime.hour}:00:00+09:00`;
    }
    mutation.mutate({
      title:        form.title,
      description:  form.description || undefined,
      scope:        form.scope || undefined,
      priority:     form.priority,
      due_date:     form.due_date || undefined,
      due_datetime,
      assignee_id:  form.assignee_id || undefined,
      category:     form.category || undefined,
    });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="업무 생성" size="md">
        <div className="space-y-4">
          {/* 복제 버튼 + 커스텀 템플릿 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDuplicate(true)}
              className="flex items-center gap-2 flex-1 min-w-[180px] px-4 py-2.5 rounded-xl border border-dashed border-zinc-300 hover:border-primary-300 hover:bg-primary-50 text-sm text-text-muted hover:text-primary-600 transition-all"
            >
              <Copy className="h-4 w-4" />
              기존 업무에서 복제하기
            </button>
            <TemplateManager
              type="task"
              currentFields={{
                title: form.title, description: form.description,
                category: form.category, priority: form.priority, scope: form.scope,
              }}
              onLoad={(fields) => {
                const f = fields as any;
                setForm({
                  title:       f.title       ?? '',
                  description: f.description ?? '',
                  scope:       f.scope       ?? '',
                  priority:    f.priority    ?? 'normal',
                  due_date:    '',
                  assignee_id: '',
                  category:    f.category    ?? '',
                });
              }}
            />
          </div>

          {/* 제목 + AI 추천 버튼 */}
          <div>
            <label className="label">업무 제목 *</label>
            <div className="flex gap-2">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="업무 제목을 입력하세요"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={handleAiRecommend}
                disabled={classifying}
                title="AI가 제목을 분석해서 적합한 템플릿을 추천합니다"
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all flex-shrink-0',
                  classifying
                    ? 'border-border bg-zinc-50 text-text-muted cursor-not-allowed'
                    : 'border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100',
                )}
              >
                {classifying
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                AI 추천
              </button>
            </div>
            {form.category && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <FileText className="h-3 w-3 text-primary-500" />
                <span className="text-[11px] text-primary-600 font-medium">
                  템플릿 적용: {getCategoryById(form.category)?.label}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  className="text-[11px] text-text-muted underline"
                >
                  변경
                </button>
              </div>
            )}
          </div>

          {/* 업무 범위 */}
          <div>
            <label className="label flex items-center gap-1">
              <AlignLeft className="h-3 w-3" />
              업무 범위 <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="예) 영업팀 전체 / 3분기 / 매장 1~2층"
              className="input text-sm"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="label">구체적인 내용</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={6}
              placeholder="업무 내용을 입력하거나 AI 추천 버튼으로 템플릿을 불러오세요"
              className="input resize-none font-mono text-sm"
            />
          </div>

          {/* 담당자 */}
          <div>
            <label className="label">담당자</label>
            <AssigneeSelect
              value={form.assignee_id}
              onChange={(id) => setForm({ ...form, assignee_id: id })}
              members={members}
            />
          </div>

          {/* 우선순위 */}
          <div>
            <label className="label">우선순위</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="input"
            >
              {Object.entries(PRIORITY_KO).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* 기한 (날짜 + 시간) */}
          <div>
            <label className="label flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              기한 <span className="text-red-500 ml-0.5">*</span>
              <span className="text-[10px] text-text-muted font-normal ml-1">(1시간 단위, 오늘 이후만)</span>
            </label>
            <DueDatetimePicker value={dueDatetime} onChange={setDueDatetime} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button
              loading={mutation.isPending}
              disabled={!form.title.trim() || !form.scope.trim() || !dueDatetime.date || !dueDatetime.hour}
              onClick={handleSubmit}
            >
              생성
            </Button>
          </div>
        </div>
      </Modal>

      <TemplatePickerModal
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
        recommendedId={recommendedId}
      />
      <DuplicateTaskModal
        open={showDuplicate}
        onClose={() => setShowDuplicate(false)}
        onDuplicate={handleDuplicate}
      />
    </>
  );
}

// ── 삭제 요청 배너 ────────────────────────────────────────────────────────────
function DeletionRequestBanner({ task, onClose }: { task: Task; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isManager  = user?.role !== 'employee';
  const isAssignee = task.assignee?.id === user?.id;
  const requesterRole = (task as any).deletionRequesterRole;
  const canApprove =
    (requesterRole === 'manager'  && isAssignee && !isManager) ||
    (requesterRole === 'assignee' && isManager);

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/tasks/${task.id}/approve-deletion`),
    onSuccess: () => {
      toast.success('업무가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '삭제 승인 실패'),
  });

  const requesterLabel = requesterRole === 'manager' ? '관리자' : '담당자';

  return (
    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
      <Trash2 className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">삭제 요청 대기 중</p>
        <p className="text-xs text-red-500 mt-0.5">
          {requesterLabel}가 이 업무의 삭제를 요청했습니다.
          {canApprove ? ' 아래 버튼으로 최종 승인하면 삭제됩니다.' : ' 상대방의 승인이 필요합니다.'}
        </p>
      </div>
      {canApprove && (
        <Button
          size="sm"
          variant="ghost"
          loading={approveMutation.isPending}
          onClick={() => approveMutation.mutate()}
          className="text-red-600 border border-red-200 hover:bg-red-100 flex-shrink-0"
        >
          삭제 승인
        </Button>
      )}
    </div>
  );
}

// ── 기한 조정 패널 ────────────────────────────────────────────────────────────
function TimeAdjustPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAssignee = task.assignee?.id === user?.id;
  const isManager  = user?.role !== 'employee';
  const isCreator  = task.creator?.id === user?.id;
  const canRespond = (isManager || isCreator) && task.timeAdjustStatus === 'pending';
  const canRequest = isAssignee && !task.timeAdjustStatus || task.timeAdjustStatus === 'approved' || task.timeAdjustStatus === 'rejected';

  const [propDatetime, setPropDatetime] = useState<{ date: string; hour: string }>({ date: '', hour: '' });
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const requestMutation = useMutation({
    mutationFn: () => {
      const proposed_datetime = `${propDatetime.date}T${propDatetime.hour}:00:00+09:00`;
      return api.post(`/tasks/${task.id}/time-adjust-request`, {
        proposed_datetime,
        message: message || undefined,
      });
    },
    onSuccess: () => {
      toast.success('기한 조정 요청이 전송되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '요청 실패'),
  });

  const respondMutation = useMutation({
    mutationFn: (action: 'approved' | 'rejected') =>
      api.patch(`/tasks/${task.id}/time-adjust-respond`, { action }),
    onSuccess: (_, action) => {
      toast.success(action === 'approved' ? '기한 조정 요청을 승인했습니다.' : '기한 조정 요청을 거절했습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '처리 실패'),
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  if (task.timeAdjustStatus === 'pending') {
    const propDt = task.timeAdjustProposedDatetime
      ? format(new Date(task.timeAdjustProposedDatetime), 'yyyy-MM-dd HH:00')
      : '-';
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">기한 조정 요청 대기 중</p>
        </div>
        <p className="text-xs text-amber-700">
          제안 기한: <strong>{propDt}</strong>
          {task.timeAdjustMessage && <> · <em>"{task.timeAdjustMessage}"</em></>}
        </p>
        {canRespond && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              loading={respondMutation.isPending}
              onClick={() => respondMutation.mutate('approved')}
              className="bg-green-600 hover:bg-green-700 text-white border-0"
            >
              승인
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={respondMutation.isPending}
              onClick={() => respondMutation.mutate('rejected')}
              className="text-red-600 border border-red-200 hover:bg-red-50"
            >
              거절
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!isAssignee || task.status === 'done' || task.status === 'cancelled') return null;

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 text-xs text-text-muted hover:text-primary-600 underline"
      >
        <Clock className="h-3.5 w-3.5" />
        기한 조정 요청하기
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-3">
      <p className="text-sm font-semibold text-blue-800">기한 조정 제안</p>
      <div>
        <label className="text-xs text-blue-700 mb-1 block">제안할 기한</label>
        <div className="flex gap-2">
          <input
            type="date"
            min={todayStr}
            value={propDatetime.date}
            onChange={(e) => setPropDatetime((v) => ({ ...v, date: e.target.value }))}
            className="input flex-1 text-sm"
          />
          <select
            value={propDatetime.hour}
            onChange={(e) => setPropDatetime((v) => ({ ...v, hour: e.target.value }))}
            className="input w-24 text-sm"
            disabled={!propDatetime.date}
          >
            <option value="">시간</option>
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
              <option key={h} value={h}>{h}:00</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-blue-700 mb-1 block">사유 (선택)</label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="기한 조정 이유를 간략히 적어주세요"
          className="input text-sm"
          maxLength={200}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={requestMutation.isPending}
          disabled={!propDatetime.date || !propDatetime.hour}
          onClick={() => requestMutation.mutate()}
        >
          요청 전송
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>취소</Button>
      </div>
    </div>
  );
}

// ── 업무 상세 모달 ────────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const isManager  = user?.role !== 'employee';
  const isAssignee = task.assignee?.id === user?.id;
  const hasDeletionRequest = !!(task as any).deletionRequestedAt;

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.patch(`/tasks/${task.id}`, { status }),
    onSuccess: () => {
      toast.success('상태가 변경되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '상태 변경 실패'),
  });

  const requestDeletion = useMutation({
    mutationFn: () => api.patch(`/tasks/${task.id}/request-deletion`),
    onSuccess: () => {
      toast.success('삭제 요청이 전송되었습니다. 상대방의 승인이 필요합니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? '삭제 요청 실패'),
  });

  const dueDt = task.dueDatetime ?? task.dueDate ?? null;
  const isOverdue = dueDt && task.status !== 'done' && task.status !== 'cancelled'
    && isPast(new Date(dueDt));

  const nextStatuses: TaskStatus[] = (['pending', 'in_progress', 'review', 'done'] as TaskStatus[])
    .filter((s) => s !== task.status);

  const canRequestDeletion =
    !hasDeletionRequest &&
    task.status !== 'cancelled' &&
    (isManager || isAssignee);

  return (
    <Modal open onClose={onClose} title="업무 상세" size="md">
      <div className="space-y-4">
        {/* 삭제 요청 배너 */}
        {hasDeletionRequest && <DeletionRequestBanner task={task} onClose={onClose} />}

        {/* 제목 + 우선순위 */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-base font-semibold text-text-primary flex-1">{task.title}</h3>
            <Badge value={task.priority} colorMap={TASK_PRIORITY_BADGE} label={PRIORITY_KO[task.priority]} />
          </div>
          {task.scope && (
            <p className="text-xs text-text-muted mb-1">
              <span className="font-medium text-text-secondary">업무 범위:</span> {task.scope}
            </p>
          )}
          {task.description && (
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* 메타 정보 */}
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-border pt-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">현재 상태</p>
            <Badge value={task.status} colorMap={TASK_STATUS_BADGE} label={STATUS_KO[task.status]} />
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">담당자</p>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <AssigneeAvatar user={task.assignee as any} size="xs" />
                <span className="font-medium text-text-primary">{task.assignee.name}</span>
              </div>
            ) : (
              <span className="font-medium text-text-muted">미배정</span>
            )}
          </div>
          <div className="col-span-2">
            <p className="text-xs text-text-muted mb-0.5">기한</p>
            {task.dueDatetime ? (
              <p className={clsx(
                'font-medium flex items-center gap-1',
                isOverdue ? 'text-red-600' : 'text-text-primary',
              )}>
                {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                <Clock className="h-3.5 w-3.5 text-text-muted" />
                {format(new Date(task.dueDatetime), 'yyyy-MM-dd HH:00')}
                {isOverdue && ' (기한 초과)'}
                {task.timeAdjustStatus === 'pending' && (
                  <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">조정 요청 중</span>
                )}
              </p>
            ) : task.dueDate ? (
              <p className={clsx('font-medium', isOverdue ? 'text-red-600 flex items-center gap-1' : 'text-text-primary')}>
                {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                {task.dueDate}
              </p>
            ) : (
              <span className="text-text-muted">-</span>
            )}
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">생성자</p>
            <p className="font-medium text-text-primary">{task.creator?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">생성일</p>
            <p className="font-medium text-text-primary">
              {task.createdAt ? format(new Date(task.createdAt), 'yyyy-MM-dd') : '-'}
            </p>
          </div>
          {task.category && (
            <div>
              <p className="text-xs text-text-muted mb-0.5">카테고리</p>
              <p className="font-medium text-text-primary">
                {getCategoryById(task.category)?.label ?? task.category}
              </p>
            </div>
          )}
        </div>

        {/* 기한 조정 패널 */}
        <TimeAdjustPanel task={task} onClose={onClose} />

        {/* 상태 변경 */}
        {(user?.role !== 'employee' || task.assignee?.id === user?.id) && task.status !== 'cancelled' && (
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-muted mb-2">상태 변경</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="sm"
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className="border border-border"
                >
                  {STATUS_KO[s]}으로 변경
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {canRequestDeletion && (
            <Button
              variant="ghost"
              size="sm"
              loading={requestDeletion.isPending}
              onClick={() => requestDeletion.mutate()}
              className="text-red-500 hover:bg-red-50 border border-red-100"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              삭제 요청
            </Button>
          )}
          <div className="ml-auto">
            <Button variant="secondary" onClick={onClose}>닫기</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function TasksPage() {
  usePageTitle('업무 관리');
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', activeTab],
    queryFn: async () => {
      const { data } = await api.get('/tasks', {
        params: { status: activeTab || undefined, limit: 50 },
      });
      return data;
    },
  });

  const tasks: Task[] = data?.tasks ?? [];
  const summary = data?.meta?.status_summary ?? {};

  const filtered = search
    ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : tasks;

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-4 max-w-[1200px]">
        {/* 상단 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="업무 검색"
              className="input pl-9"
            />
          </div>
          {user?.role !== 'employee' && (
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />업무 생성
            </Button>
          )}
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-1 bg-background border border-border p-1 rounded-lg w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
              {tab.value && summary[tab.value] != null && (
                <span className="ml-1.5 text-xs text-text-muted">{summary[tab.value]}</span>
              )}
            </button>
          ))}
        </div>

        {/* 업무 목록 */}
        <Card padding="none">
          {isLoading ? (
            <div className="px-4"><SkeletonTableRows count={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">업무가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((task) => {
                const dueDt = task.dueDatetime ?? task.dueDate ?? null;
                const isOverdue = dueDt && task.status !== 'done' && task.status !== 'cancelled'
                  && new Date(dueDt) < new Date();
                const hasDeletion = !!(task as any).deletionRequestedAt;
                const hasTimeAdjust = task.timeAdjustStatus === 'pending';

                return (
                  <li key={task.id}>
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-background transition-colors text-left"
                    >
                      {/* 삭제 요청 인디케이터 */}
                      {hasDeletion && (
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="삭제 요청 대기 중" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                          <Badge value={task.priority} colorMap={TASK_PRIORITY_BADGE} label={PRIORITY_KO[task.priority]} />
                          {hasDeletion && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
                              삭제 요청
                            </span>
                          )}
                          {hasTimeAdjust && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                              기한 조정 요청
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          {/* 담당자 아바타 */}
                          {task.assignee ? (
                            <span className="flex items-center gap-1">
                              <AssigneeAvatar user={task.assignee as any} size="xs" />
                              {task.assignee.name}
                            </span>
                          ) : (
                            <span>미배정</span>
                          )}
                          <span>·</span>
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            {task.dueDatetime
                              ? format(new Date(task.dueDatetime), 'MM-dd HH:00')
                              : (task.dueDate ?? '-')}
                            {isOverdue && ' (기한 초과)'}
                          </span>
                        </div>
                      </div>
                      <Badge value={task.status} colorMap={TASK_STATUS_BADGE} label={STATUS_KO[task.status]} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
