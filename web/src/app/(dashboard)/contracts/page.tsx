'use client';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileSignature, Plus, X, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Clock, ExternalLink, Pencil,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── 타입 ────────────────────────────────────────────
type ContractType = 'employment' | 'part_time' | 'contract' | 'nda' | 'other';
type ContractStatus = 'active' | 'expired' | 'terminated';

interface Contract {
  id: string;
  type: ContractType;
  title: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  terminatedAt: string | null;
  terminateReason: string | null;
  daysLeft: number | null;
  isExpiringSoon: boolean;
  createdAt: string;
  user: { id: string; name: string; department: string | null; position: string | null } | null;
}

// ─── 상수 ────────────────────────────────────────────
const TYPE_LABELS: Record<ContractType, string> = {
  employment: '근로계약', part_time: '단시간근로',
  contract: '용역계약', nda: '비밀유지', other: '기타',
};
const TYPE_COLORS: Record<ContractType, string> = {
  employment: 'bg-blue-50 text-blue-700',
  part_time:  'bg-violet-50 text-violet-700',
  contract:   'bg-teal-50 text-teal-700',
  nda:        'bg-orange-50 text-orange-700',
  other:      'bg-gray-100 text-gray-600',
};
const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string }> = {
  active:     { label: '유효',   color: 'bg-emerald-50 text-emerald-700' },
  expired:    { label: '만료',   color: 'bg-gray-100 text-gray-500' },
  terminated: { label: '해지',   color: 'bg-red-50 text-red-600' },
};

// ─── 계약 등록/수정 폼 ───────────────────────────────
function ContractForm({
  users, editItem, onClose, onSuccess,
}: {
  users: any[];
  editItem?: Contract;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [userId, setUserId] = useState(editItem?.user?.id ?? '');
  const [type, setType] = useState<ContractType>(editItem?.type ?? 'employment');
  const [title, setTitle] = useState(editItem?.title ?? '');
  const [startDate, setStartDate] = useState(editItem?.startDate ?? '');
  const [endDate, setEndDate] = useState(editItem?.endDate ?? '');
  const [fileUrl, setFileUrl] = useState(editItem?.fileUrl ?? '');
  const [fileName, setFileName] = useState(editItem?.fileName ?? '');
  const [note, setNote] = useState(editItem?.note ?? '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!editItem && !userId) { toast.error('직원을 선택하세요.'); return; }
    if (!title.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!startDate) { toast.error('계약 시작일을 입력하세요.'); return; }
    setLoading(true);
    try {
      const body = {
        ...(editItem ? {} : { user_id: userId }),
        type, title,
        start_date: startDate,
        end_date: endDate || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        note: note || undefined,
      };
      if (editItem) {
        await api.patch(`/contracts/${editItem.id}`, body);
      } else {
        await api.post('/contracts', body);
      }
      toast.success(editItem ? '수정되었습니다.' : '계약이 등록되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900">{editItem ? '계약 수정' : '계약 등록'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!editItem && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">직원</label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400">
                <option value="">직원 선택</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ''}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 유형</label>
              <select value={type} onChange={e => setType(e.target.value as ContractType)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약명</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 2026년 근로계약"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 종료일 <span className="text-gray-300">(무기한 시 공란)</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">파일 URL</label>
              <input value={fileUrl} onChange={e => setFileUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">파일명</label>
              <input value={fileName} onChange={e => setFileName(e.target.value)}
                placeholder="계약서.pdf"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">메모</label>
            <RichTextEditor
              value={note}
              onChange={setNote}
              placeholder="메모를 입력하세요"
              minHeight={80}
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 disabled:opacity-50">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────
export default function ContractsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Contract | undefined>();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contracts'] });

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts', statusFilter, typeFilter],
    queryFn: () =>
      api.get(`/contracts${statusFilter || typeFilter ? `?${new URLSearchParams({ ...(statusFilter && { status: statusFilter }), ...(typeFilter && { type: typeFilter }) })}` : ''}`).then(r => r.data.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users?limit=200').then(r => r.data.data?.users ?? []),
    enabled: isAdmin,
  });

  const terminateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/contracts/${id}/terminate`, { reason }),
    onSuccess: () => { toast.success('계약이 해지되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '해지에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const handleTerminate = (id: string) => {
    const reason = window.prompt('해지 사유를 입력하세요 (선택):');
    if (reason === null) return;
    terminateMutation.mutate({ id, reason: reason || undefined });
  };

  const expiringSoon = contracts.filter(c => c.isExpiringSoon && c.status === 'active');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold text-gray-900">계약 관리</h1>
              {expiringSoon.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  <AlertTriangle className="w-3 h-3" />
                  {expiringSoon.length}건 만료예정
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">직원 계약서를 등록하고 만료를 관리합니다.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditItem(undefined); setShowForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" />
              계약 등록
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
            <option value="">전체 상태</option>
            <option value="active">유효</option>
            <option value="expired">만료</option>
            <option value="terminated">해지</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
            <option value="">전체 유형</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* 만료 예정 배너 */}
      {expiringSoon.length > 0 && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-[13px] font-bold text-amber-800">30일 이내 만료 예정 계약 ({expiringSoon.length}건)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(c => (
              <span key={c.id} className="px-2.5 py-1 bg-amber-100 rounded-lg text-[12px] font-semibold text-amber-700">
                {c.user?.name} · {c.title} · D-{c.daysLeft}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 계약 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-48" />
                    <div className="h-2.5 bg-gray-100 rounded w-64" />
                  </div>
                </div>
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="py-16 text-center">
              <FileSignature className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">등록된 계약이 없습니다.</p>
              {isAdmin && (
                <button onClick={() => setShowForm(true)}
                  className="mt-3 text-[13px] text-primary-500 font-semibold hover:underline">
                  계약 등록하기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {contracts.map(c => {
                const sCfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className={clsx('px-5 py-4 hover:bg-gray-50', c.isExpiringSoon && c.status === 'active' && 'bg-amber-50/30')}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-[13px] font-bold text-primary-600 flex-shrink-0">
                          {c.user?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {c.user && <span className="text-[13px] font-bold text-gray-900">{c.user.name}</span>}
                            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', TYPE_COLORS[c.type])}>
                              {TYPE_LABELS[c.type]}
                            </span>
                            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', sCfg.color)}>
                              {sCfg.label}
                            </span>
                            {c.isExpiringSoon && c.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                D-{c.daysLeft}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-semibold text-gray-700 truncate">{c.title}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[12px] text-gray-400">
                            <span>{c.startDate} ~ {c.endDate ?? '무기한'}</span>
                            {c.user?.department && <span>{c.user.department}</span>}
                          </div>
                          {c.terminateReason && (
                            <p className="text-[12px] text-red-400 mt-0.5">해지사유: {c.terminateReason}</p>
                          )}
                          {c.note && <p className="text-[12px] text-gray-400 mt-0.5 truncate">{c.note}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.fileUrl && (
                          <a href={c.fileUrl} target="_blank" rel="noopener noreferrer"
                            title="파일 보기"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {isAdmin && c.status === 'active' && (
                          <>
                            <button
                              onClick={() => { setEditItem(c); setShowForm(true); }}
                              title="수정"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTerminate(c.id)}
                              title="해지"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-400">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isAdmin && c.status !== 'active' && (
                          <button
                            onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(c.id); }}
                            title="삭제"
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
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
        <ContractForm
          users={users}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(undefined); }}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
