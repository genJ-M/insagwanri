'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FilePen, Plus, Check, X, Send, Trash2,
  ChevronRight, Clock, CheckCircle2, XCircle,
  User as UserIcon, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import RichTextEditor, { RichTextViewer } from '@/components/ui/RichTextEditor';

// ─── 타입 ────────────────────────────────────────────
type DocType = 'general' | 'vacation' | 'expense' | 'overtime' | 'business_trip' | 'hr';
type DocStatus = 'draft' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
type StepStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalStep {
  id: string;
  step: number;
  status: StepStatus;
  comment: string | null;
  actedAt: string | null;
  isMyTurn: boolean;
  approver: { id: string; name: string; position: string | null } | null;
}

interface ApprovalDoc {
  id: string;
  type: DocType;
  title: string;
  content: string;
  status: DocStatus;
  currentStep: number;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  isMyTurn: boolean;
  isAuthor: boolean;
  author: { id: string; name: string; department: string | null; position: string | null } | null;
  steps: ApprovalStep[];
}

// ─── 상수 ────────────────────────────────────────────
const TYPE_LABELS: Record<DocType, string> = {
  general: '일반', vacation: '휴가신청', expense: '지출결의',
  overtime: '연장근무', business_trip: '출장', hr: '인사발령',
};
const TYPE_COLORS: Record<DocType, string> = {
  general: 'bg-gray-100 text-gray-600',
  vacation: 'bg-blue-50 text-blue-700',
  expense: 'bg-green-50 text-green-700',
  overtime: 'bg-amber-50 text-amber-700',
  business_trip: 'bg-violet-50 text-violet-700',
  hr: 'bg-rose-50 text-rose-700',
};

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; Icon: any }> = {
  draft:       { label: '초안',    color: 'bg-gray-100 text-gray-500',         Icon: FilePen },
  in_progress: { label: '결재중',  color: 'bg-amber-50 text-amber-700',        Icon: Clock },
  approved:    { label: '승인완료',color: 'bg-emerald-50 text-emerald-700',     Icon: CheckCircle2 },
  rejected:    { label: '반려',    color: 'bg-red-50 text-red-600',            Icon: XCircle },
  cancelled:   { label: '취소됨',  color: 'bg-gray-100 text-gray-400',         Icon: X },
};

