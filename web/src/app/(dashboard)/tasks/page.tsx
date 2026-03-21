'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast, parseISO } from 'date-fns';
import { Plus, Search, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge, { TASK_STATUS_BADGE, TASK_PRIORITY_BADGE } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { Task, TaskStatus } from '@/types';
import { clsx } from 'clsx';

const STATUS_TABS = [
  { value: '', label: '전체' },
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

// ─── 업무 생성 모달 ───────────────────────────────────────────────────────────
function CreateTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'normal', due_date: '', assignee_id: '',
  });

  const { data: members } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return (data.data ?? data) as { id: string; name: string; department: string }[];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/tasks', payload),
    onSuccess: () => {
      toast.success('업무가 생성되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
      setForm({ title: '', description: '', priority: 'normal', due_date: '', assignee_id: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '업무 생성에 실패했습니다.');
    },
  });

  const handleSubmit = () => {
    const payload: any = {
      title: form.title,
      description: form.description || undefined,
      priority: form.priority,
      due_date: form.due_date || undefined,
      assignee_id: form.assignee_id || undefined,
    };
    mutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="업무 생성">
      <div className="space-y-4">
        <div>
          <label className="label">업무 제목 *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="업무 제목을 입력하세요"
            className="input"
          />
        </div>
        <div>
          <label className="label">내용</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="업무 내용을 입력하세요"
            className="input resize-none"
          />
        </div>
        <div>
          <label className="label">담당자</label>
          <select
            value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            className="input"
          >
            <option value="">미배정</option>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.department ? ` (${m.department})` : ''}
              </option>
            ))}
          </select>
          {members?.length === 0 && (
            <p className="text-xs text-text-muted mt-1">팀원이 없습니다. 먼저 팀원을 초대해주세요.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="label">마감일</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            loading={mutation.isPending}
            disabled={!form.title.trim()}
            onClick={handleSubmit}
          >
            생성
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 업무 상세 모달 ───────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.patch(`/tasks/${task.id}`, { status }),
    onSuccess: () => {
      toast.success('상태가 변경되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '상태 변경에 실패했습니다.');
    },
  });

  const isOverdue = task.dueDate && task.status !== 'done' && task.status !== 'cancelled'
    && isPast(parseISO(task.dueDate));

  const nextStatuses: TaskStatus[] = (() => {
    const all: TaskStatus[] = ['pending', 'in_progress', 'review', 'done'];
    return all.filter((s) => s !== task.status);
  })();

  return (
    <Modal open onClose={onClose} title="업무 상세" size="md">
      <div className="space-y-4">
        {/* 제목 + 우선순위 */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-base font-semibold text-text-primary flex-1">{task.title}</h3>
            <Badge value={task.priority} colorMap={TASK_PRIORITY_BADGE} label={PRIORITY_KO[task.priority]} />
          </div>
          {task.description && (
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{task.description}</p>
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
            <p className="font-medium text-text-primary">{task.assignee?.name ?? '미배정'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">마감일</p>
            <p className={isOverdue ? 'font-medium text-red-600 flex items-center gap-1' : 'font-medium text-text-primary'}>
              {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
              {task.dueDate ?? '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">생성자</p>
            <p className="font-medium text-text-primary">{task.creator?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">생성일</p>
            <p className="font-medium text-text-primary">{task.createdAt ? format(new Date(task.createdAt), 'yyyy-MM-dd') : '-'}</p>
          </div>
        </div>

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

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function TasksPage() {
  usePageTitle('업무 관리');
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', activeTab],
    queryFn: async () => {
      const { data } = await api.get('/tasks', {
        params: { status: activeTab || undefined, limit: 30 },
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
      <Header title="업무 관리" />

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
              <Plus className="h-4 w-4" />
              업무 생성
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
                const isOverdue = task.dueDate && task.status !== 'done' && task.status !== 'cancelled'
                  && task.dueDate < today;
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-background transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                          <Badge value={task.priority} colorMap={TASK_PRIORITY_BADGE} label={PRIORITY_KO[task.priority]} />
                        </div>
                        <p className="text-xs text-text-muted">
                          담당: {task.assignee?.name ?? '미배정'} ·{' '}
                          마감:{' '}
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            {task.dueDate ?? '-'}
                            {isOverdue && ' (기한 초과)'}
                          </span>
                        </p>
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
