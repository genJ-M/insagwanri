'use client';

import RichTextEditor, { RichTextViewer } from '@/components/ui/RichTextEditor';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, Plus, X, Users, CheckCircle2, Clock,
  CalendarDays, ChevronRight, BookOpen, Tag,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ── 타입 ──────────────────────────────────────────────
type TrainingStatus = 'planned' | 'ongoing' | 'completed' | 'canceled';
type EnrollmentStatus = 'enrolled' | 'completed' | 'dropped';

interface Training {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  targetDepartment: string | null;
  startDate: string | null;
  endDate: string | null;
  maxParticipants: number | null;
  status: TrainingStatus;
  enrollmentCount: number;
  createdAt: string;
}

interface MyTraining {
  id: string;
  trainingId: string;
  training: Training;
  status: EnrollmentStatus;
  completedAt: string | null;
  note: string | null;
}

// ── 상태 설정 ─────────────────────────────────────────
const STATUS_MAP: Record<TrainingStatus, { label: string; cls: string }> = {
  planned:   { label: '예정',   cls: 'bg-blue-50 text-blue-700' },
  ongoing:   { label: '진행 중', cls: 'bg-green-50 text-green-700' },
  completed: { label: '완료',   cls: 'bg-gray-100 text-gray-600' },
  canceled:  { label: '취소',   cls: 'bg-red-50 text-red-600' },
};

const ENROLL_STATUS_MAP: Record<EnrollmentStatus, { label: string; cls: string }> = {
  enrolled:  { label: '수강 중',  cls: 'bg-blue-50 text-blue-700' },
  completed: { label: '수료',    cls: 'bg-green-50 text-green-700' },
  dropped:   { label: '중도포기', cls: 'bg-gray-100 text-gray-500' },
};

const CATEGORIES = ['안전보건', '직무역량', '법정의무', '리더십', '소통·협업', '기타'];

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function TrainingPage() {
  const { user } = useAuthStore();
  const isAdmin = user && ['owner', 'manager'].includes(user.role);
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [showForm, setShowForm] = useState(false);
  const [enrollModal, setEnrollModal] = useState<Training | null>(null);
  const queryClient = useQueryClient();

  // ── 쿼리 ────────────────────────────────────────────
  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['trainings'],
    queryFn: async () => (await api.get('/training')).data.data as Training[],
  });

  const { data: myTrainings = [] } = useQuery({
    queryKey: ['my-trainings'],
    queryFn: async () => (await api.get('/training/my')).data.data as MyTraining[],
    enabled: tab === 'my',
  });

  // ── 뮤테이션 ─────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/training/${id}`),
    onSuccess: () => {
      toast.success('교육이 취소되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '취소에 실패했습니다.'),
  });

  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary-500" />
          <h1 className="text-xl font-bold text-text-primary">교육 관리</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" />교육 등록
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'all' as const, label: '전체 교육' },
          { key: 'my' as const, label: '내 수강 현황' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 전체 교육 탭 */}
      {tab === 'all' && (
        isLoading ? (
          <p className="text-center text-gray-400 py-12">불러오는 중...</p>
        ) : trainings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 교육이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trainings.map((t) => (
              <TrainingCard
                key={t.id}
                training={t}
                isAdmin={!!isAdmin}
                onEnroll={() => setEnrollModal(t)}
                onCancel={() => {
                  if (confirm(`"${t.title}" 교육을 취소하시겠습니까?`)) cancelMutation.mutate(t.id);
                }}
              />
            ))}
          </div>
        )
      )}

      {/* 내 수강 현황 탭 */}
      {tab === 'my' && (
        myTrainings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">수강 중인 교육이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myTrainings.map((e) => {
              const s = ENROLL_STATUS_MAP[e.status];
              return (
                <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{e.training?.title ?? '교육'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {e.training?.category && <span className="flex items-center gap-0.5"><Tag className="w-3 h-3" />{e.training.category}</span>}
                      {e.completedAt && <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3 text-green-500" />수료일: {format(new Date(e.completedAt), 'yyyy.MM.dd')}</span>}
                    </div>
                    {e.note && <p className="text-xs text-gray-400 mt-1">{e.note}</p>}
                  </div>
                  <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', s.cls)}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 교육 등록 폼 */}
      {showForm && <TrainingForm onClose={() => setShowForm(false)} />}

      {/* 수강 신청 모달 (관리자) */}
      {enrollModal && (
        <EnrollModal training={enrollModal} onClose={() => setEnrollModal(null)} />
      )}
    </div>
  );
}

// ── 교육 카드 ──────────────────────────────────────────
function TrainingCard({
  training: t, isAdmin, onEnroll, onCancel,
}: { training: Training; isAdmin: boolean; onEnroll: () => void; onCancel: () => void }) {
  const s = STATUS_MAP[t.status];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-snug">{t.title}</p>
        <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap', s.cls)}>{s.label}</span>
      </div>
      {t.description && <RichTextViewer html={t.description} className="text-sm text-gray-500 line-clamp-2" />}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {t.category && (
          <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{t.category}</span>
        )}
        {(t.startDate || t.endDate) && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {t.startDate ? format(new Date(t.startDate), 'M/d', { locale: ko }) : '?'}
            {' ~ '}
            {t.endDate ? format(new Date(t.endDate), 'M/d', { locale: ko }) : '미정'}
          </span>
        )}
        {t.targetDepartment && (
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.targetDepartment}</span>
        )}
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />수강 {t.enrollmentCount}명
          {t.maxParticipants ? ` / 최대 ${t.maxParticipants}명` : ''}
        </span>
      </div>
      {isAdmin && t.status !== 'canceled' && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={onEnroll}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            <ChevronRight className="w-3.5 h-3.5" />수강 등록
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium ml-auto"
          >
            <X className="w-3.5 h-3.5" />취소
          </button>
        </div>
      )}
    </div>
  );
}