// ─── 결재선 설정 컴포넌트 ─────────────────────────────
function ApproverSelector({
  users, approvers, onChange,
}: {
  users: any[];
  approvers: { approver_id: string; step: number }[];
  onChange: (v: { approver_id: string; step: number }[]) => void;
}) {
  const addStep = () => {
    onChange([...approvers, { approver_id: '', step: approvers.length + 1 }]);
  };
  const removeStep = (idx: number) => {
    const next = approvers.filter((_, i) => i !== idx).map((a, i) => ({ ...a, step: i + 1 }));
    onChange(next);
  };
  const setApprover = (idx: number, id: string) => {
    const next = approvers.map((a, i) => i === idx ? { ...a, approver_id: id } : a);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {approvers.map((a, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-600 flex-shrink-0">
            {idx + 1}
          </div>
          <select
            value={a.approver_id}
            onChange={e => setApprover(idx, e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
          >
            <option value="">결재자 선택</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} {u.position ? `(${u.position})` : ''}</option>
            ))}
          </select>
          <button
            onClick={() => removeStep(idx)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addStep}
        className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-[12px] text-gray-400 hover:border-primary-300 hover:text-primary-500 flex items-center justify-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        결재자 추가
      </button>
    </div>
  );
}

// ─── 문서 작성 폼 ─────────────────────────────────────
function DocForm({
  users, editDoc, onClose, onSuccess,
}: {
  users: any[];
  editDoc?: ApprovalDoc;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<DocType>(editDoc?.type ?? 'general');
  const [title, setTitle] = useState(editDoc?.title ?? '');
  const [content, setContent] = useState(editDoc?.content ?? '');
  const [approvers, setApprovers] = useState<{ approver_id: string; step: number }[]>(
    editDoc?.steps?.map(s => ({ approver_id: s.approver?.id ?? '', step: s.step })) ?? [{ approver_id: '', step: 1 }],
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요.'); return; }
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) { toast.error('내용을 입력하세요.'); return; }
    if (approvers.some(a => !a.approver_id)) { toast.error('결재자를 모두 선택하세요.'); return; }

    setLoading(true);
    try {
      const body = { type, title, content, approvers };
      if (editDoc) {
        await api.patch(`/approvals/${editDoc.id}`, body);
      } else {
        await api.post('/approvals', body);
      }
      toast.success(editDoc ? '수정되었습니다.' : '기안이 저장되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900">{editDoc ? '문서 수정' : '결재 문서 기안'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">문서 유형</label>
              <select
                value={type} onChange={e => setType(e.target.value as DocType)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">제목</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="결재 문서 제목"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">내용</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="결재 요청 내용을 입력하세요."
              minHeight={160}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-2">결재선</label>
            <ApproverSelector users={users} approvers={approvers} onChange={setApprovers} />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 문서 상세 모달 ───────────────────────────────────
function DocDetail({
  doc, onClose, onAction,
}: {
  doc: ApprovalDoc;
  onClose: () => void;
  onAction: () => void;
}) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const act = async (action: 'approve' | 'reject') => {
    setActing(true);
    try {
      await api.patch(`/approvals/${doc.id}/${action}`, { comment: comment || undefined });
      toast.success(action === 'approve' ? '승인되었습니다.' : '반려되었습니다.');
      onAction();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '처리에 실패했습니다.');
    } finally {
      setActing(false);
    }
  };

  const stepStatusIcon = (s: StepStatus) => {
    if (s === 'approved') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (s === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-gray-300" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', TYPE_COLORS[doc.type])}>
              {TYPE_LABELS[doc.type]}
            </span>
            {(() => { const cfg = STATUS_CONFIG[doc.status]; return (
              <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.color)}>{cfg.label}</span>
            ); })()}
            {doc.isMyTurn && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-600 border border-primary-200 animate-pulse">
                내 결재 차례
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <h3 className="text-[18px] font-bold text-gray-900">{doc.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-gray-400">
              <span>기안자: <b className="text-gray-600">{doc.author?.name}</b></span>
              <span>{format(new Date(doc.createdAt), 'yyyy.MM.dd', { locale: ko })}</span>
              {doc.submittedAt && <span>상신: {format(new Date(doc.submittedAt), 'MM.dd HH:mm', { locale: ko })}</span>}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 min-h-[100px]">
            <RichTextViewer html={doc.content} className="text-[13px] text-gray-700" />
          </div>

          {/* 결재선 */}
          <div>
            <h4 className="text-[12px] font-semibold text-gray-500 mb-3">결재선</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {doc.steps.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={clsx(
                    'flex flex-col items-center px-4 py-3 rounded-xl border text-center min-w-[80px]',
                    s.status === 'approved' ? 'border-emerald-200 bg-emerald-50' :
                    s.status === 'rejected' ? 'border-red-200 bg-red-50' :
                    s.isMyTurn ? 'border-primary-300 bg-primary-50' :
                    'border-gray-200 bg-white',
                  )}>
                    <div className="flex items-center justify-center mb-1">{stepStatusIcon(s.status)}</div>
                    <p className="text-[12px] font-semibold text-gray-800">{s.approver?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400">{s.approver?.position ?? ''}</p>
                    {s.actedAt && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(s.actedAt), 'MM.dd', { locale: ko })}
                      </p>
                    )}
                    {s.comment && (
                      <p className="text-[10px] text-gray-500 mt-1 max-w-[100px] truncate">"{s.comment}"</p>
                    )}
                  </div>
                  {idx < doc.steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* 내 결재 차례 */}
          {doc.isMyTurn && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 space-y-3">
              <p className="text-[13px] font-semibold text-primary-700">결재 의견 (선택)</p>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="승인/반려 의견을 입력하세요."
                rows={2}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none bg-white resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => act('approve')} disabled={acting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />승인
                </button>
                <button
                  onClick={() => act('reject')} disabled={acting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />반려
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">닫기</button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [box, setBox] = useState<'all' | 'sent' | 'received'>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState<ApprovalDoc | undefined>();
  const [detailDoc, setDetailDoc] = useState<ApprovalDoc | undefined>();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['approvals'] });

  const { data: docs = [], isLoading } = useQuery<ApprovalDoc[]>({
    queryKey: ['approvals', box, statusFilter],
    queryFn: () =>
      api.get(`/approvals?box=${box}${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users?limit=200').then(r => r.data.data?.users ?? []),
    enabled: isAdmin,
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/approvals/${id}/submit`),
    onSuccess: () => { toast.success('상신되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '상신에 실패했습니다.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/approvals/${id}/cancel`),
    onSuccess: () => { toast.success('취소되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '취소에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/approvals/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const pendingCount = docs.filter(d => d.isMyTurn).length;

  const boxTabs = [
    { id: 'all', label: '전체' },
    { id: 'sent', label: '기안함' },
    { id: 'received', label: '수신함' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold text-gray-900">전자결재</h1>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-500 text-white">
                  {pendingCount}건 대기
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">결재 문서를 기안하고 결재선을 관리합니다.</p>
          </div>
          <button
            onClick={() => { setEditDoc(undefined); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
          >
            <Plus className="w-4 h-4" />
            문서 기안
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {boxTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setBox(t.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  box === t.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400"
          >
            <option value="">전체 상태</option>
            <option value="draft">초안</option>
            <option value="in_progress">결재중</option>
            <option value="approved">승인완료</option>
            <option value="rejected">반려</option>
            <option value="cancelled">취소됨</option>
          </select>
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-48" />
                    <div className="h-2.5 bg-gray-100 rounded w-64" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full w-14" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="py-16 text-center">
              <FilePen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">문서가 없습니다.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-[13px] text-primary-500 font-semibold hover:underline"
              >
                문서 기안하기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {docs.map(doc => {
                const cfg = STATUS_CONFIG[doc.status];
                return (
                  <div
                    key={doc.id}
                    className={clsx(
                      'px-5 py-4 hover:bg-gray-50 cursor-pointer',
                      doc.isMyTurn && 'bg-primary-50/30',
                    )}
                    onClick={() => setDetailDoc(doc)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold border', TYPE_COLORS[doc.type])}>
                            {TYPE_LABELS[doc.type]}
                          </span>
                          <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.color)}>
                            {cfg.label}
                          </span>
                          {doc.isMyTurn && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-600 border border-primary-200">
                              결재 대기
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] font-semibold text-gray-900 truncate">{doc.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[12px] text-gray-400">
                          <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{doc.author?.name}</span>
                          <span>{format(new Date(doc.createdAt), 'yyyy.MM.dd', { locale: ko })}</span>
                          <span className="text-gray-300">결재선 {doc.steps.length}단계</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {doc.isAuthor && doc.status === 'draft' && (
                          <>
                            <button
                              onClick={() => { setEditDoc(doc); setShowForm(true); }}
                              title="수정"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                            >
                              <FilePen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (window.confirm('상신하시겠습니까?')) submitMutation.mutate(doc.id); }}
                              title="상신"
                              className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(doc.id); }}
                              title="삭제"
                              className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {doc.isAuthor && doc.status === 'in_progress' && (
                          <button
                            onClick={() => { if (window.confirm('결재를 취소하시겠습니까?')) cancelMutation.mutate(doc.id); }}
                            title="취소"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <DocForm
          users={users}
          editDoc={editDoc}
          onClose={() => { setShowForm(false); setEditDoc(undefined); }}
          onSuccess={invalidate}
        />
      )}
      {detailDoc && (
        <DocDetail
          doc={detailDoc}
          onClose={() => setDetailDoc(undefined)}
          onAction={invalidate}
        />
      )}
    </div>
  );
}
