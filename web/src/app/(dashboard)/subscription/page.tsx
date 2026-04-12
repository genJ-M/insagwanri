'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';

// ── 타입 ──────────────────────────────────────────────────────────────────────

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
  auto_renew: boolean;
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

interface AddonItem {
  code: string;
  name: string;
  description: string;
  unit: string;
  priceMonthlyKrw: number;
  priceYearlyKrw: number;
  emoji: string;
}

interface ActiveAddon {
  id: string;
  addon_code: string;
  quantity: number;
  unit_price_krw: number;
  total_amount_krw: number;
  billing_cycle: string;
  status: string;
  active_from: string;
  active_until: string;
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing:  { label: '무료 체험 중', color: 'bg-primary-100 text-primary-600' },
  active:    { label: '구독 중',      color: 'bg-emerald-100 text-emerald-700' },
  past_due:  { label: '결제 실패',   color: 'bg-red-100 text-red-700' },
  suspended: { label: '정지됨',      color: 'bg-background text-text-secondary border border-border' },
  canceled:  { label: '해지됨',      color: 'bg-background text-text-muted border border-border' },
};

const INVOICE_STATUS: Record<string, string> = {
  completed: '결제 완료', failed: '결제 실패',
  refunded: '환불됨', partial_refunded: '부분 환불', canceled: '취소됨',
};

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR');
}

// ── 자동결제 토글 ─────────────────────────────────────────────────────────────