// ── 교육 등록 폼 모달 ──────────────────────────────────
function TrainingForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', category: '', targetDepartment: '',
    startDate: '', endDate: '', maxParticipants: '',
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/training', {
      title: form.title,
      description: form.description || undefined,
      category: form.category || undefined,
      targetDepartment: form.targetDepartment || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
    }),
    onSuccess: () => {
      toast.success('교육이 등록되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '등록에 실패했습니다.'),
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">교육 등록</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">교육명 *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="교육명을 입력하세요" maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">카테고리</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">선택 안함</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => set('description', html)}
              placeholder="교육 내용을 입력하세요"
              minHeight={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">시작일</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">종료일</label>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 부서</label>
              <input value={form.targetDepartment} onChange={(e) => set('targetDepartment', e.target.value)}
                placeholder="미입력 시 전체"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">최대 인원</label>
              <input type="number" min="1" value={form.maxParticipants} onChange={(e) => set('maxParticipants', e.target.value)}
                placeholder="제한 없음"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">
            취소
          </button>
          <button onClick={() => { if (!form.title.trim()) { toast.error('교육명을 입력해 주세요.'); return; } mutation.mutate(); }}
            disabled={mutation.isPending}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 수강 등록 모달 (관리자) ────────────────────────────
function EnrollModal({ training, onClose }: { training: Training; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [userIdsText, setUserIdsText] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-simple'],
    queryFn: async () => (await api.get('/users')).data.data as Array<{ id: string; name: string; department: string | null }>,
  });

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/training/${training.id}/enroll`, { userIds: selected }),
    onSuccess: () => {
      toast.success(`${selected.length}명을 수강 등록했습니다.`);
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '수강 등록에 실패했습니다.'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">수강 등록</h3>
            <p className="text-xs text-gray-500 mt-0.5">{training.title}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} className="accent-primary-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                {emp.department && <p className="text-xs text-gray-400">{emp.department}</p>}
              </div>
            </label>
          ))}
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">취소</button>
          <button
            onClick={() => { if (!selected.length) { toast.error('직원을 선택해 주세요.'); return; } mutation.mutate(); }}
            disabled={mutation.isPending || !selected.length}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? '등록 중...' : `${selected.length}명 등록`}
          </button>
        </div>
      </div>
    </div>
  );
}
