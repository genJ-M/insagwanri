'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Plus, Check, X, RotateCcw, Trash2,
  ChevronLeft, ChevronRight, Clock, Users, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── 타입 ────────────────────────────────────────────
type VacationType = 'annual' | 'half_day_am' | 'half_day_pm' | 'sick' | 'event' | 'maternity' | 'paternity' | 'other';
type VacationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface VacationRequest {
  id: string;
  type: VacationType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: VacationStatus;
  rejectReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; department: string | null; position: string | null } | null;
  approver: { id: string; name: string } | null;
}

interface VacationBalance {
  year: number;
  totalDays: number;
  usedDays: number;
  adjustDays: number;
  remaining: number;
  note: string | null;
}

interface TeamBalance {
  user: { id: string; name: string; department: string | null; position: string | null };
  year: number;
  totalDays: number;
  usedDays: number;
  adjustDays: number;
  remaining: number;
}

// ─── 상수 ────────────────────────────────────────────
const TYPE_LABELS: Record<VacationType, string> = {
  annual: '연차',
  half_day_am: '오전 반차',
  half_day_pm: '오후 반차',
  sick: '병가',
  event: '경조사',
  maternity: '출산휴가',
  paternity: '육아휴직',
  other: '기타',
};

const STATUS_CONFIG: Record<VacationStatus, { label: string; color: string }> = {
  pending:   { label: '대기중',   color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved:  { label: '승인',     color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  rejected:  { label: '반려',     color: 'bg-red-50 text-red-700 border border-red-200' },
  cancelled: { label: '취소됨',   color: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

// ─── 소컴포넌트 ──────────────────────────────────────
function StatusBadge({ status }: { status: VacationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: VacationType }) {
  const colors: Record<VacationType, string> = {
    annual:     'bg-blue-50 text-blue-700 border border-blue-200',
    half_day_am:'bg-violet-50 text-violet-700 border border-violet-200',
    half_day_pm:'bg-violet-50 text-violet-700 border border-violet-200',
    sick:       'bg-rose-50 text-rose-700 border border-rose-200',
    event:      'bg-orange-50 text-orange-700 border border-orange-200',
    maternity:  'bg-pink-50 text-pink-700 border border-pink-200',
    paternity:  'bg-teal-50 text-teal-700 border border-teal-200',
    other:      'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', colors[type])}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ─── 휴가 신청 폼 ─────────────────────────────────────
function VacationForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<VacationType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const isHalfDay = type === 'half_day_am' || type === 'half_day_pm';

  const handleTypeChange = (v: VacationType) => {
    setType(v);
    if (v === 'half_day_am' || v === 'half_day_pm') {
      setDays(0.5);
      if (startDate) setEndDate(startDate);
    } else {
      if (days === 0.5) setDays(1);
    }
  };

  const handleStartChange = (v: string) => {
    setStartDate(v);
    if (isHalfDay) setEndDate(v);
    else if (!endDate || endDate < v) setEndDate(v);
  };

  const calcDays = () => {
    if (!startDate || !endDate) return;
    if (isHalfDay) { setDays(0.5); return; }
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    setDays(Math.max(1, diff));
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) { toast.error('날짜를 선택해주세요.'); return; }
    setLoading(true);
    try {
      await api.post('/vacations', { type, start_date: startDate, end_date: endDate, days, reason: reason || undefined });
      toast.success('휴가 신청이 완료되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '신청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900">휴가 신청</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* 유형 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">휴가 유형</label>
            <select
              value={type}
              onChange={e => handleTypeChange(e.target.value as VacationType)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">시작일</label>
              <input
                type="date" value={startDate}
                onChange={e => handleStartChange(e.target.value)}
                onBlur={calcDays}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">종료일</label>
              <input
                type="date" value={endDate}
                disabled={isHalfDay}
                onChange={e => setEndDate(e.target.value)}
                onBlur={calcDays}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* 일수 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">사용 일수</label>
            <input
              type="number" value={days} min={0.5} step={0.5}
              onChange={e => setDays(Number(e.target.value))}
              disabled={isHalfDay}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400 disabled:bg-gray-50"
            />
          </div>

          {/* 사유 */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">사유 (선택)</label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="휴가 사유를 입력하세요."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? '신청 중...' : '신청하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 잔여 휴가 설정 모달 (관리자) ────────────────────
function BalanceModal({
  users, year, onClose, onSuccess,
}: {
  users: any[];
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [totalDays, setTotalDays] = useState<number>(15);
  const [adjustDays, setAdjustDays] = useState<number>(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userId) { toast.error('직원을 선택해주세요.'); return; }
    setLoading(true);
    try {
      await api.post('/vacations/balances', {
        user_id: userId, year, total_days: totalDays, adjust_days: adjustDays, note: note || undefined,
      });
      toast.success('휴가 일수가 설정되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '설정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900">{year}년 휴가 일수 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">직원</label>
            <select
              value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
            >
              <option value="">직원 선택</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">총 부여일수</label>
              <input
                type="number" value={totalDays} min={0} step={0.5}
                onChange={e => setTotalDays(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">조정 일수</label>
              <input
                type="number" value={adjustDays} step={0.5}
                onChange={e => setAdjustDays(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">메모</label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="예: 입사일 기준 자동 산정"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
            />
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

// ─── 메인 페이지 ─────────────────────────────────────
export default function VacationsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'requests'>('my');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vacations'] });
    qc.invalidateQueries({ queryKey: ['vacation-balance'] });
    qc.invalidateQueries({ queryKey: ['vacation-team'] });
  };

  // 본인 잔여 휴가
  const { data: myBalance } = useQuery<VacationBalance>({
    queryKey: ['vacation-balance', year],
    queryFn: () => api.get(`/vacations/balance?year=${year}`).then(r => r.data.data),
  });

  // 내 신청 내역
  const { data: myRequests = [], isLoading: myLoading } = useQuery<VacationRequest[]>({
    queryKey: ['vacations', 'my', year, statusFilter],
    queryFn: () =>
      api.get(`/vacations?year=${year}${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data.data),
    enabled: activeTab === 'my' || !isAdmin,
  });

  // 팀 전체 잔여 (관리자)
  const { data: teamBalances = [] } = useQuery<TeamBalance[]>({
    queryKey: ['vacation-team', year],
    queryFn: () => api.get(`/vacations/balances/team?year=${year}`).then(r => r.data.data),
    enabled: isAdmin && activeTab === 'team',
  });

  // 전체 신청 목록 (관리자)
  const { data: allRequests = [], isLoading: allLoading } = useQuery<VacationRequest[]>({
    queryKey: ['vacations', 'all', year, statusFilter],
    queryFn: () =>
      api.get(`/vacations?year=${year}${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data.data),
    enabled: isAdmin && activeTab === 'requests',
  });

  // 직원 목록 (관리자 잔여 설정용)
  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users?limit=200').then(r => r.data.data?.users ?? []),
    enabled: isAdmin,
  });

  // 승인
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/vacations/${id}/approve`),
    onSuccess: () => { toast.success('승인되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '승인에 실패했습니다.'),
  });

  // 반려
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/vacations/${id}/reject`, { reject_reason: reason }),
    onSuccess: () => { toast.success('반려되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '반려에 실패했습니다.'),
  });

  // 취소
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/vacations/${id}/cancel`),
    onSuccess: () => { toast.success('취소되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '취소에 실패했습니다.'),
  });

  // 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vacations/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const handleReject = (id: string) => {
    const reason = window.prompt('반려 사유를 입력하세요 (선택):');
    if (reason === null) return; // 취소 클릭
    rejectMutation.mutate({ id, reason: reason || undefined });
  };

  const tabs = [
    { id: 'my', label: '내 휴가', icon: CalendarDays },
    ...(isAdmin ? [
      { id: 'team', label: '팀 현황', icon: Users },
      { id: 'requests', label: '신청 관리', icon: Clock },
    ] : []),
  ] as const;

  const displayRequests = activeTab === 'my' ? myRequests : allRequests;
  const isLoading = activeTab === 'my' ? myLoading : allLoading;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900">휴가 관리</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">연차/반차 신청 및 승인을 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowBalanceModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                휴가 설정
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" />
              휴가 신청
            </button>
          </div>
        </div>

        {/* 연도 선택 */}
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[15px] font-bold text-gray-800 w-14 text-center">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* 내 잔여 휴가 카드 */}
        {myBalance && (activeTab === 'my' || !isAdmin) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: '총 부여', value: myBalance.totalDays, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '사용', value: myBalance.usedDays, color: 'text-red-600', bg: 'bg-red-50' },
              { label: '조정', value: myBalance.adjustDays, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: '잔여', value: myBalance.remaining, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(c => (
              <div key={c.label} className={clsx('rounded-2xl p-4 flex flex-col', c.bg)}>
                <p className="text-[12px] font-semibold text-gray-500">{c.label}</p>
                <p className={clsx('text-[24px] font-bold mt-1 tabular-nums', c.color)}>
                  {c.value}<span className="text-[14px] font-semibold ml-0.5">일</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        {isAdmin && (
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as 'my' | 'team' | 'requests')}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all',
                  activeTab === t.id
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* 팀 현황 탭 */}
        {isAdmin && activeTab === 'team' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-[14px] font-bold text-gray-900">{year}년 팀 휴가 현황</h3>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-[12px] font-semibold text-gray-500">직원</th>
                  <th className="px-4 py-3 text-center text-[12px] font-semibold text-gray-500">총 부여</th>
                  <th className="px-4 py-3 text-center text-[12px] font-semibold text-gray-500">사용</th>
                  <th className="px-4 py-3 text-center text-[12px] font-semibold text-gray-500">조정</th>
                  <th className="px-4 py-3 text-center text-[12px] font-semibold text-gray-500">잔여</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-gray-500">현황</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teamBalances.map(b => {
                  const usePct = b.totalDays > 0 ? (b.usedDays / b.totalDays) * 100 : 0;
                  return (
                    <tr key={b.user.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-[12px] font-bold text-primary-600 flex-shrink-0">
                            {b.user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{b.user.name}</p>
                            <p className="text-[11px] text-gray-400">{b.user.department ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums">{b.totalDays}일</td>
                      <td className="px-4 py-3 text-center text-red-600 font-semibold tabular-nums">{b.usedDays}일</td>
                      <td className="px-4 py-3 text-center text-orange-600 font-semibold tabular-nums">
                        {b.adjustDays > 0 ? `+${b.adjustDays}` : b.adjustDays}일
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold tabular-nums">{b.remaining}일</td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-400 rounded-full transition-all"
                              style={{ width: `${Math.min(usePct, 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{usePct.toFixed(0)}% 사용</p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {teamBalances.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-gray-400">
                      등록된 직원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 내 휴가 / 신청 관리 탭 */}
        {(activeTab === 'my' || activeTab === 'requests') && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-[14px] font-bold text-gray-900">
                {activeTab === 'my' ? '내 휴가 신청 내역' : '전체 신청 목록'}
              </h3>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400"
              >
                <option value="">전체</option>
                <option value="pending">대기중</option>
                <option value="approved">승인</option>
                <option value="rejected">반려</option>
                <option value="cancelled">취소됨</option>
              </select>
            </div>

            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-32" />
                      <div className="h-2.5 bg-gray-100 rounded w-48" />
                    </div>
                    <div className="h-5 bg-gray-100 rounded-full w-14" />
                  </div>
                ))}
              </div>
            ) : displayRequests.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-[13px] text-gray-400">신청 내역이 없습니다.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-[13px] text-primary-500 font-semibold hover:underline"
                >
                  휴가 신청하기
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {displayRequests.map(req => (
                  <div key={req.id} className="px-5 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {isAdmin && req.user && (
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-[12px] font-bold text-primary-600 flex-shrink-0 mt-0.5">
                            {req.user.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isAdmin && req.user && (
                              <span className="text-[13px] font-bold text-gray-900">{req.user.name}</span>
                            )}
                            <TypeBadge type={req.type} />
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-[12px] text-gray-500 mt-1">
                            {req.startDate} ~ {req.endDate}
                            <span className="ml-2 font-semibold text-gray-700">{req.days}일</span>
                          </p>
                          {req.reason && (
                            <p className="text-[12px] text-gray-400 mt-0.5 truncate">사유: {req.reason}</p>
                          )}
                          {req.rejectReason && (
                            <p className="text-[12px] text-red-500 mt-0.5">반려: {req.rejectReason}</p>
                          )}
                          {req.approver && req.status === 'approved' && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              승인자: {req.approver.name}
                              {req.approvedAt ? ` · ${format(new Date(req.approvedAt), 'M/d', { locale: ko })}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* 관리자 승인/반려 */}
                        {isAdmin && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate(req.id)}
                              title="승인"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              title="반려"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {/* 본인 취소 */}
                        {req.user?.id === user?.id && req.status === 'pending' && (
                          <button
                            onClick={() => { if (window.confirm('신청을 취소할까요?')) cancelMutation.mutate(req.id); }}
                            title="취소"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {/* 관리자 삭제 (pending/rejected/cancelled만) */}
                        {isAdmin && req.status !== 'approved' && (
                          <button
                            onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(req.id); }}
                            title="삭제"
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <VacationForm onClose={() => setShowForm(false)} onSuccess={invalidate} />
      )}
      {showBalanceModal && isAdmin && (
        <BalanceModal
          users={users}
          year={year}
          onClose={() => setShowBalanceModal(false)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
