'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Check, X, Phone, Mail, Building2,
  Briefcase, CalendarDays, Clock, Hash, ChevronRight,
  UserCog, AlertTriangle, RefreshCw, FileText, Plus,
  Lock, Trash2, ChevronDown, GraduationCap, Paperclip,
  UploadCloud, Download, ExternalLink, ShieldCheck,
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
  { key: 'basic',       label: '기본정보',   icon: Mail },
  { key: 'hr',          label: '인사정보',   icon: Briefcase },
  { key: 'work',        label: '근무 설정',  icon: Clock },
  { key: 'notes',       label: '인사 노트',  icon: FileText },
  { key: 'career',      label: '경력/학력',  icon: GraduationCap },
  { key: 'docs',        label: '첨부문서',   icon: Paperclip },
  { key: 'permissions', label: '접근 권한',  icon: ShieldCheck },
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

// ─── 경력 탭 ──────────────────────────────────────────────────
const DEGREE_LABEL: Record<string, string> = {
  high_school: '고등학교',
  associate: '전문학사',
  bachelor: '학사',
  master: '석사',
  doctorate: '박사',
  other: '기타',
};
const EDU_STATUS_LABEL: Record<string, string> = {
  graduated: '졸업',
  enrolled: '재학',
  dropout: '중퇴',
};

