'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import { toast } from 'react-hot-toast';

interface Company {
  id: string;
  name: string;
  owner_email: string;
  service_status: string;
  plan_name: string;
  plan_display_name: string;
  subscription_status: string;
  employee_count: number;
  next_billing_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  active_subscriptions: number;
  mrr_krw: number;
  past_due: number;
  new_this_month: number;
}

const SERVICE_STATUS_OPTS = [
  { value: '', label: '서비스 상태 전체' },
  { value: 'active', label: '활성' },
  { value: 'suspended', label: '정지' },
  { value: 'canceled', label: '해지' },
];

const PLAN_OPTS = [
  { value: '', label: '플랜 전체' },
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [serviceStatus, setServiceStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [actionModal, setActionModal] = useState<{ company: Company; type: 'suspend' | 'activate' } | null>(null);
  const [reason, setReason] = useState('');
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['company-stats'],
    queryFn: async () => {
      const res = await api.get('/companies/stats');
      return res.data.data as Stats;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, serviceStatus, plan, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(serviceStatus && { serviceStatus }),
        ...(plan && { plan }),
        page: String(page),
        limit: '20',
      });
      const res = await api.get(`/companies?${params}`);
      return res.data as { data: Company[]; meta: { total: number; totalPages: number } };
    },
    placeholderData: (prev) => prev,
  });

  const serviceStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason: string }) =>
      api.patch(`/companies/${id}/service-status`, { status, reason }),
    onSuccess: () => {
      toast.success('서비스 상태가 변경되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company-stats'] });
      setActionModal(null);
      setReason('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '변경에 실패했습니다.'),
  });

  const handleAction = () => {
    if (!actionModal) return;
    if (!reason.trim()) return toast.error('사유를 입력해 주세요.');
    serviceStatusMutation.mutate({
      id: actionModal.company.id,
      status: actionModal.type === 'suspend' ? 'suspended' : 'active',
      reason,
    });
  };

  const handleImpersonate = async (companyId: string, companyName: string) => {
    if (!confirm(`[${companyName}]의 owner 권한으로 임시 접속합니다. (30분 TTL)\n계속하시겠습니까?`)) return;
    setImpersonating(companyId);
    try {
      const res = await api.post(`/companies/${companyId}/impersonate`);
      const { accessToken } = res.data.data;
      const frontendUrl = process.env.NEXT_PUBLIC_CUSTOMER_FRONTEND_URL ?? 'https://insagwanri-nine.vercel.app';
      window.open(`${frontendUrl}/impersonate?token=${accessToken}`, '_blank');
      toast.success('임시 접속 토큰이 발급되었습니다.');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? '임시 접속 토큰 발급에 실패했습니다.');
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">고객 회사 관리</h1>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="전체 회사" value={stats.total.toLocaleString()} color="blue" />
          <StatCard label="활성 구독" value={stats.active_subscriptions.toLocaleString()} color="green" />
          <StatCard
            label="월간 매출 (MRR)"
            value={`${Math.round(stats.mrr_krw / 10000).toLocaleString()}만원`}
            color="purple"
          />
          <StatCard label="미납" value={stats.past_due.toLocaleString()} color="orange" />
          <StatCard label="이달 신규" value={stats.new_this_month.toLocaleString()} color="blue" />
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="회사명 또는 이메일 검색"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={serviceStatus}
          onChange={(e) => { setServiceStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SERVICE_STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={plan}
          onChange={(e) => { setPlan(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PLAN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">회사명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">오너 이메일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">플랜</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">구독</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">서비스</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">직원</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">다음결제</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">데이터가 없습니다.</td></tr>
            ) : (
              (data?.data ?? []).map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.subscription_status === 'past_due' ? 'bg-orange-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.owner_email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-700">{c.plan_display_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.subscription_status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.service_status} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{c.employee_count}명</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.next_billing_at
                      ? new Date(c.next_billing_at).toLocaleDateString('ko-KR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {c.service_status === 'active' ? (
                        <button
                          onClick={() => setActionModal({ company: c, type: 'suspend' })}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          정지
                        </button>
                      ) : c.service_status === 'suspended' ? (
                        <button
                          onClick={() => setActionModal({ company: c, type: 'activate' })}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          활성화
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleImpersonate(c.id, c.name)}
                        disabled={impersonating === c.id}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40"
                        title="임시 접속 (30분)"
                      >
                        {impersonating === c.id ? '...' : '임시접속'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              총 {data.meta.total.toLocaleString()}개
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                이전
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 서비스 상태 변경 모달 */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              서비스 {actionModal.type === 'suspend' ? '정지' : '활성화'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{actionModal.company.name}</strong>의 서비스를{' '}
              {actionModal.type === 'suspend' ? '정지' : '활성화'}합니다.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유를 입력해 주세요 (필수)"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setActionModal(null); setReason(''); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleAction}
                disabled={serviceStatusMutation.isPending}
                className={`flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                  actionModal.type === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {serviceStatusMutation.isPending ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
