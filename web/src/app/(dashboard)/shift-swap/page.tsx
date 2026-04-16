'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import {
  ArrowLeftRight, Megaphone, ClipboardList,
  CheckCircle2, XCircle, Clock, Ban, ChevronRight,
  User, CalendarDays, Plus, MessageSquare, AlertCircle,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────────────

type SwapType   = 'swap' | 'cover';
type SwapStatus =
  | 'pending_peer' | 'pending_approval' | 'approved'
  | 'peer_declined' | 'rejected' | 'cancelled';

interface ShiftSnapshot {
  date: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: string;
}

interface SwapRequest {
  id: string;
  type: SwapType;
  status: SwapStatus;
  requesterId: string;
  targetUserId: string | null;
  requesterShiftSnapshot: ShiftSnapshot | null;
  targetShiftSnapshot: ShiftSnapshot | null;
  requesterNote: string | null;
  peerNote: string | null;
  approverNote: string | null;
  approvedAt: string | null;
  createdAt: string;
  requester: { id: string; name: string; department?: string | null };
  targetUser: { id: string; name: string; department?: string | null } | null;
  approver: { id: string; name: string } | null;
}

interface MyAssignment {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: string;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function fmtShift(s: ShiftSnapshot | null) {
  if (!s) return '—';
  const time = s.startTime ? ` ${s.startTime}~${s.endTime ?? '?'}` : '';
  return `${s.date}${time}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ── 상태 배지 ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<SwapStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending_peer:     { label: '응답 대기', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',    icon: <Clock className="w-3 h-3" /> },
  pending_approval: { label: '승인 대기', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',      icon: <ClipboardList className="w-3 h-3" /> },
  approved:         { label: '승인 완료', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',    icon: <CheckCircle2 className="w-3 h-3" /> },
  peer_declined:    { label: '상대 거절', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',        icon: <XCircle className="w-3 h-3" /> },
  rejected:         { label: '업주 거절', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',        icon: <XCircle className="w-3 h-3" /> },
  cancelled:        { label: '취소됨',   color: 'text-zinc-500',   bg: 'bg-zinc-50 border-zinc-200',      icon: <Ban className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: SwapStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', m.color, m.bg)}>
      {m.icon}{m.label}
    </span>
  );
}

// ── 교환 신청 생성 모달 ───────────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
}

function CreateModal({ open, onClose, userId }: CreateModalProps) {
  const qc = useQueryClient();
  const [type, setType] = useState<SwapType>('cover');
  const [myAssignmentId, setMyAssignmentId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetAssignmentId, setTargetAssignmentId] = useState('');
  const [note, setNote] = useState('');

  // 내 upcoming 시프트
  const { data: myAssignments = [] } = useQuery<MyAssignment[]>({
    queryKey: ['my-assignments-upcoming'],
    queryFn: () =>
      api.get('/shift-schedule/my-assignments').then((r) =>
        (r.data.data ?? []).filter((a: MyAssignment) => a.date >= new Date().toISOString().slice(0, 10)),
      ),
    enabled: open,
  });

  // 동료 목록
  const { data: colleagues = [] } = useQuery<{ id: string; name: string; department?: string | null }[]>({
    queryKey: ['team-simple'],
    queryFn: () =>
      api.get('/users/company').then((r) =>
        (r.data.data ?? r.data)
          .filter((u: any) => u.id !== userId)
          .map((u: any) => ({ id: u.id, name: u.name, department: u.department })),
      ),
    enabled: open && type === 'swap',
  });

  // 선택한 동료의 시프트
  const { data: targetAssignments = [] } = useQuery<MyAssignment[]>({
    queryKey: ['target-assignments', targetUserId],
    queryFn: () =>
      api.get(`/shift-schedule/my-assignments?userId=${targetUserId}`).then((r) =>
        (r.data.data ?? []).filter((a: MyAssignment) => a.date >= new Date().toISOString().slice(0, 10)),
      ),
    enabled: !!targetUserId && type === 'swap',
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/shift-swap', payload),
    onSuccess: () => {
      toast.success(type === 'cover' ? '대타 모집 게시글이 등록되었습니다.' : '교환 신청을 보냈습니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류가 발생했습니다.'),
  });

  const handleSubmit = () => {
    if (!myAssignmentId) return toast.error('내 시프트를 선택하세요.');
    if (type === 'swap' && (!targetUserId || !targetAssignmentId)) {
      return toast.error('상대방과 상대방 시프트를 선택하세요.');
    }
    mutation.mutate({
      type,
      requesterAssignmentId: myAssignmentId,
      ...(type === 'swap' ? { targetUserId, targetAssignmentId } : {}),
      requesterNote: note || undefined,
    });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="근무 교환 신청">
      <div className="space-y-4">
        {/* 유형 선택 */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">유형</p>
          <div className="grid grid-cols-2 gap-2">
            {([['cover', '대타 모집', '내 근무를 대신 해줄 사람을 구합니다', Megaphone], ['swap', '1:1 교환', '특정 동료와 시프트를 맞바꿉니다', ArrowLeftRight]] as const).map(
              ([val, label, desc, Icon]) => (
                <button
                  key={val}
                  onClick={() => setType(val as SwapType)}
                  className={clsx(
                    'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                    type === val ? 'border-primary-400 bg-primary-50' : 'border-zinc-200 hover:border-zinc-300',
                  )}
                >
                  <Icon className={clsx('w-4 h-4 mb-1', type === val ? 'text-primary-600' : 'text-text-muted')} />
                  <p className={clsx('text-sm font-semibold', type === val ? 'text-primary-700' : 'text-text-primary')}>{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </button>
              ),
            )}
          </div>
        </div>

        {/* 내 시프트 선택 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            내 시프트 <span className="text-red-500">*</span>
          </label>
          {myAssignments.length === 0 ? (
            <p className="text-sm text-text-muted">예정된 시프트가 없습니다.</p>
          ) : (
            <select
              className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              value={myAssignmentId}
              onChange={(e) => setMyAssignmentId(e.target.value)}
            >
              <option value="">시프트 선택</option>
              {myAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.date} {a.startTime ? `${a.startTime}~${a.endTime}` : '(종일)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 1:1 교환 — 상대방·시프트 */}
        {type === 'swap' && (
          <>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                상대방 <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                value={targetUserId}
                onChange={(e) => { setTargetUserId(e.target.value); setTargetAssignmentId(''); }}
              >
                <option value="">동료 선택</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.department ? ` (${c.department})` : ''}</option>
                ))}
              </select>
            </div>
            {targetUserId && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  상대방 시프트 <span className="text-red-500">*</span>
                </label>
                {targetAssignments.length === 0 ? (
                  <p className="text-sm text-text-muted">상대방의 예정된 시프트가 없습니다.</p>
                ) : (
                  <select
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                    value={targetAssignmentId}
                    onChange={(e) => setTargetAssignmentId(e.target.value)}
                  >
                    <option value="">시프트 선택</option>
                    {targetAssignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.date} {a.startTime ? `${a.startTime}~${a.endTime}` : '(종일)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">사유/메모 (선택)</label>
          <textarea
            className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            rows={2}
            placeholder="ex. 개인 사정으로 해당 날짜 출근이 어렵습니다."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '신청 중...' : type === 'cover' ? '대타 모집 게시' : '교환 신청'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── 카드 컴포넌트 ─────────────────────────────────────────────────────────────

interface SwapCardProps {
  req: SwapRequest;
  myId: string;
  isManager: boolean;
  onAction: (action: 'accept' | 'decline' | 'volunteer' | 'approve' | 'reject' | 'cancel', req: SwapRequest) => void;
}

function SwapCard({ req, myId, isManager, onAction }: SwapCardProps) {
  const isRequester = req.requesterId === myId;
  const isTarget    = req.targetUserId === myId;

  return (
    <div className={clsx(
      'bg-white rounded-2xl border p-4 space-y-3 transition-all',
      req.status === 'pending_approval' && isManager ? 'border-blue-300 shadow-sm shadow-blue-100' : 'border-zinc-200 hover:border-zinc-300',
    )}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {req.type === 'cover' ? (
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-4 h-4 text-amber-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <ArrowLeftRight className="w-4 h-4 text-primary-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {req.type === 'cover' ? '대타 모집' : '1:1 교환 신청'}
            </p>
            <p className="text-xs text-text-muted">{fmtDate(req.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* 시프트 정보 */}
      <div className={clsx(
        'rounded-xl p-3 text-sm',
        req.type === 'cover' ? 'bg-amber-50' : 'bg-primary-50',
      )}>
        {req.type === 'cover' ? (
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-amber-700 font-medium">{req.requester.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
            <CalendarDays className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800 font-semibold">{fmtShift(req.requesterShiftSnapshot)}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-500 font-medium w-12 flex-shrink-0">신청자</span>
              <span className="font-medium text-primary-700">{req.requester.name}</span>
              <span className="text-primary-600 font-semibold">{fmtShift(req.requesterShiftSnapshot)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-500 font-medium w-12 flex-shrink-0">상대방</span>
              <span className="font-medium text-primary-700">{req.targetUser?.name ?? '미정'}</span>
              <span className="text-primary-600 font-semibold">{fmtShift(req.targetShiftSnapshot)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 메모들 */}
      {req.requesterNote && (
        <div className="flex items-start gap-2 text-xs text-text-muted bg-zinc-50 rounded-xl p-2.5">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{req.requesterNote}</span>
        </div>
      )}
      {req.peerNote && (
        <div className="flex items-start gap-2 text-xs text-text-muted bg-zinc-50 rounded-xl p-2.5">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{req.targetUser?.name ?? '상대방'}: {req.peerNote}</span>
        </div>
      )}
      {req.approverNote && (
        <div className="flex items-start gap-2 text-xs text-text-muted bg-zinc-50 rounded-xl p-2.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>업주: {req.approverNote}</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2 pt-1">
        {/* B가 swap 수락/거절 */}
        {isTarget && req.status === 'pending_peer' && req.type === 'swap' && (
          <>
            <Button size="sm" className="flex-1" onClick={() => onAction('accept', req)}>수락</Button>
            <Button size="sm" variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => onAction('decline', req)}>거절</Button>
          </>
        )}
        {/* 대타 자원 (요청자 본인 제외, open 상태) */}
        {!isRequester && req.type === 'cover' && req.status === 'pending_peer' && (
          <Button size="sm" className="flex-1" onClick={() => onAction('volunteer', req)}>
            대타 자원하기
          </Button>
        )}
        {/* 업주·관리자 승인/거절 */}
        {isManager && req.status === 'pending_approval' && (
          <>
            <Button size="sm" className="flex-1" onClick={() => onAction('approve', req)}>승인</Button>
            <Button size="sm" variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => onAction('reject', req)}>거절</Button>
          </>
        )}
        {/* 요청자 취소 */}
        {isRequester && ['pending_peer', 'peer_declined'].includes(req.status) && (
          <Button size="sm" variant="outline" className="flex-1 text-zinc-500" onClick={() => onAction('cancel', req)}>
            취소
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 응답/승인 메모 모달 ────────────────────────────────────────────────────────

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: (note: string) => void;
  loading?: boolean;
}

function NoteModal({ open, onClose, title, confirmLabel, confirmClass, onConfirm, loading }: NoteModalProps) {
  const [note, setNote] = useState('');
  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <textarea
          className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          rows={3}
          placeholder="메모/사유 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
          <Button
            className={clsx('flex-1', confirmClass)}
            onClick={() => onConfirm(note)}
            disabled={loading}
          >
            {loading ? '처리 중...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

type TabKey = 'mine' | 'board' | 'all';

export default function ShiftSwapPage() {
  usePageTitle('근무 교환');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isManager = user?.role === 'owner' || user?.role === 'manager';

  const [tab, setTab] = useState<TabKey>(isManager ? 'all' : 'mine');
  const [createOpen, setCreateOpen] = useState(false);

  // 액션 상태
  const [actionTarget, setActionTarget] = useState<{ action: string; req: SwapRequest } | null>(null);

  // 데이터
  const { data: allRequests = [], isLoading } = useQuery<SwapRequest[]>({
    queryKey: ['shift-swap'],
    queryFn: () => api.get('/shift-swap').then((r) => r.data.data),
  });

  const { data: boardRequests = [] } = useQuery<SwapRequest[]>({
    queryKey: ['shift-swap-board'],
    queryFn: () => api.get('/shift-swap/board').then((r) => r.data.data),
    enabled: tab === 'board',
  });

  const myId = user?.id ?? '';

  // mine 탭: 본인이 신청하거나 대상인 것
  const mineRequests = allRequests.filter(
    (r) => r.requesterId === myId || r.targetUserId === myId,
  );

  // all 탭: 승인 필요한 것 상단
  const sortedAll = [...allRequests].sort((a, b) => {
    if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
    if (b.status === 'pending_approval' && a.status !== 'pending_approval') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 뮤테이션
  const peerMut = useMutation({
    mutationFn: ({ id, accept, note }: { id: string; accept: boolean; note: string }) =>
      api.post(`/shift-swap/${id}/peer-respond`, { accept, peerNote: note || undefined }),
    onSuccess: (_, { accept }) => {
      toast.success(accept ? '교환을 수락했습니다. 업주 승인을 기다립니다.' : '거절했습니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      setActionTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const volunteerMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/shift-swap/${id}/volunteer`, { peerNote: note || undefined }),
    onSuccess: () => {
      toast.success('대타를 자원했습니다. 업주 승인을 기다립니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      qc.invalidateQueries({ queryKey: ['shift-swap-board'] });
      setActionTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/shift-swap/${id}/approve`, { approverNote: note || undefined }),
    onSuccess: () => {
      toast.success('근무 교환을 승인했습니다. 시프트가 자동으로 변경됩니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      setActionTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/shift-swap/${id}/reject`, { approverNote: note || undefined }),
    onSuccess: () => {
      toast.success('거절했습니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      setActionTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.delete(`/shift-swap/${id}`),
    onSuccess: () => {
      toast.success('요청을 취소했습니다.');
      qc.invalidateQueries({ queryKey: ['shift-swap'] });
      qc.invalidateQueries({ queryKey: ['shift-swap-board'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '오류'),
  });

  const handleAction = (action: string, req: SwapRequest) => {
    if (action === 'cancel') {
      if (confirm('요청을 취소할까요?')) cancelMut.mutate(req.id);
      return;
    }
    setActionTarget({ action, req });
  };

  const pendingApprovalCount = allRequests.filter((r) => r.status === 'pending_approval').length;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    ...(isManager ? [] : [{ key: 'mine' as TabKey, label: '내 교환 요청', count: mineRequests.filter((r) => ['pending_peer', 'pending_approval'].includes(r.status)).length || undefined }]),
    { key: 'board' as TabKey, label: '대타 게시판', count: boardRequests.length || undefined },
    ...(isManager ? [{ key: 'all' as TabKey, label: '전체 현황', count: pendingApprovalCount || undefined }] : []),
    ...(!isManager ? [{ key: 'all' as TabKey, label: '전체 현황' }] : []),
  ];

  const listToShow: SwapRequest[] = tab === 'board' ? boardRequests : tab === 'mine' ? mineRequests : sortedAll;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">근무 교환</h1>
          <p className="text-sm text-text-muted mt-0.5">
            시프트를 동료와 교환하거나 대타를 구할 수 있습니다. 모든 교환은 업주의 최종 승인이 필요합니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          교환 신청
        </Button>
      </div>

      {/* 탭 */}
      <div className="px-6 pt-4 flex gap-1 border-b border-zinc-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              tab === t.key
                ? 'bg-white border border-b-white border-zinc-200 text-primary-700 -mb-px z-10'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {t.label}
            {t.count ? (
              <span className="text-[10px] font-bold bg-primary-500 text-white px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">불러오는 중...</div>
        ) : listToShow.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ArrowLeftRight className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="font-medium text-text-secondary mb-1">
              {tab === 'board' ? '현재 대타를 구하는 요청이 없습니다.' : '교환 요청이 없습니다.'}
            </p>
            <p className="text-sm text-text-muted">
              '교환 신청' 버튼으로 시프트 교환을 요청해 보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {listToShow.map((req) => (
              <SwapCard
                key={req.id}
                req={req}
                myId={myId}
                isManager={isManager}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* 신청 생성 모달 */}
      {createOpen && user && (
        <CreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          userId={user.id}
          companyId={user.companyId}
        />
      )}

      {/* 수락 */}
      {actionTarget?.action === 'accept' && (
        <NoteModal
          open
          onClose={() => setActionTarget(null)}
          title="교환 수락"
          confirmLabel="수락"
          onConfirm={(note) => peerMut.mutate({ id: actionTarget.req.id, accept: true, note })}
          loading={peerMut.isPending}
        />
      )}

      {/* 거절 */}
      {actionTarget?.action === 'decline' && (
        <NoteModal
          open
          onClose={() => setActionTarget(null)}
          title="교환 거절"
          confirmLabel="거절"
          confirmClass="bg-red-500 hover:bg-red-600 text-white border-0"
          onConfirm={(note) => peerMut.mutate({ id: actionTarget.req.id, accept: false, note })}
          loading={peerMut.isPending}
        />
      )}

      {/* 대타 자원 */}
      {actionTarget?.action === 'volunteer' && (
        <NoteModal
          open
          onClose={() => setActionTarget(null)}
          title={`대타 자원 — ${fmtShift(actionTarget.req.requesterShiftSnapshot)}`}
          confirmLabel="자원하기"
          onConfirm={(note) => volunteerMut.mutate({ id: actionTarget.req.id, note })}
          loading={volunteerMut.isPending}
        />
      )}

      {/* 업주 승인 */}
      {actionTarget?.action === 'approve' && (
        <NoteModal
          open
          onClose={() => setActionTarget(null)}
          title="근무 교환 최종 승인"
          confirmLabel="승인"
          onConfirm={(note) => approveMut.mutate({ id: actionTarget.req.id, note })}
          loading={approveMut.isPending}
        />
      )}

      {/* 업주 거절 */}
      {actionTarget?.action === 'reject' && (
        <NoteModal
          open
          onClose={() => setActionTarget(null)}
          title="근무 교환 거절"
          confirmLabel="거절"
          confirmClass="bg-red-500 hover:bg-red-600 text-white border-0"
          onConfirm={(note) => rejectMut.mutate({ id: actionTarget.req.id, note })}
          loading={rejectMut.isPending}
        />
      )}
    </div>
  );
}
