'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatusBadge from '@/components/admin/StatusBadge';
import { toast } from 'react-hot-toast';

interface Subscription {
  id: string;
  company_name: string;
  plan_display_name: string;
  status: string;
  billing_cycle: string;
  next_billing_at: string | null;
  trial_end_at: string | null;
  retry_count: number;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string;
}

const TAB_OPTS = [
  { key: 'all', label: '전체' },
  { key: 'past_due', label: '미납' },
  { key: 'trialing', label: '체험중' },
  { key: 'active', label: '활성' },
];

const PLAN_OPTS = [
  { value: '', label: '플랜 전체' },
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [plan, setPlan] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [page, setPage] = useState(1);
  const [trialModal, setTrialModal] = useState<Subscription | null>(null);
  const [trialDays, setTrialDays] = useState('7');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', tab, plan, billingCycle, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(tab !== 'all' && { status: tab }),
        ...(plan && { plan }),
        ...(billingCycle && { billingCycle }),
        page: String(page),
        limit: '20',
      });
      const res = await api.get(`/subscriptions?${params}`);
      return res.data as { data: Subscription[]; meta: { total: number; totalPages: number } };
    },
    placeholderData: (prev) => prev,
  });

  const extendTrialMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.post(`/subscriptions/${id}/extend-trial`, { days }),
    onSuccess: () => {
      toast.success('체험 기간이 연장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setTrialModal(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '처리에 실패했습니다.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/subscriptions/${id}/cancel`, { cancelAtPeriodEnd: true }),
    onSuccess: () => {
      toast.success('구독 해지가 예약되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '처리에 실패했습니다.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/subscriptions/${id}/reactivate`),
    onSuccess: () => {
      toast.success('구독이 재활성화되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '처리에 실패했습니다.'),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">구독 관리</h1>

      {/* 탭 + 필터 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TAB_OPTS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={plan}
          onChange={(e) => { setPlan(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PLAN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={billingCycle}
          onChange={(e) => { setBillingCycle(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">결제주기 전체</option>
          <option value="monthly">월간</option>
          <option value="yearly">연간</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">회사</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">플랜</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">구독 상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">결제 주기</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">다음 결제</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">재시도</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">데이터가 없습니다.</td></tr>
            ) : (
              (data?.data ?? []).map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.status === 'past_due' ? 'bg-orange-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.company_name}</td>
                  <td className="px-4 py-3 text-gray-700">{s.plan_display_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                    {s.cancel_at_period_end && (
                      <span className="ml-1 text-xs text-orange-600">해지예정</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.billing_cycle} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.next_billing_at
                      ? new Date(s.next_billing_at).toLocaleDateString('ko-KR')
                      : s.trial_end_at
                      ? `체험 ~${new Date(s.trial_end_at).toLocaleDateString('ko-KR')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.retry_count > 0 ? (
                      <span className="text-orange-600 font-medium">{s.retry_count}회</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {s.status === 'trialing' && (
                        <button
                          onClick={() => setTrialModal(s)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          체험연장
                        </button>
                      )}
                      {s.status === 'active' && !s.cancel_at_period_end && (
                        <button
                          onClick={() => {
                            if (confirm('구독을 해지 예약하시겠습니까?')) cancelMutation.mutate(s.id);
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          해지예약
                        </button>
                      )}
                      {(s.status === 'suspended' || s.cancel_at_period_end) && (
                        <button
                          onClick={() => {
                            if (confirm('구독을 재활성화하시겠습니까?')) reactivateMutation.mutate(s.id);
                          }}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          재활성화
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">총 {data.meta.total.toLocaleString()}개</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">이전</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 체험 연장 모달 */}
      {trialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">체험 기간 연장</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{trialModal.company_name}</strong>의 체험 기간을 연장합니다.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                min="1" max="90"
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">일 연장</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setTrialModal(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button
                onClick={() => extendTrialMutation.mutate({ id: trialModal.id, days: Number(trialDays) })}
                disabled={extendTrialMutation.isPending}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {extendTrialMutation.isPending ? '처리 중...' : '연장 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
