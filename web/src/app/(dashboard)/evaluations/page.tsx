'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  ClipboardCheck, Plus, ChevronRight, Star, Lock, Users,
  CheckCircle, Clock, AlertCircle, Eye, EyeOff,
} from 'lucide-react';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Cycle {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'closed';
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isAnonymous: boolean;
  resultVisibility: string;
  answerVisibility: string;
  includeSelf: boolean;
  includePeer: boolean;
  includeManager: boolean;
  progress: { total: number; submitted: number };
}

interface EvalItem {
  id: string;
  type: 'self' | 'peer' | 'manager';
  status: 'pending' | 'in_progress' | 'submitted';
  totalScore: number | null;
  submittedAt: string | null;
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  evaluatee: { id: string; name: string; department: string; position: string } | null;
  evaluator: { id: string | null; name: string } | null;
}

interface Answer {
  category: string;
  score: number | null;
  comment: string | null;
}

interface EvalDetail extends EvalItem {
  answers: Answer[];
  canSeeRawAnswers: boolean;
  canEdit: boolean;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:  { label: '준비중', color: 'bg-gray-100 text-gray-600' },
  active: { label: '진행중', color: 'bg-green-100 text-green-700' },
  closed: { label: '마감',   color: 'bg-blue-100 text-blue-700' },
};

