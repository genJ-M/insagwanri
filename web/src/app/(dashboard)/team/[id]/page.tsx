'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Check, X, Phone, Mail, Building2,
  Briefcase, CalendarDays, Clock, Hash, ChevronRight,
  UserCog, AlertTriangle, RefreshCw, FileText, Plus,
  Lock, Trash2, ChevronDown,
} from 'lucide-react';
import { format, differenceInMonths, differenceInYears, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Badge, { ROLE_BADGE, ROLE_LABEL, EMPLOYMENT_BADGE, EMPLOYMENT_LABEL } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ─── 재직 기간 포맷 ───────────────────────────────────────────
function tenure(joinedAt: string | null): string {
  if (!joinedAt) return '-';
  const from = new Date(joinedAt);
  const now = new Date();
  const years = differenceInYears(now, from);
  const months = differenceInMonths(now, from) % 12;
  if (years === 0) return `${months}개월`;
  if (months === 0) return `${years}년`;
  return `${years}년 ${months}개월`;
}

// ─── 인라인 편집 필드 ─────────────────────────────────────────
function EditableField({
  label, value, name, type = 'text', editable, onSave,
}: {
  label: string; value: string | null; name: string;
  type?: string; editable: boolean;
  onSave: (name: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const commit = () => { onSave(name, draft); setEditing(false); };
  const cancel = () => { setDraft(value ?? ''); setEditing(false); };

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-gray-50 last:border-0 group">
      <span className="w-28 text-xs text-text-muted pt-1 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            autoFocus
            className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-primary-300 ring-2 ring-primary-100 focus:outline-none"
          />
          <button onClick={commit} className="p-1 rounded-md bg-primary-500 text-white hover:bg-primary-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-text-primary truncate">{value || <span className="text-text-muted italic">미입력</span>}</span>
          {editable && (
            <button
              onClick={() => { setDraft(value ?? ''); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-all"
              aria-label="편집"
            >
              <Pencil className="h-3 w-3 text-text-muted" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 탭 목록 ─────────────────────────────────────────────────
const TABS = [
  { key: 'basic',    label: '기본정보',   icon: Mail },
  { key: 'hr',       label: '인사정보',   icon: Briefcase },
  { key: 'work',     label: '근무 설정',  icon: Clock },
  { key: 'notes',    label: '인사 노트',  icon: FileText },
  { key: 'career',   label: '경력/학력',  icon: ChevronRight },
  { key: 'docs',     label: '첨부문서',   icon: ChevronRight },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─── 노트 탭 인라인 카테고리 ────────────────────────────
const NOTE_CATS = [
  { value: 'consult',    label: '상담',    color: 'bg-blue-100 text-blue-700' },
  { value: 'warning',    label: '경고',    color: 'bg-red-100 text-red-700' },
  { value: 'praise',     label: '칭찬',    color: 'bg-emerald-100 text-emerald-700' },
  { value: 'assignment', label: '인사발령', color: 'bg-purple-100 text-purple-700' },
  { value: 'other',      label: '기타',    color: 'bg-gray-100 text-gray-600' },
];
function NoteCatBadge({ cat }: { cat: string }) {
  const c = NOTE_CATS.find((x) => x.value === cat) ?? NOTE_CATS[4];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
}

// ─── 노트 탭 컴포넌트 ────────────────────────────────────
function NotesTab({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery<any[]>({
    queryKey: ['hr-notes', userId],
    queryFn: async () => {
      const { data } = await api.get('/hr-notes', { params: { target_user_id: userId } });
      return data.data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr-notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-notes', userId] }); toast.success('삭제됨'); },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editNote
        ? api.patch(`/hr-notes/${editNote.id}`, payload)
        : api.post('/hr-notes', { ...payload, target_user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-notes', userId] });
      toast.success(editNote ? '수정됨' : '저장됨');
      setShowForm(false); setEditNote(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '실패'),
  });

  // 인라인 폼 상태
  const [form, setForm] = useState({ category: 'other', title: '', content: '', is_private: false });

  const openEdit = (n: any) => {
    setForm({ category: n.category, title: n.title, content: n.content, is_private: n.isPrivate });
    setEditNote(n); setShowForm(true);
  };
  const openNew = () => { setForm({ category: 'other', title: '', content: '', is_private: false }); setEditNote(null); setShowForm(true); };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{notes.length}개의 인사 노트</p>
        {canWrite && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> 노트 작성
          </button>
        )}
      </div>

      {/* 작성/수정 인라인 폼 */}
      {showForm && (
        <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {NOTE_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, is_private: !f.is_private }))}
                className={`w-8 h-4.5 rounded-full relative transition-colors ${form.is_private ? 'bg-primary-500' : 'bg-gray-200'}`}
                style={{ height: '18px' }}
              >
                <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${form.is_private ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </div>
              <Lock className="h-3 w-3" /> 비공개
            </label>
          </div>
          <input
            type="text" value={form.title} maxLength={255}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="제목 *"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <textarea
            value={form.content} rows={4} maxLength={5000}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="내용 *"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditNote(null); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50">취소</button>
            <button
              onClick={() => {
                if (!form.title.trim() || !form.content.trim()) { toast.error('제목과 내용을 입력하세요.'); return; }
                saveMutation.mutate(form);
              }}
              disabled={saveMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60"
            >
              {saveMutation.isPending ? '저장 중…' : (editNote ? '수정' : '저장')}
            </button>
          </div>
        </div>
      )}

      {/* 노트 목록 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="h-3.5 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2 text-text-muted">
          <FileText className="h-10 w-10 text-gray-200" />
          <p className="text-sm">작성된 인사 노트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const expanded = expandedId === n.id;
            const isLong = n.content.length > 200;
            return (
              <div key={n.id} className="border border-border rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <NoteCatBadge cat={n.category} />
                    {n.isPrivate && <span className="inline-flex items-center gap-1 text-[11px] text-text-muted"><Lock className="h-3 w-3" />비공개</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] text-text-muted whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ko })}
                    </span>
                    {n.canEdit && (
                      <>
                        <button onClick={() => openEdit(n)} className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm('삭제할까요?')) deleteMutation.mutate(n.id); }} className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">{n.title}</p>
                <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                  {isLong && !expanded ? n.content.slice(0, 200) + '…' : n.content}
                </p>
                {isLong && (
                  <button onClick={() => setExpandedId(expanded ? null : n.id)} className="mt-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 flex items-center gap-1">
                    {expanded ? '접기' : '더보기'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
                <p className="text-[11px] text-text-muted mt-2 pt-2 border-t border-gray-50">
                  작성자: {n.author?.name} · {format(new Date(n.createdAt), 'yyyy.MM.dd HH:mm')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 퇴직/휴직 모달 ─────────────────────────────────────────
function ActionModal({
  type, open, onClose, userId,
}: { type: 'resign' | 'leave'; open: boolean; onClose: () => void; userId: string }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.patch(`/users/${userId}`, {
      status: type === 'resign' ? 'inactive' : 'inactive',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success(type === 'resign' ? '퇴직 처리되었습니다.' : '휴직 처리되었습니다.');
      onClose();
    },
    onError: () => toast.error('처리에 실패했습니다.'),
  });

  const title = type === 'resign' ? '퇴직 신청' : '휴직 신청';
  const dateLabel = type === 'resign' ? '마지막 근무일' : '휴직 시작일';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="label">{dateLabel}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="사유를 입력하세요..."
            className="input resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            variant={type === 'resign' ? 'danger' : 'primary'}
            loading={mutation.isPending}
            disabled={!date}
            onClick={() => mutation.mutate()}
          >
            {title}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 준비 중 플레이스홀더 ─────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
        <ChevronRight className="h-6 w-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="text-xs text-text-muted mt-1">준비 중입니다</p>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('basic');
  const [actionModal, setActionModal] = useState<'resign' | 'leave' | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}`);
      return data.data ?? data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, string>) => api.patch(`/users/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      toast.success('저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const canEdit = me?.role === 'owner' || me?.role === 'manager' || me?.id === id;
  const canManage = me?.role === 'owner' && me?.id !== id;

  const handleSave = (name: string, value: string) => {
    updateMutation.mutate({ [name]: value });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-text-muted" />
        <p className="text-text-secondary">직원을 찾을 수 없습니다.</p>
        <Button variant="secondary" size="sm" onClick={() => router.back()}>돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40">
      {/* ─ 상단 네비 ─ */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-8 py-3 flex items-center gap-3">
        <Link href="/team" className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-xs text-text-muted">직원 관리</span>
        <ChevronRight className="h-3 w-3 text-text-muted" />
        <span className="text-xs font-medium text-text-primary">{user.name}</span>

        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            {user.status === 'inactive' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  updateMutation.mutate({ status: 'active' });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                복직 처리
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setActionModal('leave')}>
                  휴직 신청
                </Button>
                <Button size="sm" variant="danger" onClick={() => setActionModal('resign')}>
                  퇴직 처리
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-6 p-8 max-w-[1100px] mx-auto">
        {/* ─ 좌측 패널 ─ */}
        <aside className="w-64 flex-shrink-0 space-y-4">
          {/* 프로필 카드 */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col items-center text-center">
            <Avatar name={user.name} size="xl" src={user.profileImageUrl} className="mb-3" />
            <h2 className="text-base font-bold text-text-primary">{user.name}</h2>
            <p className="text-xs text-text-muted mt-0.5 mb-3">{user.email}</p>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <Badge value={user.role} colorMap={ROLE_BADGE} label={ROLE_LABEL[user.role]} />
              <Badge
                value={user.status}
                colorMap={{ active: 'green', inactive: 'red', pending: 'yellow' }}
                label={({ active: '재직', inactive: '퇴직', pending: '대기' } as Record<string, string>)[user.status] ?? user.status}
              />
            </div>

            <div className="w-full mt-4 pt-4 border-t border-gray-50 space-y-2.5 text-left">
              {user.department && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  {user.department}
                </div>
              )}
              {user.position && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <UserCog className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  {user.position}
                </div>
              )}
              {user.joinedAt && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <CalendarDays className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  {format(new Date(user.joinedAt), 'yyyy.MM.dd', { locale: ko })}
                  <span className="text-text-muted">({tenure(user.joinedAt)})</span>
                </div>
              )}
              {user.employeeNumber && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Hash className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                  사번 {user.employeeNumber}
                </div>
              )}
            </div>
          </div>

          {/* 탭 내비 */}
          <nav className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-gray-50 last:border-0',
                    tab === t.key
                      ? 'bg-primary-50 text-primary-600 border-l-2 border-l-primary-500'
                      : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ─ 우측 콘텐츠 ─ */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">

            {/* 기본정보 */}
            {tab === 'basic' && (
              <div>
                <SectionHeader title="기본 정보" desc="직원의 기본 연락처 및 식별 정보" />
                <EditableField label="이름"    value={user.name}          name="name"     editable={canEdit} onSave={handleSave} />
                <EditableField label="이메일"  value={user.email}         name="email"    editable={false}   onSave={handleSave} />
                <EditableField label="연락처"  value={user.phone}         name="phone"    editable={canEdit} onSave={handleSave} />
                <EditableField label="사번"    value={user.employeeNumber} name="employeeNumber" editable={canEdit} onSave={handleSave} />

                <div className="mt-6 pt-5 border-t border-gray-50">
                  <SectionHeader title="활동 정보" desc="마지막 접속 등 시스템 활동 이력" />
                  <InfoRow label="마지막 로그인" value={user.lastLoginAt ? format(new Date(user.lastLoginAt), 'yyyy.MM.dd HH:mm', { locale: ko }) : '없음'} />
                  <InfoRow label="계정 생성일"   value={user.createdAt ? format(new Date(user.createdAt), 'yyyy.MM.dd', { locale: ko }) : '-'} />
                </div>
              </div>
            )}

            {/* 인사정보 */}
            {tab === 'hr' && (
              <div>
                <SectionHeader title="인사 정보" desc="소속 부서, 직위, 입사일 등 인사 데이터" />
                <EditableField label="부서"      value={user.department} name="department" editable={canEdit} onSave={handleSave} />
                <EditableField label="직위/직책" value={user.position}   name="position"   editable={canEdit} onSave={handleSave} />
                <EditableField label="입사일"    value={user.joinedAt ? format(new Date(user.joinedAt), 'yyyy-MM-dd') : null} name="joinedAt" type="date" editable={canEdit} onSave={handleSave} />

                {user.joinedAt && (
                  <div className="flex items-start gap-3 py-3.5 border-b border-gray-50">
                    <span className="w-28 text-xs text-text-muted pt-1">재직 기간</span>
                    <span className="text-sm text-text-primary">{tenure(user.joinedAt)}</span>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t border-gray-50">
                  <SectionHeader title="고용 형태" desc="고용 유형 및 계약 구분" />
                  <InfoRow label="고용 형태" value={<Badge value="full_time" colorMap={EMPLOYMENT_BADGE} label={EMPLOYMENT_LABEL['full_time']} />} />
                  <InfoRow label="역할"      value={<Badge value={user.role} colorMap={ROLE_BADGE} label={ROLE_LABEL[user.role]} />} />
                </div>
              </div>
            )}

            {/* 근무 설정 */}
            {tab === 'work' && (
              <div>
                <SectionHeader title="근무 시간 설정" desc="개인별 출퇴근 시간 오버라이드" />
                <EditableField
                  label="출근 시간"
                  value={user.customWorkStart ?? null}
                  name="customWorkStart"
                  type="time"
                  editable={canEdit}
                  onSave={handleSave}
                />
                <EditableField
                  label="퇴근 시간"
                  value={user.customWorkEnd ?? null}
                  name="customWorkEnd"
                  type="time"
                  editable={canEdit}
                  onSave={handleSave}
                />
                <p className="text-xs text-text-muted mt-4 bg-gray-50 px-4 py-3 rounded-xl">
                  미설정 시 워크스페이스 기본 근무 시간이 적용됩니다.
                </p>
              </div>
            )}

            {tab === 'notes'  && <NotesTab userId={id} canWrite={canEdit} />}
            {tab === 'career' && <ComingSoon label="경력 / 학력" />}
            {tab === 'docs'   && <ComingSoon label="첨부 문서" />}
          </div>
        </main>
      </div>

      {actionModal && (
        <ActionModal
          type={actionModal}
          open={!!actionModal}
          onClose={() => setActionModal(null)}
          userId={id}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="text-xs text-text-muted mt-0.5">{desc}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <span className="w-28 text-xs text-text-muted pt-0.5 flex-shrink-0">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
