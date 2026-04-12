'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FilePen, Plus, Check, X, Send, Trash2,
  ChevronRight, Clock, CheckCircle2, XCircle,
  User as UserIcon, AlertCircle, LayoutTemplate,
  Pencil, Tag, Search, Link2, ChevronDown, ChevronUp,
  Printer, ShieldCheck, Lock,
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
  id: string; step: number; status: StepStatus;
  comment: string | null; actedAt: string | null;
  isMyTurn: boolean;
  approver: { id: string; name: string; position: string | null } | null;
}

interface ApprovalDoc {
  id: string; type: DocType; title: string; content: string;
  status: DocStatus; currentStep: number;
  submittedAt: string | null; completedAt: string | null; createdAt: string;
  isMyTurn: boolean; isAuthor: boolean;
  relatedTaskIds: string[];
  templateId: string | null;
  author: { id: string; name: string; department: string | null; position: string | null } | null;
  steps: ApprovalStep[];
  // 봉인 정보
  isSealed?: boolean;
  sealedAt?: string | null;
  retainUntil?: string | null;
  sealHash?: string | null;
}

interface TemplatePlaceholder {
  key: string; label: string; type: string;
  options?: string[]; defaultValue?: string; required: boolean;
}

interface ApprovalTemplate {
  id: string; category: string; categoryLabel: string;
  title: string; docType: string; description: string;
  body: string; placeholders: TemplatePlaceholder[];
}

interface TaskItem { id: string; title: string; status: string; assignee?: { name: string } | null }

// ─── 인쇄 헬퍼 ───────────────────────────────────────
// window.open() 은 Authorization 헤더를 보내지 못하므로
// api axios 인스턴스로 HTML을 가져온 뒤 Blob URL로 새 창을 엽니다.
async function openPrintWindow(docId: string) {
  try {
    const res = await api.get(`/approvals/${docId}/print`, { responseType: 'text' });
    const blob = new Blob([res.data], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    // 새 창이 로드된 후 URL 해제 (메모리 누수 방지)
    if (w) {
      w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    } else {
      // 팝업 차단 시 즉시 해제
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch {
    toast.error('인쇄용 문서를 불러오는 데 실패했습니다.');
  }
}

// ─── 상수 ────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  general: '일반', vacation: '휴가신청', expense: '지출결의',
  overtime: '연장근무', business_trip: '출장', hr: '인사',
};
const TYPE_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-600 border-gray-200',
  vacation: 'bg-blue-50 text-blue-700 border-blue-200',
  expense: 'bg-green-50 text-green-700 border-green-200',
  overtime: 'bg-amber-50 text-amber-700 border-amber-200',
  business_trip: 'bg-violet-50 text-violet-700 border-violet-200',
  hr: 'bg-rose-50 text-rose-700 border-rose-200',
};
const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; Icon: any }> = {
  draft:       { label: '초안',    color: 'bg-gray-100 text-gray-500',      Icon: FilePen },
  in_progress: { label: '결재중',  color: 'bg-amber-50 text-amber-700',     Icon: Clock },
  approved:    { label: '승인완료',color: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  rejected:    { label: '반려',    color: 'bg-red-50 text-red-600',         Icon: XCircle },
  cancelled:   { label: '취소됨',  color: 'bg-gray-100 text-gray-400',      Icon: X },
};
const CATEGORY_COLORS: Record<string, string> = {
  purchase: 'bg-green-50 text-green-700 border-green-200',
  hr:       'bg-rose-50 text-rose-700 border-rose-200',
  work:     'bg-blue-50 text-blue-700 border-blue-200',
  planning: 'bg-violet-50 text-violet-700 border-violet-200',
  general:  'bg-gray-100 text-gray-600 border-gray-200',
};

// ─── 헬퍼: 플레이스홀더 치환 ──────────────────────────
function applyPlaceholders(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key];
    return v && v.trim() ? v : `<mark style="background:#fef3c7;border-radius:3px;padding:1px 4px;font-size:12px">{{${key}}}</mark>`;
  });
}

