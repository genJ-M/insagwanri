'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Plus, X, Search, Lock, Pencil, Trash2,
  ChevronLeft, MessageSquare, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ── 카테고리 정의 ─────────────────────────────────────
const CATEGORIES = [
  { value: 'consult',    label: '상담',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
  { value: 'warning',    label: '경고',    color: 'bg-red-100 text-red-700',      dot: 'bg-red-400' },
  { value: 'praise',     label: '칭찬',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { value: 'assignment', label: '인사발령', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  { value: 'other',      label: '기타',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-300' },
];

function catInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[4];
}

function CategoryBadge({ category }: { category: string }) {
  const c = catInfo(category);
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', c.color)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {c.label}
    </span>
  );
}

// ── 노트 작성/수정 모달 ───────────────────────────────
function NoteForm({
  members,
  onClose,
  editNote,
  defaultUserId,
}: {
  members: any[];
  onClose: () => void;
  editNote?: any;
  defaultUserId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    target_user_id: editNote?.targetUser?.id ?? defaultUserId ?? '',
    category:       editNote?.category ?? 'other',
    title:          editNote?.title ?? '',
    content:        editNote?.content ?? '',
    is_private:     editNote?.isPrivate ?? false,
  });

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      editNote
        ? api.patch(`/hr-notes/${editNote.id}`, payload)
        : api.post('/hr-notes', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-notes'] });
      toast.success(editNote ? '노트가 수정되었습니다.' : '노트가 저장되었습니다.');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '저장 실패'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.target_user_id) { toast.error('직원을 선택하세요.'); return; }
    if (!form.title.trim())   { toast.error('제목을 입력하세요.'); return; }
    if (!form.content.trim()) { toast.error('내용을 입력하세요.'); return; }
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold text-text-primary">
            {editNote ? '노트 수정' : '인사 노트 작성'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 직원 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">대상 직원 *</label>
              <select
                value={form.target_user_id}
                onChange={(e) => setForm((f) => ({ ...f, target_user_id: e.target.value }))}
                disabled={!!editNote}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">분류 *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={255}
              placeholder="노트 제목"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={5}
              maxLength={5000}
              placeholder="노트 내용을 입력하세요..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-[11px] text-text-muted text-right mt-0.5">{form.content.length}/5000</p>
          </div>

          {/* 비공개 */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setForm((f) => ({ ...f, is_private: !f.is_private }))}
              className={clsx(
                'w-9 h-5 rounded-full transition-colors relative',
                form.is_private ? 'bg-primary-500' : 'bg-gray-200',
              )}
            >
              <div className={clsx(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                form.is_private ? 'translate-x-4' : 'translate-x-0.5',
              )} />
            </div>
            <span className="text-sm text-text-secondary flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-text-muted" />
              비공개 (본인만 열람)
            </span>
          </label>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 text-sm font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? '저장 중…' : (editNote ? '수정' : '저장')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 노트 카드 ─────────────────────────────────────────
function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: any;
  onEdit: (note: any) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = note.content.split('\n');
  const isLong = lines.length > 3 || note.content.length > 200;
  const preview = isLong && !expanded
    ? note.content.slice(0, 200) + '…'
    : note.content;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 hover:shadow-card-hover transition-all">
      {/* 상단: 직원 + 카테고리 + 날짜 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/team/${note.targetUser?.id}`} className="flex-shrink-0">
            <Avatar name={note.targetUser?.name ?? '?'} size="sm" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/team/${note.targetUser?.id}`}
                className="text-sm font-semibold text-text-primary hover:text-primary-600 transition-colors"
              >
                {note.targetUser?.name}
              </Link>
              <CategoryBadge category={note.category} />
              {note.isPrivate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                  <Lock className="h-3 w-3" /> 비공개
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              {note.targetUser?.department} · 작성: {note.author?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[11px] text-text-muted whitespace-nowrap">
            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: ko })}
          </span>
          {note.canEdit && (
            <>
              <button
                onClick={() => onEdit(note)}
                className="p-1.5 rounded-lg hover:bg-gray-50 text-text-muted hover:text-text-primary transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 제목 */}
      <p className="text-sm font-semibold text-text-primary mb-1.5">{note.title}</p>

      {/* 내용 */}
      <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{preview}</p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-xs font-medium text-primary-500 hover:text-primary-600 flex items-center gap-1"
        >
          {expanded ? '접기' : '더보기'}
          <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}

      {/* 하단 날짜 */}
      <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-gray-50">
        {format(new Date(note.createdAt), 'yyyy.MM.dd HH:mm')}
        {note.updatedAt !== note.createdAt && (
          <span className="ml-2 text-gray-300">(수정됨)</span>
        )}
      </p>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────
export default function HrNotesPage() {
  usePageTitle('인사 노트');
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [filterUserId,  setFilterUserId]  = useState<string>('');
  const [filterCat,     setFilterCat]     = useState<string>('');
  const [searchQ,       setSearchQ]       = useState('');
  const [showForm,      setShowForm]      = useState(false);
  const [editNote,      setEditNote]      = useState<any>(null);

  // 직원 목록 (좌측 사이드바용)
  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['users-active'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { status: 'active', limit: 200 } });
      return data.data?.users ?? data.data ?? [];
    },
  });

  // 노트 목록
  const { data: notes = [], isLoading } = useQuery<any[]>({
    queryKey: ['hr-notes', filterUserId, filterCat, searchQ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterUserId) params.target_user_id = filterUserId;
      if (filterCat)    params.category = filterCat;
      if (searchQ)      params.q = searchQ;
      const { data } = await api.get('/hr-notes', { params });
      return data.data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr-notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-notes'] });
      toast.success('노트가 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제 실패'),
  });

  const handleDelete = (id: string) => {
    if (confirm('이 노트를 삭제하시겠습니까?')) deleteMutation.mutate(id);
  };

  const selectedMember = members.find((m) => m.id === filterUserId);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="인사 노트" />

      <main className="page-container">
        <div className="flex gap-6">
          {/* ── 좌측: 직원 목록 ───────────────────────── */}
          <aside className="w-56 flex-shrink-0">
            <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden sticky top-6">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">직원</p>
              </div>
              <div className="py-1 max-h-[calc(100vh-200px)] overflow-y-auto">
                <button
                  onClick={() => setFilterUserId('')}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                    !filterUserId
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-text-secondary hover:bg-gray-50',
                  )}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  전체
                  <span className="ml-auto text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {notes.length}
                  </span>
                </button>
                {members.map((m) => {
                  const count = notes.filter((n) => n.targetUser?.id === m.id).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setFilterUserId(m.id)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                        filterUserId === m.id
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-text-secondary hover:bg-gray-50',
                      )}
                    >
                      <Avatar name={m.name} size="sm" />
                      <span className="flex-1 text-left truncate">{m.name}</span>
                      {count > 0 && (
                        <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ── 우측: 노트 목록 ───────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* 툴바 */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* 검색 */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="제목, 내용 검색..."
                  className="w-full border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {/* 카테고리 필터 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterCat('')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    !filterCat ? 'bg-primary-500 text-white' : 'border border-border text-text-secondary hover:bg-gray-50',
                  )}
                >
                  전체
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterCat === c.value ? c.color : 'border border-border text-text-secondary hover:bg-gray-50',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* 작성 버튼 */}
              <button
                onClick={() => { setEditNote(null); setShowForm(true); }}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                노트 작성
              </button>
            </div>

            {/* 필터 표시 */}
            {(filterUserId || filterCat) && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>필터:</span>
                {selectedMember && (
                  <span className="flex items-center gap-1.5 bg-primary-50 text-primary-600 px-2.5 py-1 rounded-lg text-xs font-medium">
                    {selectedMember.name}
                    <button onClick={() => setFilterUserId('')}><X className="h-3 w-3" /></button>
                  </span>
                )}
                {filterCat && (
                  <CategoryBadge category={filterCat} />
                )}
              </div>
            )}

            {/* 노트 목록 */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
                    <div className="flex gap-3 mb-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                        <div className="h-3 bg-gray-50 rounded w-1/5" />
                      </div>
                    </div>
                    <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                    <div className="space-y-1.5">
                      <div className="h-3 bg-gray-50 rounded" />
                      <div className="h-3 bg-gray-50 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notes.length === 0 ? (
              <div className="bg-white rounded-xl border border-border shadow-card flex flex-col items-center justify-center py-20 gap-3">
                <MessageSquare className="h-12 w-12 text-gray-200" />
                <p className="text-sm text-text-muted">
                  {filterUserId || filterCat || searchQ
                    ? '조건에 맞는 노트가 없습니다.'
                    : '아직 작성된 인사 노트가 없습니다.'}
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-1 text-xs font-medium text-primary-500 hover:text-primary-600"
                >
                  + 첫 노트 작성하기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={(n) => { setEditNote(n); setShowForm(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 폼 모달 */}
      {showForm && (
        <NoteForm
          members={members}
          onClose={() => { setShowForm(false); setEditNote(null); }}
          editNote={editNote}
          defaultUserId={filterUserId}
        />
      )}
    </div>
  );
}