function CareerTab({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [careerForm, setCareerForm] = useState(false);
  const [editCareer, setEditCareer] = useState<any>(null);
  const [eduForm, setEduForm] = useState(false);
  const [editEdu, setEditEdu] = useState<any>(null);

  const { data: careers = [], isLoading: cLoading } = useQuery<any[]>({
    queryKey: ['careers', userId],
    queryFn: async () => { const { data } = await api.get(`/users/${userId}/careers`); return data.data ?? []; },
  });
  const { data: educations = [], isLoading: eLoading } = useQuery<any[]>({
    queryKey: ['educations', userId],
    queryFn: async () => { const { data } = await api.get(`/users/${userId}/educations`); return data.data ?? []; },
  });

  const emptyCareer = { companyName: '', position: '', department: '', startDate: '', endDate: '', isCurrent: false, description: '' };
  const emptyEdu = { schoolName: '', major: '', degree: 'bachelor', startDate: '', endDate: '', isCurrent: false, status: 'graduated' };

  const [cf, setCf] = useState(emptyCareer);
  const [ef, setEf] = useState(emptyEdu);

  const saveCareers = useMutation({
    mutationFn: (payload: any) =>
      editCareer ? api.patch(`/users/${userId}/careers/${editCareer.id}`, payload) : api.post(`/users/${userId}/careers`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['careers', userId] }); setCareerForm(false); setEditCareer(null); setCf(emptyCareer); toast.success('저장됨'); },
    onError: () => toast.error('저장 실패'),
  });
  const deleteCareer = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${userId}/careers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['careers', userId] }); toast.success('삭제됨'); },
  });
  const saveEdu = useMutation({
    mutationFn: (payload: any) =>
      editEdu ? api.patch(`/users/${userId}/educations/${editEdu.id}`, payload) : api.post(`/users/${userId}/educations`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['educations', userId] }); setEduForm(false); setEditEdu(null); setEf(emptyEdu); toast.success('저장됨'); },
    onError: () => toast.error('저장 실패'),
  });
  const deleteEdu = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${userId}/educations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['educations', userId] }); toast.success('삭제됨'); },
  });

  const openEditCareer = (c: any) => { setCf({ companyName: c.companyName, position: c.position ?? '', department: c.department ?? '', startDate: c.startDate?.slice(0,10) ?? '', endDate: c.endDate?.slice(0,10) ?? '', isCurrent: c.isCurrent, description: c.description ?? '' }); setEditCareer(c); setCareerForm(true); };
  const openEditEdu = (e: any) => { setEf({ schoolName: e.schoolName, major: e.major ?? '', degree: e.degree, startDate: e.startDate?.slice(0,10) ?? '', endDate: e.endDate?.slice(0,10) ?? '', isCurrent: e.isCurrent, status: e.status }); setEditEdu(e); setEduForm(true); };

  return (
    <div className="space-y-8">
      {/* 경력 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">경력</h3>
            <p className="text-xs text-text-muted mt-0.5">이전 직장 및 업무 이력</p>
          </div>
          {canEdit && (
            <button onClick={() => { setCf(emptyCareer); setEditCareer(null); setCareerForm(true); }} className="flex items-center gap-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg">
              <Plus className="h-3.5 w-3.5" /> 경력 추가
            </button>
          )}
        </div>

        {careerForm && (
          <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">회사명 *</label>
                <input value={cf.companyName} onChange={e => setCf(f => ({...f, companyName: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="회사명" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">직위/직책</label>
                <input value={cf.position} onChange={e => setCf(f => ({...f, position: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="직위" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">부서</label>
                <input value={cf.department} onChange={e => setCf(f => ({...f, department: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="부서" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={cf.isCurrent} onChange={e => setCf(f => ({...f, isCurrent: e.target.checked, endDate: ''}))} className="rounded" />
                  현재 재직 중
                </label>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">입사일 *</label>
                <input type="date" value={cf.startDate} onChange={e => setCf(f => ({...f, startDate: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              {!cf.isCurrent && (
                <div>
                  <label className="text-xs text-text-muted mb-1 block">퇴사일</label>
                  <input type="date" value={cf.endDate} onChange={e => setCf(f => ({...f, endDate: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">업무 내용</label>
              <textarea value={cf.description} onChange={e => setCf(f => ({...f, description: e.target.value}))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="주요 업무 및 성과" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCareerForm(false); setEditCareer(null); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={() => { if (!cf.companyName || !cf.startDate) { toast.error('회사명과 입사일은 필수입니다.'); return; } saveCareers.mutate(cf); }} disabled={saveCareers.isPending} className="px-3 py-1.5 text-xs font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60">
                {saveCareers.isPending ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}

        {cLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse bg-gray-50 rounded-xl h-20" />)}</div>
        ) : careers.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm border border-dashed border-gray-200 rounded-xl">등록된 경력이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {careers.map((c: any) => (
              <div key={c.id} className="border border-border rounded-xl p-4 hover:bg-gray-50/50 group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{c.companyName}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {[c.department, c.position].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {c.startDate?.slice(0,7)} ~ {c.isCurrent ? '현재' : (c.endDate?.slice(0,7) ?? '-')}
                    </p>
                    {c.description && <p className="text-xs text-text-secondary mt-2 whitespace-pre-line">{c.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCareer(c)} className="p-1 rounded hover:bg-gray-100 text-text-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if(confirm('삭제할까요?')) deleteCareer.mutate(c.id); }} className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 학력 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">학력</h3>
            <p className="text-xs text-text-muted mt-0.5">학교 이력 및 전공</p>
          </div>
          {canEdit && (
            <button onClick={() => { setEf(emptyEdu); setEditEdu(null); setEduForm(true); }} className="flex items-center gap-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg">
              <Plus className="h-3.5 w-3.5" /> 학력 추가
            </button>
          )}
        </div>

        {eduForm && (
          <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">학교명 *</label>
                <input value={ef.schoolName} onChange={e => setEf(f => ({...f, schoolName: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="학교명" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">전공</label>
                <input value={ef.major} onChange={e => setEf(f => ({...f, major: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="전공" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">학위</label>
                <select value={ef.degree} onChange={e => setEf(f => ({...f, degree: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                  {Object.entries(DEGREE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">졸업 상태</label>
                <select value={ef.status} onChange={e => setEf(f => ({...f, status: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                  {Object.entries(EDU_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">입학일 *</label>
                <input type="date" value={ef.startDate} onChange={e => setEf(f => ({...f, startDate: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">졸업일</label>
                <input type="date" value={ef.endDate} onChange={e => setEf(f => ({...f, endDate: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEduForm(false); setEditEdu(null); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={() => { if (!ef.schoolName || !ef.startDate) { toast.error('학교명과 입학일은 필수입니다.'); return; } saveEdu.mutate(ef); }} disabled={saveEdu.isPending} className="px-3 py-1.5 text-xs font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60">
                {saveEdu.isPending ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}

        {eLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse bg-gray-50 rounded-xl h-16" />)}</div>
        ) : educations.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm border border-dashed border-gray-200 rounded-xl">등록된 학력이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {educations.map((e: any) => (
              <div key={e.id} className="border border-border rounded-xl p-4 hover:bg-gray-50/50 group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{e.schoolName}</p>
                      <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium">{DEGREE_LABEL[e.degree] ?? e.degree}</span>
                      <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">{EDU_STATUS_LABEL[e.status] ?? e.status}</span>
                    </div>
                    {e.major && <p className="text-xs text-text-secondary mt-0.5">{e.major}</p>}
                    <p className="text-xs text-text-muted mt-1">
                      {e.startDate?.slice(0,7)} ~ {e.isCurrent ? '재학 중' : (e.endDate?.slice(0,7) ?? '-')}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditEdu(e)} className="p-1 rounded hover:bg-gray-100 text-text-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if(confirm('삭제할까요?')) deleteEdu.mutate(e.id); }} className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 첨부문서 탭 ──────────────────────────────────────────────
const DOC_TYPE_LABEL: Record<string, string> = {
  resident_card:   '주민등록등본',
  family_relation: '가족관계증명서',
  graduation:      '졸업증명서',
  career_cert:     '경력증명서',
  health_check:    '건강검진결과',
  disability_cert: '장애인증명서',
  contract:        '근로계약서',
  other:           '기타',
};
const DOC_TYPE_COLOR: Record<string, string> = {
  resident_card: 'bg-blue-50 text-blue-700',
  family_relation: 'bg-purple-50 text-purple-700',
  graduation: 'bg-green-50 text-green-700',
  career_cert: 'bg-yellow-50 text-yellow-700',
  health_check: 'bg-red-50 text-red-700',
  disability_cert: 'bg-orange-50 text-orange-700',
  contract: 'bg-indigo-50 text-indigo-700',
  other: 'bg-gray-100 text-gray-600',
};

function DocsTab({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [docForm, setDocForm] = useState({ type: 'other', displayName: '', file: null as File | null });

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ['docs', userId],
    queryFn: async () => { const { data } = await api.get(`/users/${userId}/documents`); return data.data ?? []; },
  });

  const deleteDoc = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${userId}/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs', userId] }); toast.success('삭제됨'); },
  });

  const handleUpload = async () => {
    if (!docForm.file || !docForm.displayName) { toast.error('파일과 표시 이름을 입력하세요.'); return; }
    setUploading(true);
    try {
      // 1. Presigned URL 발급
      const { data: urlResp } = await api.post('/files/upload-url', {
        filename: docForm.file.name,
        contentType: docForm.file.type || 'application/octet-stream',
        category: 'document',
      });
      const { uploadUrl, fileId, publicUrl } = urlResp.data ?? urlResp;

      // 2. S3 PUT
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': docForm.file.type || 'application/octet-stream' },
        body: docForm.file,
      });

      // 3. 확정
      await api.post('/files/confirm', { fileId });

      // 4. 문서 레코드 생성
      await api.post(`/users/${userId}/documents`, {
        type: docForm.type,
        displayName: docForm.displayName,
        fileUrl: publicUrl ?? uploadUrl.split('?')[0],
        originalName: docForm.file.name,
        fileSize: docForm.file.size,
      });

      qc.invalidateQueries({ queryKey: ['docs', userId] });
      toast.success('업로드 완료');
      setShowForm(false);
      setDocForm({ type: 'other', displayName: '', file: null });
    } catch {
      toast.error('업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  function formatBytes(bytes: number) {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">첨부 서류</h3>
          <p className="text-xs text-text-muted mt-0.5">주민등록등본, 졸업증명서 등 인사 서류</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg">
            <UploadCloud className="h-3.5 w-3.5" /> 서류 추가
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">서류 유형</label>
              <select value={docForm.type} onChange={e => setDocForm(f => ({...f, type: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">표시 이름 *</label>
              <input value={docForm.displayName} onChange={e => setDocForm(f => ({...f, displayName: e.target.value}))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="예: 2024년 주민등록등본" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">파일 *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setDocForm(f => ({...f, file: e.target.files?.[0] ?? null}))}
              className="w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            <p className="text-[11px] text-text-muted mt-1">PDF, JPG, PNG, DOC, DOCX (최대 10MB)</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setDocForm({ type: 'other', displayName: '', file: null }); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleUpload} disabled={uploading || !docForm.file} className="px-3 py-1.5 text-xs font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60">
              {uploading ? '업로드 중…' : '업로드'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-50 rounded-xl h-14" />)}</div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm border border-dashed border-gray-200 rounded-xl">
          <Paperclip className="h-8 w-8 text-gray-200 mx-auto mb-2" />
          등록된 서류가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3 border border-border rounded-xl px-4 py-3 hover:bg-gray-50/50 group">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">{d.displayName}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${DOC_TYPE_COLOR[d.type] ?? DOC_TYPE_COLOR.other}`}>
                    {DOC_TYPE_LABEL[d.type] ?? d.type}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {d.originalName} · {formatBytes(d.fileSize)} · {format(new Date(d.createdAt), 'yyyy.MM.dd', { locale: ko })}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted hover:text-primary-600" aria-label="열기">
                  <ExternalLink className="h-4 w-4" />
                </a>
                {canEdit && (
                  <button onClick={() => { if(confirm('삭제할까요?')) deleteDoc.mutate(d.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500" aria-label="삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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

            {tab === 'work' && <WorkScheduleTab userId={id} me={me} canDirectEdit={canEdit} />}

            {tab === 'notes'       && <NotesTab userId={id} canWrite={canEdit} />}
            {tab === 'career'      && <CareerTab userId={id} canEdit={canEdit} />}
            {tab === 'docs'        && <DocsTab userId={id} canEdit={canEdit} />}
            {tab === 'permissions' && <PermissionsTab userId={id} me={me} targetUser={user} />}
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

// ─── 근무 스케줄 탭 ──────────────────────────────────────────
function WorkScheduleTab({
  userId, me, canDirectEdit,
}: { userId: string; me: any; canDirectEdit: boolean }) {
  const queryClient = useQueryClient();
  const isOwner = me?.role === 'owner';

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['work-schedule', userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/${userId}/work-schedule`);
      return data.data;
    },
    retry: false,
  });

  const [form, setForm] = useState({ workStartTime: '', workEndTime: '', breakMinutes: '', lateThresholdMin: '', note: '' });
  const [showApproval, setShowApproval] = useState(false);
  const [approverIds, setApproverIds] = useState('');
  const [reason, setReason] = useState('');

  const { data: managers } = useQuery({
    queryKey: ['users-managers'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'manager' } });
      return (data.data ?? data) as any[];
    },
    enabled: showApproval,
  });

  // 스케줄 로드 시 폼 초기화
  useEffect(() => {
    if (schedule) {
      const c = schedule.custom;
      setForm({
        workStartTime: c.workStartTime ?? '',
        workEndTime:   c.workEndTime   ?? '',
        breakMinutes:  c.breakMinutes  != null ? String(c.breakMinutes) : '',
        lateThresholdMin: c.lateThresholdMin != null ? String(c.lateThresholdMin) : '',
        note: c.note ?? '',
      });
    }
  }, [schedule]);

  const directMutation = useMutation({
    mutationFn: (p: any) => api.patch(`/users/${userId}/work-schedule`, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-schedule', userId] });
      toast.success('근무 스케줄이 변경되었습니다.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '변경에 실패했습니다.'),
  });

  const approvalMutation = useMutation({
    mutationFn: (p: any) => api.post('/users/work-schedule-change', p),
    onSuccess: () => {
      setShowApproval(false);
      toast.success('결재 기안이 생성되었습니다.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '기안 생성에 실패했습니다.'),
  });

  const handleDirectSave = () => {
    directMutation.mutate({
      workStartTime: form.workStartTime || null,
      workEndTime:   form.workEndTime   || null,
      breakMinutes:  form.breakMinutes  ? Number(form.breakMinutes)  : null,
      lateThresholdMin: form.lateThresholdMin ? Number(form.lateThresholdMin) : null,
      note: form.note || undefined,
    });
  };

  const handleApprovalSubmit = () => {
    const ids = approverIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) { toast.error('결재자를 선택해주세요.'); return; }
    approvalMutation.mutate({
      targetUserId: userId,
      workStartTime: form.workStartTime || null,
      workEndTime:   form.workEndTime   || null,
      breakMinutes:  form.breakMinutes  ? Number(form.breakMinutes)  : null,
      lateThresholdMin: form.lateThresholdMin ? Number(form.lateThresholdMin) : null,
      reason,
      approver_ids: ids,
    });
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400';
  const labelCls = 'block text-xs text-text-muted mb-1';

  if (isLoading) return <div className="py-10 text-center text-sm text-text-muted">로딩 중...</div>;

  const eff = schedule?.effective;
  const comp = schedule?.companyDefault;

  return (
    <div className="space-y-5">
      {/* 현재 적용 스케줄 요약 */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold text-primary-700">현재 적용 근무 스케줄</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted block">출근 시간</span>
            <span className="font-semibold text-text-primary">{eff?.workStartTime ?? '—'}</span>
            {schedule?.custom?.workStartTime && <span className="text-xs text-primary-500 ml-1">(개인 설정)</span>}
          </div>
          <div>
            <span className="text-xs text-text-muted block">퇴근 시간</span>
            <span className="font-semibold text-text-primary">{eff?.workEndTime ?? '—'}</span>
            {schedule?.custom?.workEndTime && <span className="text-xs text-primary-500 ml-1">(개인 설정)</span>}
          </div>
          <div>
            <span className="text-xs text-text-muted block">휴게시간</span>
            <span className="font-semibold text-text-primary">
              {eff?.breakMinutes != null ? `${eff.breakMinutes}분` : '법정 최소 자동'}
            </span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">지각 허용</span>
            <span className="font-semibold text-text-primary">{eff?.lateThresholdMin}분</span>
          </div>
        </div>
        <div className="text-xs text-text-muted bg-white/60 rounded-lg px-3 py-2">
          ⚖️ {schedule?.legalBreakNote}
        </div>
        {comp && (
          <p className="text-xs text-text-muted">
            회사 기본: {comp.workStartTime} ~ {comp.workEndTime} · 지각 허용 {comp.lateThresholdMin}분
          </p>
        )}
      </div>

      {/* 편집 폼 */}
      {(canDirectEdit || !isOwner) && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-text-primary">개인 스케줄 변경</p>
          <p className="text-xs text-text-muted -mt-2">비워두면 회사 기본값을 사용합니다.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>출근 시간 (HH:mm)</label>
              <input type="time" className={inputCls} value={form.workStartTime}
                onChange={e => setForm(f => ({ ...f, workStartTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>퇴근 시간 (HH:mm)</label>
              <input type="time" className={inputCls} value={form.workEndTime}
                onChange={e => setForm(f => ({ ...f, workEndTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>휴게시간 (분, 비워두면 법정 최소 자동)</label>
              <input type="number" min={0} max={480} className={inputCls} value={form.breakMinutes}
                placeholder="예: 60"
                onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))} />
              <p className="text-xs text-text-muted mt-1">4h이상 30분, 8h이상 60분 (근로기준법 제54조)</p>
            </div>
            <div>
              <label className={labelCls}>지각 허용 시간 (분)</label>
              <input type="number" min={0} max={120} className={inputCls} value={form.lateThresholdMin}
                placeholder="예: 10"
                onChange={e => setForm(f => ({ ...f, lateThresholdMin: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>변경 사유 / 메모</label>
            <input type="text" className={inputCls} value={form.note}
              placeholder="예: 계약서 기반 탄력근무제 적용"
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <div className="flex gap-3">
            {canDirectEdit ? (
              <Button onClick={handleDirectSave} loading={directMutation.isPending}>
                직접 변경 (즉시 적용)
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => setShowApproval(!showApproval)}
            >
              결재 기안으로 변경 요청
            </Button>
          </div>
        </div>
      )}

      {/* 결재 기안 폼 */}
      {showApproval && (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-800">결재 기안 — 근무 스케줄 변경</p>
          <div>
            <label className={labelCls}>변경 사유 (결재 문서에 표시)</label>
            <textarea className={`${inputCls} min-h-[80px]`} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="계약서 제○조에 따른 개인 근무시간 조정..." />
          </div>
          <div>
            <label className={labelCls}>결재자 (관리자 선택)</label>
            {managers && managers.length > 0 ? (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {managers.filter((m: any) => m.id !== userId).map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approverIds.includes(m.id)}
                      onChange={(e) => {
                        const ids = approverIds ? approverIds.split(',') : [];
                        if (e.target.checked) setApproverIds([...ids, m.id].join(','));
                        else setApproverIds(ids.filter((i: string) => i !== m.id).join(','));
                      }}
                    />
                    <span>{m.name}</span>
                    <span className="text-text-muted text-xs">{m.department} · {m.position}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">관리자 목록을 불러오는 중...</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApprovalSubmit} loading={approvalMutation.isPending}>
              기안 제출
            </Button>
            <Button variant="ghost" onClick={() => setShowApproval(false)}>취소</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 접근 권한 탭 ─────────────────────────────────────────────
function PermissionsTab({
  userId,
  me,
  targetUser,
}: {
  userId: string;
  me: any;
  targetUser: any;
}) {
  const qc = useQueryClient();
  const myPerms = me?.permissions ?? {};
  const isOwner = me?.role === 'owner';
  const canDirectGrant = isOwner || myPerms.canGrantHrAccess || myPerms.canGrantSalaryAccess;
  const canRequestGrant = me?.role === 'manager';

  // 현재 대상 직원의 권한
  const perms = targetUser?.permissions ?? {};
  const depts = targetUser?.managedDepartments;

  // ── 직접 권한 설정 (OWNER 또는 위임자) ──
  const [editPerms, setEditPerms] = useState<Record<string, any>>({});
  const [editDepts, setEditDepts] = useState<string>('');
  const [showDirectForm, setShowDirectForm] = useState(false);

  // ── 결재 기안 양식 ──
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqForm, setReqForm] = useState({
    reason: '',
    approver_ids_text: '',
    permissions: {} as Record<string, any>,
  });

  const directMutation = useMutation({
    mutationFn: (payload: any) =>
      api.patch(`/users/${userId}/permissions`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', userId] });
      toast.success('권한이 업데이트되었습니다.');
      setShowDirectForm(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? '권한 설정에 실패했습니다.'),
  });

  const requestMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post(`/users/${userId}/permissions/request`, payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('권한 변경 기안이 제출되었습니다. 결재 완료 후 자동 적용됩니다.');
      setShowRequestForm(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? '기안 제출에 실패했습니다.'),
  });

  const PERM_LABELS: Record<string, string> = {
    canViewHrNotes:       'HR 노트 열람',
    canManageHrNotes:     'HR 노트 관리 (작성/수정/삭제)',
    canViewSalary:        '급여 열람 (타인)',
    canManageSalary:      '급여 관리 (등록/수정/확정/지급)',
    canInvite:            '직원 초대',
    canManageContracts:   '계약서 관리',
    canManageEvaluations: '인사평가 관리',
  };

  // OWNER 전용
  const OWNER_ONLY_LABELS: Record<string, string> = {
    canGrantHrAccess:     'HR 권한 위임 (소유자 전용)',
    canGrantSalaryAccess: '급여 권한 위임 (소유자 전용)',
  };

  const HR_PERMS = ['canViewHrNotes', 'canManageHrNotes'];
  const SALARY_PERMS = ['canViewSalary', 'canManageSalary'];

  const handleDirectSave = () => {
    const deptsArr = editDepts.trim()
      ? editDepts.split(',').map((d) => d.trim()).filter(Boolean)
      : undefined;
    directMutation.mutate({
      permissions: Object.keys(editPerms).length ? editPerms : undefined,
      managedDepartments: deptsArr,
    });
  };

  const handleRequest = () => {
    const approverIds = reqForm.approver_ids_text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (approverIds.length === 0) {
      toast.error('결재자 ID를 입력해주세요.');
      return;
    }
    if (reqForm.reason.length < 10) {
      toast.error('사유를 10자 이상 입력해주세요.');
      return;
    }
    requestMutation.mutate({
      target_user_id: userId,
      permissions: Object.keys(reqForm.permissions).length ? reqForm.permissions : undefined,
      reason: reqForm.reason,
      approver_ids: approverIds,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">현재 접근 권한</h3>
        <p className="text-xs text-text-muted mb-4">
          인사 노트·급여 등 민감 데이터에 대한 이 직원의 접근 권한입니다.
        </p>

        {/* 현재 권한 목록 */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left text-xs font-medium text-text-muted px-4 py-3">권한 항목</th>
                <th className="text-center text-xs font-medium text-text-muted px-4 py-3 w-24">상태</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERM_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-text-secondary">{label}</td>
                  <td className="px-4 py-3 text-center">
                    {(perms as any)[key]
                      ? <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">허용</span>
                      : <span className="text-xs text-text-muted bg-gray-50 px-2 py-0.5 rounded-full">없음</span>
                    }
                  </td>
                </tr>
              ))}
              {isOwner && Object.entries(OWNER_ONLY_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-gray-50 last:border-0 bg-amber-50/30">
                  <td className="px-4 py-3 text-amber-700 text-xs">{label}</td>
                  <td className="px-4 py-3 text-center">
                    {(perms as any)[key]
                      ? <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">위임됨</span>
                      : <span className="text-xs text-text-muted bg-gray-50 px-2 py-0.5 rounded-full">없음</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 열람 범위 */}
        {(depts && depts.length > 0) && (
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            <span className="font-medium">담당 부서 범위:</span> {depts.join(', ')}
            {perms.hrNoteScope === 'managed_departments' && ' · HR 노트 담당 부서만'}
            {perms.salaryScope === 'managed_departments' && ' · 급여 담당 부서만'}
          </div>
        )}
      </div>

      {/* 부서별 접근 설명 */}
      <div className="p-4 bg-gray-50 rounded-xl text-xs text-text-muted space-y-1.5">
        <p className="font-medium text-text-secondary">자동 부여 권한 안내</p>
        <p>• <span className="font-medium">인사팀 관리자</span>: HR 노트 자동 접근 (부서명에 "인사", "HR", "노무" 포함)</p>
        <p>• <span className="font-medium">재무팀 관리자</span>: 급여 자동 접근 (부서명에 "재무", "회계", "경리", "급여" 포함)</p>
        <p>• 소유자(owner)는 모든 데이터에 항상 접근 가능합니다.</p>
      </div>

      {/* 직접 권한 설정 (OWNER 또는 위임자) */}
      {canDirectGrant && (
        <div>
          {!showDirectForm ? (
            <button
              onClick={() => {
                setEditPerms({ ...perms });
                setEditDepts(depts?.join(', ') ?? '');
                setShowDirectForm(true);
              }}
              className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              권한 직접 수정
            </button>
          ) : (
            <div className="border border-border rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold text-text-primary">권한 직접 수정</h4>

              {/* HR 권한 */}
              {(isOwner || myPerms.canGrantHrAccess) && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">HR 노트 권한</p>
                  <div className="space-y-2">
                    {HR_PERMS.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPerms[key]}
                          onChange={(e) => setEditPerms((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded"
                        />
                        {PERM_LABELS[key]}
                      </label>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">열람 범위:</span>
                      <select
                        value={editPerms.hrNoteScope ?? 'all'}
                        onChange={(e) => setEditPerms((p) => ({ ...p, hrNoteScope: e.target.value }))}
                        className="text-xs border border-border rounded px-2 py-1"
                      >
                        <option value="all">전체 직원</option>
                        <option value="managed_departments">담당 부서만</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 급여 권한 */}
              {(isOwner || myPerms.canGrantSalaryAccess) && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">급여 권한</p>
                  <div className="space-y-2">
                    {SALARY_PERMS.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPerms[key]}
                          onChange={(e) => setEditPerms((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded"
                        />
                        {PERM_LABELS[key]}
                      </label>
                    ))}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">열람 범위:</span>
                      <select
                        value={editPerms.salaryScope ?? 'all'}
                        onChange={(e) => setEditPerms((p) => ({ ...p, salaryScope: e.target.value }))}
                        className="text-xs border border-border rounded px-2 py-1"
                      >
                        <option value="all">전체 직원</option>
                        <option value="managed_departments">담당 부서만</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 기타 권한 */}
              {isOwner && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">기타 권한</p>
                  <div className="space-y-2">
                    {['canInvite', 'canManageContracts', 'canManageEvaluations'].map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPerms[key]}
                          onChange={(e) => setEditPerms((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded"
                        />
                        {PERM_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 위임 권한 — OWNER 전용 */}
              {isOwner && (
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs font-medium text-amber-700 mb-2">권한 위임 (소유자 전용)</p>
                  <div className="space-y-2">
                    {Object.entries(OWNER_ONLY_LABELS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editPerms[key]}
                          onChange={(e) => setEditPerms((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-amber-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 담당 부서 */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  담당 부서 범위 (쉼표로 구분, 비워두면 전체)
                </label>
                <input
                  type="text"
                  value={editDepts}
                  onChange={(e) => setEditDepts(e.target.value)}
                  placeholder="예: 재무팀, 인사팀"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDirectForm(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleDirectSave}
                  disabled={directMutation.isPending}
                  className="text-sm px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {directMutation.isPending ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 결재 기안으로 권한 요청 (MANAGER) */}
      {canRequestGrant && !canDirectGrant && (
        <div>
          {!showRequestForm ? (
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              권한 변경 기안 요청
            </button>
          ) : (
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">권한 변경 결재 기안</h4>
                <p className="text-xs text-text-muted">
                  결재가 최종 승인되면 권한이 자동으로 적용됩니다. 반려 시 기존 권한이 유지됩니다.
                </p>
              </div>

              {/* 요청 권한 선택 */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-2">변경할 권한</p>
                <div className="space-y-2">
                  {Object.entries(PERM_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!reqForm.permissions[key]}
                        onChange={(e) =>
                          setReqForm((f) => ({
                            ...f,
                            permissions: { ...f.permissions, [key]: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* 결재자 ID */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  결재자 UUID (쉼표 구분, 순서대로 결재)
                </label>
                <input
                  type="text"
                  value={reqForm.approver_ids_text}
                  onChange={(e) => setReqForm((f) => ({ ...f, approver_ids_text: e.target.value }))}
                  placeholder="예: uuid1, uuid2"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <p className="text-[11px] text-text-muted mt-1">결재자 UUID는 직원 프로필 URL에서 확인할 수 있습니다.</p>
              </div>

              {/* 사유 */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">변경 사유 (10자 이상)</label>
                <textarea
                  value={reqForm.reason}
                  onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  placeholder="권한 변경이 필요한 사유를 구체적으로 입력하세요."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                위임 권한(canGrantHrAccess, canGrantSalaryAccess) 부여는 소유자만 직접 설정 가능하며 기안으로 요청할 수 없습니다.
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleRequest}
                  disabled={requestMutation.isPending}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {requestMutation.isPending ? '제출 중…' : '기안 제출'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EMPLOYEE이거나 권한 없는 경우 안내 */}
      {!canDirectGrant && !canRequestGrant && (
        <div className="p-4 bg-gray-50 rounded-xl text-sm text-text-muted text-center">
          권한 변경은 관리자(manager) 이상만 요청할 수 있습니다.
        </div>
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
