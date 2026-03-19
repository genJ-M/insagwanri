'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Subscription {
  id: string;
  status: string;
  plan_name: string;
  plan_display_name: string;
  billing_cycle: string;
  current_period_end: string;
  trial_end_at: string | null;
  daysRemaining: number | null;
  cancel_at_period_end: boolean;
  next_billing_at: string | null;
  price_monthly_krw: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount_krw: number;
  billing_period_start: string;
  billing_period_end: string;
  paid_at: string | null;
  billing_cycle: string;
}

interface PaymentMethod {
  id: string;
  method_type: string;
  card_number_masked: string;
  card_issuer: string;
  card_brand: string;
  card_expiry_year: string;
  card_expiry_month: string;
  is_default: boolean;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing:  { label: '무료 체험 중', color: 'bg-blue-100 text-blue-700' },
  active:    { label: '구독 중', color: 'bg-green-100 text-green-700' },
  past_due:  { label: '결제 실패', color: 'bg-red-100 text-red-700' },
  suspended: { label: '정지됨', color: 'bg-gray-100 text-gray-700' },
  canceled:  { label: '해지됨', color: 'bg-gray-100 text-gray-500' },
};

const INVOICE_STATUS: Record<string, string> = {
  completed:        '결제 완료',
  failed:           '결제 실패',
  refunded:         '환불됨',
  partial_refunded: '부분 환불',
  canceled:         '취소됨',
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

export default function SubscriptionPage() {
  usePageTitle('구독 관리');
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data as { currentSubscription: Subscription | null; plans: any[] };
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/invoices');
      return res.data.data as Invoice[];
    },
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/payment-methods');
      return res.data.data as PaymentMethod[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post('/subscriptions/cancel', { reason, cancelAtPeriodEnd: true }),
    onSuccess: () => {
      toast.success('구독 해지가 예약되었습니다. 현재 기간 종료 후 해지됩니다.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowCancelModal(false);
    },
    onError: () => toast.error('해지 처리 중 오류가 발생했습니다.'),
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/payment-methods/${id}`),
    onSuccess: () => {
      toast.success('결제 수단이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setDeleteTargetId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? '삭제 중 오류가 발생했습니다.');
      setDeleteTargetId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const sub = data?.currentSubscription;
  const statusInfo = sub ? STATUS_LABEL[sub.status] ?? { label: sub.status, color: 'bg-gray-100 text-gray-700' } : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
        <p className="text-gray-500 mt-1">플랜 변경, 결제 수단, 인보이스를 관리합니다.</p>
      </div>

      {/* 현재 구독 현황 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">현재 구독</h2>
        {sub ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-900">{sub.plan_display_name}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo?.color}`}>
                {statusInfo?.label}
              </span>
            </div>

            {sub.status === 'trialing' && sub.daysRemaining !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-medium">
                  무료 체험 {Math.max(0, sub.daysRemaining)}일 남음
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  체험 기간 종료 전에 유료 플랜으로 전환하세요.
                </p>
                <Link
                  href="/onboarding/plan"
                  className="mt-3 inline-block bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  플랜 선택하기
                </Link>
              </div>
            )}

            {sub.status === 'past_due' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium">결제에 실패했습니다</p>
                <p className="text-xs text-red-600 mt-1">
                  등록된 결제 수단으로 재시도가 진행됩니다 (D+1, D+3, D+7).
                  결제가 계속 실패하면 서비스가 정지될 수 있습니다.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/onboarding/payment"
                    className="inline-block bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-700"
                  >
                    결제 수단 변경
                  </Link>
                </div>
              </div>
            )}

            {sub.status === 'suspended' && (
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 font-medium">서비스가 정지되었습니다</p>
                <p className="text-xs text-gray-600 mt-1">
                  결제 수단을 업데이트하거나 플랜을 선택하면 즉시 재개됩니다.
                </p>
                <Link
                  href="/onboarding/plan"
                  className="mt-3 inline-block bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-900"
                >
                  플랜 선택하기
                </Link>
              </div>
            )}

            {sub.status === 'active' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">결제 주기</span>
                  <p className="font-medium text-gray-900 mt-1">
                    {sub.billing_cycle === 'yearly' ? '연간 결제' : '월간 결제'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">다음 결제일</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(sub.next_billing_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500">현재 기간 만료</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(sub.current_period_end)}</p>
                </div>
              </div>
            )}

            {sub.cancel_at_period_end && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  현재 기간 종료({new Date(sub.current_period_end).toLocaleDateString('ko-KR')}) 후 해지 예정입니다.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {sub.status === 'active' && (
                <p className="text-xs text-gray-400">
                  플랜 변경 시 현재 기간 잔여 금액이 일할 계산되어 적용됩니다. 변경은 즉시 반영됩니다.
                </p>
              )}
              <div className="flex gap-3">
              <Link
                href="/onboarding/plan"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50"
              >
                플랜 변경
              </Link>
              {sub.status === 'active' && !sub.cancel_at_period_end && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50"
                >
                  구독 해지
                </button>
              )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">구독 정보가 없습니다.</p>
            <Link href="/onboarding/plan" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              플랜 선택하기
            </Link>
          </div>
        )}
      </section>

      {/* 결제 수단 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">결제 수단</h2>
          <Link
            href="/onboarding/payment"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            + 카드 추가
          </Link>
        </div>

        {paymentMethods && paymentMethods.length > 0 ? (
          <ul className="space-y-3">
            {paymentMethods.map((pm) => (
              <li key={pm.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-600">
                    {pm.card_brand ?? '카드'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {pm.card_issuer} {pm.card_number_masked}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pm.card_expiry_year}/{pm.card_expiry_month}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pm.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">기본</span>
                  )}
                  <button
                    onClick={() => setDeleteTargetId(pm.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">등록된 결제 수단이 없습니다.</p>
        )}
      </section>

      {/* 인보이스 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">결제 내역</h2>
        {invoices && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-3 font-medium text-gray-500">인보이스</th>
                  <th className="pb-3 font-medium text-gray-500">기간</th>
                  <th className="pb-3 font-medium text-gray-500 text-right">금액</th>
                  <th className="pb-3 font-medium text-gray-500">상태</th>
                  <th className="pb-3 font-medium text-gray-500">결제일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="py-3">
                    <td className="py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                    <td className="py-3 text-gray-600">
                      {formatDate(inv.billing_period_start)} ~ {formatDate(inv.billing_period_end)}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {Number(inv.total_amount_krw).toLocaleString()}원
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        inv.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {INVOICE_STATUS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">{formatDate(inv.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">결제 내역이 없습니다.</p>
        )}
      </section>

      {/* 카드 삭제 confirm */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-2">결제 수단 삭제</h3>
            <p className="text-sm text-gray-600 mb-5">이 카드를 삭제하시겠습니까? 기본 결제 수단인 경우 구독 갱신에 영향을 줄 수 있습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => deletePaymentMethodMutation.mutate(deleteTargetId)}
                disabled={deletePaymentMethodMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletePaymentMethodMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 해지 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">구독 해지</h3>
            <p className="text-sm text-gray-600 mb-4">
              현재 기간 종료 후 해지됩니다. 데이터는 30일간 보존됩니다.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="해지 사유를 입력해 주세요 (선택)"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelReason || '사유 미입력')}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? '처리 중...' : '해지 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