const EVAL_STATUS: Record<string, { label: string; icon: JSX.Element }> = {
  pending:     { label: '미시작', icon: <Clock className="w-4 h-4 text-gray-400" /> },
  in_progress: { label: '작성중', icon: <AlertCircle className="w-4 h-4 text-amber-500" /> },
  submitted:   { label: '제출완료', icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
};

const TYPE_LABEL: Record<string, string> = {
  self: '자기평가', peer: '동료평가', manager: '상급자 평가',
};

const CATEGORY_LABELS: Record<string, string> = {
  performance:   '업무 성과',
  competency:    '직무 역량',
  collaboration: '협업/소통',
  growth:        '성장 가능성',
  leadership:    '리더십',
  comment:       '종합 의견',
};

const SCORE_CATEGORIES = ['performance', 'competency', 'collaboration', 'growth', 'leadership'];

// ─── 별점 컴포넌트 ───────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly }: {
  value: number | null;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-6 h-6 cursor-pointer transition-colors ${
            (value ?? 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
          } ${readonly ? 'cursor-default' : 'hover:text-amber-300 hover:fill-amber-300'}`}
          onClick={() => !readonly && onChange?.(n)}
        />
      ))}
      {value && <span className="text-sm text-gray-500 ml-1 self-center">{value}/5</span>}
    </div>
  );
}

// ─── 평가 작성 모달 ──────────────────────────────────────────────────────────

function EvalFormModal({ evalId, onClose }: { evalId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, { score?: number; comment?: string }>>({});

  const { data, isLoading } = useQuery<EvalDetail>({
    queryKey: ['eval-detail', evalId],
    queryFn: () => api.get(`/evaluations/${evalId}`).then(r => r.data.data),
    onSuccess: (d: EvalDetail) => {
      const init: typeof answers = {};
      d.answers.forEach(a => {
        init[a.category] = { score: a.score ?? undefined, comment: a.comment ?? undefined };
      });
      setAnswers(init);
    },
  } as any);

  const saveMut = useMutation({
    mutationFn: (payload: object) => api.post(`/evaluations/${evalId}/answers`, payload),
  });

  const submitMut = useMutation({
    mutationFn: () => api.post(`/evaluations/${evalId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-evaluations'] });
      onClose();
    },
  });

  const handleSave = () => {
    const payload = {
      answers: Object.entries(answers).map(([category, v]) => ({
        category, score: v.score, comment: v.comment,
      })),
    };
    saveMut.mutate(payload);
  };

  const handleSubmit = () => {
    handleSave();
    setTimeout(() => submitMut.mutate(), 300);
  };

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></div>
      </div>
    );
  }

  const isSubmitted = data.status === 'submitted';
  const readonly = isSubmitted || !data.canEdit;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {TYPE_LABEL[data.type]} — {data.evaluatee?.name}
            </h3>
            <p className="text-sm text-gray-500">{data.cycleName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* 점수 항목 */}
          {SCORE_CATEGORIES.map(cat => (
            <div key={cat}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {CATEGORY_LABELS[cat]}
              </label>
              <StarRating
                value={answers[cat]?.score ?? null}
                onChange={v => setAnswers(p => ({ ...p, [cat]: { ...p[cat], score: v } }))}
                readonly={readonly}
              />
            </div>
          ))}

          {/* 텍스트 의견 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {CATEGORY_LABELS['comment']}
            </label>
            {data.canSeeRawAnswers || !readonly ? (
              <textarea
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="종합적인 의견을 자유롭게 작성해주세요."
                value={answers['comment']?.comment ?? ''}
                onChange={e => setAnswers(p => ({ ...p, comment: { ...p['comment'], comment: e.target.value } }))}
                disabled={readonly}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400 border border-gray-100 rounded-lg p-3">
                <EyeOff className="w-4 h-4" />
                <span>원본 의견은 열람 권한이 없습니다.</span>
              </div>
            )}
          </div>
        </div>

        {!readonly && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              임시저장
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitMut.isPending}
              className="flex-1 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700"
            >
              최종 제출
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사이클 생성 모달 ────────────────────────────────────────────────────────

function CreateCycleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_anonymous: false,
    include_self: true,
    include_peer: false,
    include_manager: true,
    result_visibility: 'dept_manager',
    answer_visibility: 'managers_only',
  });
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => api.get('/users').then(r => r.data.data),
  });

  const mut = useMutation({
    mutationFn: (payload: object) => api.post('/evaluations/cycles', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-cycles'] });
      onClose();
    },
  });

  const toggle = (id: string) => {
    setParticipantIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">새 평가 사이클 생성</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사이클 이름 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 2026년 상반기 정기평가"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일 *</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>

          {/* 평가 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">평가 유형</label>
            <div className="flex gap-3">
              {[
                { key: 'include_self', label: '자기평가' },
                { key: 'include_peer', label: '동료평가' },
                { key: 'include_manager', label: '상급자 평가' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={(form as any)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 프라이버시 */}
          <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Lock className="w-4 h-4" /> 개인정보 보호 설정
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_anonymous}
                onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))} />
              평가자 익명 처리 (관리자만 식별 가능)
            </label>
            <div>
              <label className="block text-xs text-gray-500 mb-1">결과 열람 권한</label>
              <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                value={form.result_visibility}
                onChange={e => setForm(p => ({ ...p, result_visibility: e.target.value }))}>
                <option value="evaluatee_only">피평가자 + 관리자</option>
                <option value="dept_manager">피평가자 + 부서관리자 + 관리자</option>
                <option value="all_managers">모든 관리자</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">원본 답변 열람 권한</label>
              <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                value={form.answer_visibility}
                onChange={e => setForm(p => ({ ...p, answer_visibility: e.target.value }))}>
                <option value="none">집계 점수만 (원본 열람 불가)</option>
                <option value="managers_only">관리자만 원본 열람</option>
                <option value="evaluatee">피평가자도 원본 열람 가능</option>
              </select>
            </div>
          </div>

          {/* 대상자 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              평가 대상자 ({participantIds.length}명 선택)
            </label>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {(users ?? []).map((u: any) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                  <input type="checkbox" checked={participantIds.includes(u.id)}
                    onChange={() => toggle(u.id)} />
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-gray-400">{u.department} · {u.position}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={() => mut.mutate({ ...form, participant_ids: participantIds })}
            disabled={!form.name || !form.start_date || !form.end_date || participantIds.length === 0 || mut.isPending}
            className="flex-1 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            사이클 생성
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [tab, setTab] = useState<'cycles' | 'mine' | 'received'>('mine');
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: cycles, isLoading: cyclesLoading } = useQuery<Cycle[]>({
    queryKey: ['eval-cycles'],
    queryFn: () => api.get('/evaluations/cycles').then(r => r.data.data),
  });

  const { data: myEvals } = useQuery<EvalItem[]>({
    queryKey: ['my-evaluations', 'mine'],
    queryFn: () => api.get('/evaluations?box=mine').then(r => r.data.data),
    enabled: tab === 'mine',
  });

  const { data: receivedEvals } = useQuery<EvalItem[]>({
    queryKey: ['my-evaluations', 'received'],
    queryFn: () => api.get('/evaluations?box=received').then(r => r.data.data),
    enabled: tab === 'received',
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => api.post(`/evaluations/cycles/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eval-cycles'] }),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api.post(`/evaluations/cycles/${id}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eval-cycles'] }),
  });

  const tabs = [
    { key: 'mine' as const, label: '내가 평가' },
    { key: 'received' as const, label: '내 평가 결과' },
    ...(isAdmin ? [{ key: 'cycles' as const, label: '사이클 관리' }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-blue-600" />
            인사평가
          </h1>
          <p className="text-sm text-gray-500 mt-1">정기 평가 사이클을 관리하고 평가를 작성합니다.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            새 사이클
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 사이클 관리 */}
      {tab === 'cycles' && (
        <div className="space-y-3">
          {cyclesLoading ? (
            <div className="text-center py-12 text-gray-400">로딩 중...</div>
          ) : !cycles?.length ? (
            <div className="text-center py-12 text-gray-400">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>아직 평가 사이클이 없습니다.</p>
            </div>
          ) : cycles.map(cycle => {
            const prog = cycle.progress;
            const pct = prog.total > 0 ? Math.round((prog.submitted / prog.total) * 100) : 0;
            const s = STATUS_LABEL[cycle.status];
            return (
              <div key={cycle.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                      {cycle.isAnonymous && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> 익명
                        </span>
                      )}
                      {cycle.isPublished && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-600 flex items-center gap-1">
                          <Eye className="w-3 h-3" /> 결과 공개됨
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{cycle.startDate} ~ {cycle.endDate}</p>
                  </div>
                  <div className="flex gap-2">
                    {cycle.status === 'draft' && (
                      <button
                        onClick={() => activateMut.mutate(cycle.id)}
                        className="px-3 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                      >
                        활성화
                      </button>
                    )}
                    {(cycle.status === 'active' || cycle.status === 'closed') && !cycle.isPublished && (
                      <button
                        onClick={() => publishMut.mutate(cycle.id)}
                        className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                      >
                        결과 공개
                      </button>
                    )}
                  </div>
                </div>

                {/* 진행률 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{prog.submitted}/{prog.total} 제출 ({pct}%)</span>
                </div>

                {/* 평가 유형 태그 */}
                <div className="flex gap-2 mt-3">
                  {cycle.includeSelf && <span className="text-xs px-2 py-0.5 bg-gray-50 rounded text-gray-500">자기평가</span>}
                  {cycle.includePeer && <span className="text-xs px-2 py-0.5 bg-gray-50 rounded text-gray-500">동료평가</span>}
                  {cycle.includeManager && <span className="text-xs px-2 py-0.5 bg-gray-50 rounded text-gray-500">상급자 평가</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 내가 평가해야 하는 목록 */}
      {tab === 'mine' && (
        <div className="space-y-2">
          {!myEvals?.length ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>진행 중인 평가가 없습니다.</p>
            </div>
          ) : myEvals.map(ev => {
            const s = EVAL_STATUS[ev.status];
            return (
              <div
                key={ev.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-200"
                onClick={() => setSelectedEvalId(ev.id)}
              >
                <div className="flex items-center gap-3">
                  {s.icon}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ev.evaluatee?.name} <span className="text-gray-400">— {TYPE_LABEL[ev.type]}</span>
                    </p>
                    <p className="text-xs text-gray-400">{ev.cycleName} · {ev.evaluatee?.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ev.totalScore && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium">{ev.totalScore}</span>
                    </div>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    ev.status === 'submitted' ? 'bg-green-50 text-green-600'
                    : ev.status === 'in_progress' ? 'bg-amber-50 text-amber-600'
                    : 'bg-gray-50 text-gray-500'
                  }`}>{s.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 내가 받은 평가 결과 */}
      {tab === 'received' && (
        <div className="space-y-2">
          {!receivedEvals?.length ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>아직 받은 평가가 없습니다.</p>
            </div>
          ) : receivedEvals.map(ev => (
            <div
              key={ev.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{ev.cycleName}</p>
                <p className="text-xs text-gray-400">
                  {TYPE_LABEL[ev.type]} · {ev.evaluator?.name ?? '익명'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {ev.totalScore ? (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-semibold">{ev.totalScore}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> 미공개
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 모달 */}
      {selectedEvalId && (
        <EvalFormModal evalId={selectedEvalId} onClose={() => setSelectedEvalId(null)} />
      )}
      {showCreate && (
        <CreateCycleModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