// ─── 결재자 선택 ─────────────────────────────────────
function ApproverSelector({ users, approvers, onChange }: {
  users: any[];
  approvers: { approver_id: string; step: number }[];
  onChange: (v: { approver_id: string; step: number }[]) => void;
}) {
  const add = () => onChange([...approvers, { approver_id: '', step: approvers.length + 1 }]);
  const remove = (idx: number) =>
    onChange(approvers.filter((_, i) => i !== idx).map((a, i) => ({ ...a, step: i + 1 })));
  const set = (idx: number, id: string) =>
    onChange(approvers.map((a, i) => i === idx ? { ...a, approver_id: id } : a));

  return (
    <div className="space-y-2">
      {approvers.map((a, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-600 flex-shrink-0">
            {idx + 1}
          </div>
          <select
            value={a.approver_id} onChange={e => set(idx, e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
          >
            <option value="">결재자 선택</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}{u.position ? ` (${u.position})` : ''}</option>
            ))}
          </select>
          <button onClick={() => remove(idx)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-[12px] text-gray-400 hover:border-primary-300 hover:text-primary-500 flex items-center justify-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />결재자 추가
      </button>
    </div>
  );
}

// ─── 업무 태그 선택 ──────────────────────────────────
function TaskTagger({ taskIds, onChange }: {
  taskIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: searchResult = [] } = useQuery<TaskItem[]>({
    queryKey: ['tasks-search', search],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { search, limit: 10 } });
      return data.data?.tasks ?? data.data ?? [];
    },
    enabled: search.length >= 1,
  });

  const { data: taggedTasks = [] } = useQuery<TaskItem[]>({
    queryKey: ['tasks-by-ids', taskIds],
    queryFn: async () => {
      if (!taskIds.length) return [];
      const results = await Promise.all(
        taskIds.map(id => api.get(`/tasks/${id}`).then(r => r.data.data).catch(() => null))
      );
      return results.filter(Boolean) as TaskItem[];
    },
    enabled: taskIds.length > 0,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    onChange(taskIds.includes(id) ? taskIds.filter(x => x !== id) : [...taskIds, id]);
  };

  const TASK_STATUS_KO: Record<string, string> = {
    todo: '할 일', in_progress: '진행중', done: '완료', cancelled: '취소',
  };

  return (
    <div ref={ref} className="relative">
      {/* 태그된 업무 표시 */}
      {taskIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {taggedTasks.map(t => (
            <span key={t.id} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-full text-[12px] text-primary-700 font-medium">
              <Link2 className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{t.title}</span>
              <button onClick={() => toggle(t.id)} className="hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* 검색 input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="업무 검색하여 태그..."
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-primary-400"
        />
      </div>
      {/* 드롭다운 */}
      {open && search.length >= 1 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {searchResult.length === 0 ? (
            <p className="text-[12px] text-gray-400 p-3 text-center">검색 결과 없음</p>
          ) : (
            searchResult.map(t => {
              const tagged = taskIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => { toggle(t.id); setSearch(''); setOpen(false); }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors',
                    tagged && 'bg-primary-50',
                  )}
                >
                  <div className={clsx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                    tagged ? 'bg-primary-500 border-primary-500' : 'border-gray-300')}>
                    {tagged && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-[11px] text-gray-400">{TASK_STATUS_KO[t.status] ?? t.status}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── 템플릿 선택 모달 ─────────────────────────────────
function TemplatePicker({ onSelect, onClose }: {
  onSelect: (template: ApprovalTemplate | null) => void;
  onClose: () => void;
}) {
  const [catFilter, setCatFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['approval-templates'],
    queryFn: async () => {
      const { data } = await api.get('/approvals/templates');
      return data.data as { templates: ApprovalTemplate[]; categories: { id: string; label: string }[] };
    },
    staleTime: Infinity,
  });

  const templates = data?.templates ?? [];
  const categories = data?.categories ?? [{ id: 'all', label: '전체' }];
  const filtered = catFilter === 'all' ? templates : templates.filter(t => t.category === catFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">결재 양식 선택</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">템플릿을 선택하거나 처음부터 작성하세요.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* 카테고리 필터 */}
        <div className="px-6 pt-4 flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors',
                catFilter === c.id
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 템플릿 그리드 */}
        <div className="px-6 py-4">
          {/* 자유 양식 카드 */}
          <button
            onClick={() => onSelect(null)}
            className="w-full flex items-center gap-4 p-4 mb-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Pencil className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">처음부터 작성</p>
              <p className="text-[12px] text-gray-500 mt-0.5">템플릿 없이 자유 형식으로 작성합니다.</p>
            </div>
          </button>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {filtered.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => onSelect(tpl)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-sm hover:bg-primary-50/30 transition-all text-left"
                >
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border text-[11px] font-bold', CATEGORY_COLORS[tpl.category])}>
                    {tpl.categoryLabel.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 leading-snug">{tpl.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                    <span className={clsx('inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border', CATEGORY_COLORS[tpl.category])}>
                      {tpl.categoryLabel}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 문서 작성 폼 ─────────────────────────────────────
function DocForm({ users, template, editDoc, onClose, onSuccess }: {
  users: any[];
  template: ApprovalTemplate | null;
  editDoc?: ApprovalDoc;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<string>(
    editDoc?.type ?? template?.docType ?? 'general',
  );
  const [title, setTitle] = useState(editDoc?.title ?? template?.title ?? '');
  const [content, setContent] = useState(editDoc?.content ?? '');
  const [approvers, setApprovers] = useState<{ approver_id: string; step: number }[]>(
    editDoc?.steps?.map(s => ({ approver_id: s.approver?.id ?? '', step: s.step }))
    ?? [{ approver_id: '', step: 1 }],
  );
  const [taskIds, setTaskIds] = useState<string[]>(editDoc?.relatedTaskIds ?? []);
  const [loading, setLoading] = useState(false);

  // 플레이스홀더 값 (구조 모드용)
  const [phValues, setPhValues] = useState<Record<string, string>>(() => {
    if (!template) return {};
    return Object.fromEntries(template.placeholders.map(p => [p.key, p.defaultValue ?? '']));
  });

  // 편집 모드: structured(구조) vs full(전체편집)
  const [editMode, setEditMode] = useState<'structured' | 'full'>(
    template ? 'structured' : 'full',
  );

  // 전체 편집으로 전환 시 현재 렌더링된 content를 editor에 로드
  const handleSwitchToFull = () => {
    if (editMode === 'structured' && template) {
      const rendered = applyPlaceholders(template.body, phValues).replace(
        /<mark[^>]*>.*?<\/mark>/g, '' // 미입력 placeholder 제거(빈 문자열로)
      );
      setContent(rendered);
    }
    setEditMode('full');
  };

  // 구조 모드로 돌아갈 때 경고
  const handleSwitchToStructured = () => {
    if (!window.confirm('구조 편집 모드로 돌아가면 전체 편집 내용이 초기화됩니다. 계속하시겠습니까?')) return;
    setPhValues(Object.fromEntries(template!.placeholders.map(p => [p.key, p.defaultValue ?? ''])));
    setEditMode('structured');
  };

  // 최종 content 추출
  const getFinalContent = (): string => {
    if (editMode === 'full') return content;
    if (!template) return content;
    // 플레이스홀더 값이 채워진 HTML 반환 (mark 태그 없이)
    return template.body.replace(/\{\{(\w+)\}\}/g, (_, key) => phValues[key] ?? '');
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('제목을 입력하세요.'); return; }
    const finalContent = getFinalContent();
    const textContent = finalContent.replace(/<[^>]*>/g, '').trim();
    if (!textContent) { toast.error('내용을 입력하세요.'); return; }
    if (approvers.some(a => !a.approver_id)) { toast.error('결재자를 모두 선택하세요.'); return; }

    // 구조 모드: 필수 placeholder 체크
    if (editMode === 'structured' && template) {
      const missingRequired = template.placeholders
        .filter(p => p.required && !phValues[p.key]?.trim());
      if (missingRequired.length > 0) {
        toast.error(`필수 항목을 입력하세요: ${missingRequired.map(p => p.label).join(', ')}`);
        return;
      }
    }

    setLoading(true);
    try {
      const body = {
        type,
        title,
        content: finalContent,
        approvers,
        related_task_ids: taskIds,
        template_id: template?.id ?? undefined,
      };
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

  const setPh = (key: string, val: string) => setPhValues(prev => ({ ...prev, [key]: val }));

  // 구조 모드 미리보기 HTML
  const previewHtml = template ? applyPlaceholders(template.body, phValues) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-gray-900">
              {editDoc ? '문서 수정' : '결재 문서 기안'}
            </h2>
            {template && (
              <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold border', CATEGORY_COLORS[template.category])}>
                {template.title}
              </span>
            )}
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">문서 유형</label>
              <select
                value={type} onChange={e => setType(e.target.value)}
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

          {/* ── 내용 영역 ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[12px] font-semibold text-gray-500">내용</label>
              {template && (
                <div className="flex items-center gap-2">
                  {editMode === 'structured' ? (
                    <button
                      onClick={handleSwitchToFull}
                      className="flex items-center gap-1 text-[12px] text-primary-600 hover:text-primary-700 font-medium border border-primary-200 rounded-lg px-2.5 py-1 hover:bg-primary-50"
                    >
                      <Pencil className="w-3 h-3" />전체 편집
                    </button>
                  ) : template && (
                    <button
                      onClick={handleSwitchToStructured}
                      className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 font-medium border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
                    >
                      <LayoutTemplate className="w-3 h-3" />양식으로 돌아가기
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 구조 편집 모드 */}
            {editMode === 'structured' && template && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 미리보기 */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] text-gray-500">미입력 항목은 <mark style={{ background: '#fef3c7', borderRadius: 3, padding: '0 4px', fontSize: 11 }}>노란색</mark>으로 표시됩니다.</span>
                </div>
                <div
                  className="p-4 prose prose-sm max-w-none overflow-x-auto"
                  style={{ fontSize: 13 }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />

                {/* 플레이스홀더 입력 */}
                <div className="border-t border-gray-100 bg-white p-4 space-y-3">
                  <p className="text-[12px] font-semibold text-gray-500 mb-3">항목 입력</p>
                  {template.placeholders.map(ph => (
                    <div key={ph.key}>
                      <label className="block text-[12px] font-semibold text-gray-600 mb-1">
                        {ph.label}
                        {ph.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {ph.type === 'select' ? (
                        <select
                          value={phValues[ph.key] ?? ''}
                          onChange={e => setPh(ph.key, e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
                        >
                          <option value="">선택하세요</option>
                          {ph.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : ph.type === 'textarea' ? (
                        <textarea
                          value={phValues[ph.key] ?? ''}
                          onChange={e => setPh(ph.key, e.target.value)}
                          rows={2}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400 resize-none"
                        />
                      ) : (
                        <input
                          type={ph.type === 'date' ? 'date' : ph.type === 'number' ? 'number' : 'text'}
                          value={phValues[ph.key] ?? ''}
                          onChange={e => setPh(ph.key, e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-primary-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 편집 모드 */}
            {editMode === 'full' && (
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="결재 요청 내용을 입력하세요."
                minHeight={200}
              />
            )}
          </div>

          {/* ── 업무 태그 ── */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 mb-2">
              <Tag className="w-3.5 h-3.5" />관련 업무 태그 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <TaskTagger taskIds={taskIds} onChange={setTaskIds} />
          </div>

          {/* ── 결재선 ── */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-2">결재선</label>
            <ApproverSelector users={users} approvers={approvers} onChange={setApprovers} />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
            취소
          </button>
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
function DocDetail({ doc, onClose, onAction }: {
  doc: ApprovalDoc; onClose: () => void; onAction: () => void;
}) {
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  // 태그된 업무 조회
  const { data: relatedTasks = [] } = useQuery<TaskItem[]>({
    queryKey: ['tasks-by-ids', doc.relatedTaskIds],
    queryFn: async () => {
      if (!doc.relatedTaskIds?.length) return [];
      const results = await Promise.all(
        doc.relatedTaskIds.map(id => api.get(`/tasks/${id}`).then(r => r.data.data).catch(() => null))
      );
      return results.filter(Boolean) as TaskItem[];
    },
    enabled: (doc.relatedTaskIds?.length ?? 0) > 0,
  });

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
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold border', TYPE_COLORS[doc.type] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
              {TYPE_LABELS[doc.type] ?? doc.type}
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
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <h3 className="text-[18px] font-bold text-gray-900">{doc.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-gray-400 flex-wrap">
              <span>기안자: <b className="text-gray-600">{doc.author?.name}</b></span>
              <span>{format(new Date(doc.createdAt), 'yyyy.MM.dd', { locale: ko })}</span>
              {doc.submittedAt && <span>상신: {format(new Date(doc.submittedAt), 'MM.dd HH:mm', { locale: ko })}</span>}
            </div>
          </div>

          {/* 관련 업무 태그 */}
          {relatedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowTasks(v => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700 mb-2"
              >
                <Tag className="w-3.5 h-3.5" />관련 업무 {relatedTasks.length}건
                {showTasks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showTasks && (
                <div className="flex flex-wrap gap-1.5">
                  {relatedTasks.map(t => (
                    <span key={t.id} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-full text-[12px] text-primary-700 font-medium">
                      <Link2 className="w-3 h-3" />{t.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* 봉인 정보 */}
          {doc.isSealed && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span className="text-[13px] font-semibold text-emerald-800">전자 결재 봉인 완료</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-1 text-[11px] text-emerald-700">
                <p>봉인일시: {doc.sealedAt ? format(new Date(doc.sealedAt), 'yyyy.MM.dd HH:mm', { locale: ko }) : '-'}</p>
                <p>법정보존기한: {doc.retainUntil ? format(new Date(doc.retainUntil), 'yyyy.MM.dd', { locale: ko }) : '-'} (5년)</p>
                <p className="font-mono break-all text-[10px] text-emerald-600">
                  봉인해시: {doc.sealHash ? `${doc.sealHash.slice(0, 20)}…${doc.sealHash.slice(-8)}` : '-'}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openPrintWindow(doc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
                >
                  <Printer className="w-3.5 h-3.5" />인쇄 / PDF 저장
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await api.get(`/approvals/${doc.id}/verify`);
                      const v = res.data.data ?? res.data;
                      if (v.valid) toast.success(`✓ 무결성 확인 완료 — ${v.details}`);
                      else toast.error(`⚠ ${v.details}`);
                    } catch { toast.error('검증에 실패했습니다.'); }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-[12px] font-semibold hover:bg-emerald-100"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />무결성 검증
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
            닫기
          </button>
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

  // 모달 상태
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalTemplate | null | undefined>(undefined);
  // undefined = 안 고름, null = 자유 작성, ApprovalTemplate = 선택됨
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

  // 새 기안: 템플릿 선택 → 폼
  const handleNewDoc = () => {
    setEditDoc(undefined);
    setSelectedTemplate(undefined);
    setShowTemplatePicker(true);
  };

  const handleTemplateSelect = (tpl: ApprovalTemplate | null) => {
    setSelectedTemplate(tpl);
    setShowTemplatePicker(false);
    setShowForm(true);
  };

  const handleEditDoc = (doc: ApprovalDoc) => {
    setEditDoc(doc);
    setSelectedTemplate(null); // 수정 시 자유 편집 모드
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditDoc(undefined);
    setSelectedTemplate(undefined);
  };

  const boxTabs = [
    { id: 'all',      label: '전체' },
    { id: 'sent',     label: '기안함' },
    { id: 'received', label: '수신함' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="flex items-start justify-between gap-3">
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
            onClick={handleNewDoc}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-4 h-4" />문서 기안
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {boxTabs.map(t => (
              <button key={t.id} onClick={() => setBox(t.id)}
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
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
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
                onClick={handleNewDoc}
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
                          <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold border', TYPE_COLORS[doc.type] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                            {TYPE_LABELS[doc.type] ?? doc.type}
                          </span>
                          <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.color)}>
                            {cfg.label}
                          </span>
                          {doc.isMyTurn && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-600 border border-primary-200">
                              결재 대기
                            </span>
                          )}
                          {doc.isSealed && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Lock className="w-2.5 h-2.5" />봉인
                            </span>
                          )}
                          {(doc.relatedTaskIds?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
                              <Link2 className="w-2.5 h-2.5" />업무 {doc.relatedTaskIds.length}
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] font-semibold text-gray-900 truncate">{doc.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[12px] text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{doc.author?.name}</span>
                          <span>{format(new Date(doc.createdAt), 'yyyy.MM.dd', { locale: ko })}</span>
                          <span className="text-gray-300">결재선 {doc.steps.length}단계</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {doc.isAuthor && doc.status === 'draft' && (
                          <>
                            <button onClick={() => handleEditDoc(doc)} title="수정"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                              <FilePen className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (window.confirm('상신하시겠습니까?')) submitMutation.mutate(doc.id); }}
                              title="상신" className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50">
                              <Send className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(doc.id); }}
                              title="삭제" className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {doc.isAuthor && doc.status === 'in_progress' && (
                          <button onClick={() => { if (window.confirm('결재를 취소하시겠습니까?')) cancelMutation.mutate(doc.id); }}
                            title="취소" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {doc.isSealed && (
                          <button
                            onClick={() => openPrintWindow(doc.id)}
                            title="인쇄 / PDF 저장"
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* 템플릿 선택 모달 */}
      {showTemplatePicker && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* 문서 작성 폼 */}
      {showForm && selectedTemplate !== undefined && (
        <DocForm
          users={users}
          template={selectedTemplate}
          editDoc={editDoc}
          onClose={handleCloseForm}
          onSuccess={() => { invalidate(); handleCloseForm(); }}
        />
      )}

      {/* 문서 상세 */}
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