function AutoRenewToggle({ autoRenew, subStatus }: { autoRenew: boolean; subStatus: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: boolean) => api.patch('/subscriptions/auto-renew', { autoRenew: val }),
    onSuccess: (_, val) => {
      toast.success(val ? '자동결제가 활성화되었습니다.' : '자동결제가 비활성화되었습니다.');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '변경 중 오류가 발생했습니다.'),
  });

  const disabled = subStatus === 'canceled' || mutation.isPending;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary">자동결제</span>
      <button
        disabled={disabled}
        onClick={() => mutation.mutate(!autoRenew)}
        className={clsx(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
          autoRenew ? 'bg-emerald-500' : 'bg-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          autoRenew ? 'translate-x-4' : 'translate-x-0.5',
        )} />
      </button>
      <span className={clsx('text-xs font-medium', autoRenew ? 'text-emerald-600' : 'text-text-muted')}>
        {autoRenew ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

// ── 애드온 구매 모달 ──────────────────────────────────────────────────────────

function AddonModal({
  open,
  onClose,
  paymentMethods,
}: {
  open: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
}) {
  const qc = useQueryClient();
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    paymentMethods.find((p) => p.is_default)?.id ?? paymentMethods[0]?.id ?? '',
  );

  const { data: addons = [] } = useQuery<AddonItem[]>({
    queryKey: ['addon-catalog'],
    queryFn: () => api.get('/subscriptions/addons').then((r) => r.data.data),
    staleTime: Infinity,
  });

  const addon = addons.find((a) => a.code === selectedAddon);
  const unitPrice = addon
    ? (billingCycle === 'yearly' ? addon.priceYearlyKrw : addon.priceMonthlyKrw)
    : 0;
  const total = Math.round(unitPrice * quantity * 1.1); // VAT 포함

  const mutation = useMutation({
    mutationFn: () => api.post('/subscriptions/addons/purchase', {
      addonCode: selectedAddon,
      quantity,
      billingCycle,
      paymentMethodId,
    }),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(`${d.addonName} 구매 완료! (${Number(d.totalAmount).toLocaleString()}원)`);
      qc.invalidateQueries({ queryKey: ['active-addons'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '구매 중 오류가 발생했습니다.'),
  });

  return (
    <Modal open={open} onClose={onClose} title="추가 기능 구매" size="md">
      <div className="space-y-5">
        {/* 애드온 선택 */}
        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">추가할 기능 선택</p>
          <div className="space-y-2">
            {addons.map((a) => (
              <button
                key={a.code}
                onClick={() => setSelectedAddon(a.code)}
                className={clsx(
                  'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                  selectedAddon === a.code ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-gray-300',
                )}
              >
                <span className="text-2xl">{a.emoji}</span>
                <div className="flex-1">
                  <p className={clsx('text-sm font-medium', selectedAddon === a.code ? 'text-primary-700' : 'text-text-primary')}>
                    {a.name}
                  </p>
                  <p className="text-xs text-text-muted">{a.description}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    월 {a.priceMonthlyKrw.toLocaleString()}원 / 연 {a.priceYearlyKrw.toLocaleString()}원
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedAddon && (
          <>
            {/* 결제 주기 */}
            <div>
              <p className="text-sm font-semibold text-text-primary mb-2">결제 주기</p>
              <div className="flex gap-2">
                {(['monthly', 'yearly'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setBillingCycle(c)}
                    className={clsx(
                      'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                      billingCycle === c ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border text-text-secondary hover:bg-surface-2',
                    )}
                  >
                    {c === 'monthly' ? '월간' : '연간 (최대 17% 할인)'}
                  </button>
                ))}
              </div>
            </div>

            {/* 수량 */}
            <div>
              <p className="text-sm font-semibold text-text-primary mb-2">수량 ({addon?.unit})</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-surface-2"
                >
                  −
                </button>
                <span className="text-sm font-bold text-text-primary w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg hover:bg-surface-2"
                >
                  +
                </button>
              </div>
            </div>

            {/* 결제 수단 */}
            {paymentMethods.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-text-primary mb-2">결제 수단</p>
                <div className="space-y-2">
                  {paymentMethods.map((pm) => (
                    <label
                      key={pm.id}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                        paymentMethodId === pm.id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <input
                        type="radio"
                        checked={paymentMethodId === pm.id}
                        onChange={() => setPaymentMethodId(pm.id)}
                        className="text-primary-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{pm.card_issuer} {pm.card_number_masked}</p>
                        <p className="text-xs text-text-muted">{pm.card_expiry_year}/{pm.card_expiry_month}</p>
                      </div>
                      {pm.is_default && <span className="ml-auto text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">기본</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 최종 금액 */}
            <div className="bg-surface-2 rounded-xl p-4 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">공급가액</span>
                <span className="text-text-primary">{(unitPrice * quantity).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">부가세 (10%)</span>
                <span className="text-text-primary">{(total - unitPrice * quantity).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                <span className="text-text-primary">합계</span>
                <span className="text-primary-600 text-base">{total.toLocaleString()}원</span>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>취소</Button>
          <Button
            className="flex-1"
            disabled={!selectedAddon || !paymentMethodId || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            결제하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  usePageTitle('구독 관리');
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner';

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showAddonModal, setShowAddonModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data as { currentSubscription: Subscription | null; plans: any[] };
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await api.get('/subscriptions/invoices')).data.data as Invoice[],
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get('/subscriptions/payment-methods')).data.data as PaymentMethod[],
  });

  const { data: activeAddons = [] } = useQuery({
    queryKey: ['active-addons'],
    queryFn: async () => (await api.get('/subscriptions/addons/active')).data as ActiveAddon[],
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.post('/subscriptions/cancel', { reason, cancelAtPeriodEnd: true }),
    onSuccess: () => {
      toast.success('구독 해지가 예약되었습니다.');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowCancelModal(false);
    },
    onError: () => toast.error('해지 처리 중 오류가 발생했습니다.'),
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/payment-methods/${id}`),
    onSuccess: () => {
      toast.success('결제 수단이 삭제되었습니다.');
      qc.invalidateQueries({ queryKey: ['payment-methods'] });
      setDeleteTargetId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? '삭제 중 오류가 발생했습니다.');
      setDeleteTargetId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </div>
    );
  }

  const sub = data?.currentSubscription;
  const statusInfo = sub ? STATUS_LABEL[sub.status] ?? { label: sub.status, color: 'bg-background text-text-secondary' } : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-6 max-w-4xl">

        {/* 현재 구독 현황 */}
        <Card>
          <CardHeader title="현재 구독" description="플랜 변경, 자동결제, 결제 수단, 인보이스를 관리합니다." />
          {sub ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-text-primary">{sub.plan_display_name}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo?.color}`}>
                  {statusInfo?.label}
                </span>
              </div>

              {sub.status === 'trialing' && sub.daysRemaining !== null && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                  <p className="text-sm text-primary-700 font-medium">무료 체험 {Math.max(0, sub.daysRemaining)}일 남음</p>
                  <p className="text-xs text-primary-500 mt-1">체험 기간 종료 전에 유료 플랜으로 전환하세요.</p>
                  <Link href="/onboarding/plan" className="mt-3 inline-block bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors">
                    플랜 선택하기
                  </Link>
                </div>
              )}

              {sub.status === 'past_due' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-sm text-red-700 font-medium">결제에 실패했습니다</p>
                  <p className="text-xs text-red-500 mt-1">등록된 결제 수단으로 재시도가 진행됩니다 (D+1, D+3, D+7).</p>
                  <Link href="/onboarding/payment" className="mt-3 inline-block bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors">
                    결제 수단 변경
                  </Link>
                </div>
              )}

              {sub.status === 'active' && (
                <div className="grid grid-cols-2 gap-4 text-sm border border-border rounded-xl p-4 bg-background">
                  <div>
                    <p className="text-xs text-text-muted mb-1">결제 주기</p>
                    <p className="font-medium text-text-primary">{sub.billing_cycle === 'yearly' ? '연간 결제' : '월간 결제'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">다음 결제일</p>
                    <p className="font-medium text-text-primary">{formatDate(sub.next_billing_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">현재 기간 만료</p>
                    <p className="font-medium text-text-primary">{formatDate(sub.current_period_end)}</p>
                  </div>
                </div>
              )}

              {sub.cancel_at_period_end && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm text-amber-700">
                    현재 기간 종료({new Date(sub.current_period_end).toLocaleDateString('ko-KR')}) 후 해지 예정입니다.
                  </p>
                </div>
              )}

              {/* 액션 바: 자동결제 토글 + 플랜 변경 + 해지 */}
              {isOwner && (
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
                  {sub.status === 'active' && (
                    <AutoRenewToggle autoRenew={sub.auto_renew} subStatus={sub.status} />
                  )}
                  <div className="flex gap-3 ml-auto">
                    <Link
                      href="/onboarding/plan"
                      className="text-sm font-medium text-primary-500 hover:text-primary-600 border border-primary-200 px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      플랜 변경
                    </Link>
                    {sub.status === 'active' && !sub.cancel_at_period_end && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        구독 해지
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-text-secondary mb-4">구독 정보가 없습니다.</p>
              <Link href="/onboarding/plan" className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 text-sm font-medium transition-colors">
                플랜 선택하기
              </Link>
            </div>
          )}
        </Card>

        {/* 추가 기능 (애드온) */}
        {isOwner && sub && sub.status === 'active' && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardHeader title="추가 기능" />
                <p className="text-xs text-text-muted mt-0.5">직원 한도, 저장공간, AI 기능을 추가로 구매할 수 있습니다.</p>
              </div>
              <Button size="sm" onClick={() => setShowAddonModal(true)}>
                + 추가 결제
              </Button>
            </div>

            {activeAddons.length > 0 ? (
              <ul className="space-y-2">
                {activeAddons.map((a) => (
                  <li key={a.id} className="flex items-center justify-between p-3 border border-border rounded-xl bg-background text-sm">
                    <div>
                      <p className="font-medium text-text-primary">{a.addon_code.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-text-muted">
                        수량 {a.quantity} · {a.billing_cycle === 'yearly' ? '연간' : '월간'} · {formatDate(a.active_until)}까지
                      </p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">활성</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted text-center py-4">구매한 추가 기능이 없습니다.</p>
            )}
          </Card>
        )}

        {/* 결제 수단 */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardHeader title="결제 수단" />
            {isOwner && (
              <Link href="/onboarding/payment" className="text-sm font-medium text-primary-500 hover:text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                + 카드 추가
              </Link>
            )}
          </div>

          {paymentMethods.length > 0 ? (
            <ul className="space-y-3">
              {paymentMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-background transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 bg-background border border-border rounded flex items-center justify-center text-xs font-bold text-text-secondary">
                      {pm.card_brand ?? '카드'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{pm.card_issuer} {pm.card_number_masked}</p>
                      <p className="text-xs text-text-muted">{pm.card_expiry_year}/{pm.card_expiry_month}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pm.is_default && <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">기본</span>}
                    {isOwner && (
                      <button onClick={() => setDeleteTargetId(pm.id)} className="text-xs text-text-muted hover:text-red-500 transition-colors">
                        삭제
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted text-center py-6">등록된 결제 수단이 없습니다.</p>
          )}
        </Card>

        {/* 인보이스 */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-border">
            <CardHeader title="결제 내역" />
          </div>
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['인보이스', '기간', '금액', '상태', '결제일'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/60 hover:bg-background transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">{inv.invoice_number}</td>
                      <td className="px-4 py-3.5 text-sm text-text-secondary">
                        {formatDate(inv.billing_period_start)} ~ {formatDate(inv.billing_period_end)}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-text-primary text-right">
                        {Number(inv.total_amount_krw).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {INVOICE_STATUS[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-muted">{formatDate(inv.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">결제 내역이 없습니다.</p>
          )}
        </Card>
      </main>

      {/* 카드 삭제 confirm */}
      <Modal open={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} title="결제 수단 삭제" size="sm">
        <p className="text-sm text-text-secondary mb-5">이 카드를 삭제하시겠습니까?</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTargetId(null)}>취소</Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={deletePaymentMethodMutation.isPending}
            onClick={() => deleteTargetId && deletePaymentMethodMutation.mutate(deleteTargetId)}
          >
            삭제
          </Button>
        </div>
      </Modal>

      {/* 해지 모달 */}
      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="구독 해지" size="sm">
        <p className="text-sm text-text-secondary mb-4">현재 기간 종료 후 해지됩니다. 데이터는 30일간 보존됩니다.</p>
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="해지 사유를 입력해 주세요 (선택)"
          rows={3}
          className="input resize-none mb-4"
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setShowCancelModal(false)}>취소</Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate(cancelReason || '사유 미입력')}
          >
            해지 확인
          </Button>
        </div>
      </Modal>

      {/* 애드온 구매 모달 */}
      <AddonModal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
