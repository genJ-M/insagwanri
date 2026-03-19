'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly_krw: number;
  price_yearly_krw: number;
  yearly_discount_rate: number;
  max_employees: number;
  ai_requests_per_day: number;
  storage_limit_gb: number;
  features: string[];
  trial_days: number;
  sort_order: number;
}

interface PaymentMethod {
  id: string;
  card_number_masked: string;
  card_issuer: string;
  card_brand: string;
  card_expiry_year: string;
  card_expiry_month: string;
  is_default: boolean;
}

interface CurrentSubscription {
  plan_name: string;
  plan_display_name: string;
  status: string;
  billing_cycle: string;
}

const CYCLE_LABEL: Record<string, string> = {
  monthly: '월간',
  yearly: '연간',
};

const SESSION_KEY = 'onboarding_plan_state';

export default function PlanSelectionPage() {
  const router = useRouter();

  // sessionStorage에서 이전 상태 복원 (뒤로 가기 시 유지)
  const restoreState = () => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };
  const saved = restoreState();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(saved?.billingCycle ?? 'monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(saved?.selectedPlanId ?? null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(saved?.selectedPaymentMethodId ?? null);
  const [couponCode, setCouponCode] = useState<string>(saved?.couponCode ?? '');

  // 상태 변경마다 sessionStorage 동기화
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ billingCycle, selectedPlanId, selectedPaymentMethodId, couponCode }));
    } catch {}
  }, [billingCycle, selectedPlanId, selectedPaymentMethodId, couponCode]);

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data as { currentSubscription: CurrentSubscription | null; plans: Plan[] };
    },
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/payment-methods');
      return res.data.data as PaymentMethod[];
    },
  });

  // 기본 결제 수단 자동 선택
  useEffect(() => {
    if (paymentMethods && !selectedPaymentMethodId) {
      const def = paymentMethods.find((m) => m.is_default);
      if (def) setSelectedPaymentMethodId(def.id);
    }
  }, [paymentMethods, selectedPaymentMethodId]);

  const upgradeMutation = useMutation({
    mutationFn: (vars: { planId: string; paymentMethodId: string; couponCode?: string }) =>
      api.post('/subscriptions/upgrade', {
        planId: vars.planId,
        paymentMethodId: vars.paymentMethodId,
        billingCycle,
        couponCode: vars.couponCode || undefined,
      }),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(`${d.plan} 플랜으로 전환되었습니다! (${Number(d.amount).toLocaleString()}원)`);
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      router.push('/subscription');
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message ?? '결제 중 오류가 발생했습니다.'),
  });

  const handleUpgrade = () => {
    if (!selectedPlanId) return toast.error('플랜을 선택해 주세요.');
    if (!selectedPaymentMethodId) return toast.error('결제 수단을 선택해 주세요.');
    upgradeMutation.mutate({
      planId: selectedPlanId,
      paymentMethodId: selectedPaymentMethodId,
      couponCode,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const plans = data?.plans ?? [];
  const currentSub = data?.currentSubscription;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">플랜 선택</h1>
          <p className="text-gray-500 mt-2">
            {currentSub
              ? `현재 ${currentSub.plan_display_name} 플랜 (${CYCLE_LABEL[currentSub.billing_cycle] ?? ''})을 이용 중입니다.`
              : '비즈니스에 맞는 플랜을 선택하세요.'}
          </p>
        </div>

        {/* 결제 주기 토글 */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            월간 결제
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              billingCycle === 'yearly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            연간 결제
            <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
              최대 20% 할인
            </span>
          </button>
        </div>

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {plans.map((plan) => {
            const price =
              billingCycle === 'yearly'
                ? plan.price_yearly_krw
                : plan.price_monthly_krw;
            const isSelected = selectedPlanId === plan.id;
            const isCurrent = currentSub?.plan_name === plan.name;

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`relative text-left rounded-xl border-2 p-5 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-200'
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    현재
                  </span>
                )}

                <h3 className="font-bold text-gray-900 text-base">{plan.display_name}</h3>

                <div className="mt-3 mb-4">
                  {price === 0 ? (
                    <span className="text-2xl font-bold text-gray-900">무료</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-gray-900">
                        {Number(price).toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">원/{billingCycle === 'yearly' ? '년' : '월'}</span>
                    </>
                  )}
                  {billingCycle === 'yearly' && plan.yearly_discount_rate > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">
                      {plan.yearly_discount_rate}% 할인 적용
                    </p>
                  )}
                </div>

                <ul className="space-y-1.5 text-sm text-gray-600">
                  <li>• 직원 최대 {plan.max_employees === 9999 ? '무제한' : `${plan.max_employees}명`}</li>
                  <li>• AI {plan.ai_requests_per_day === 0 ? '미제공' : `일 ${plan.ai_requests_per_day}회`}</li>
                  <li>• 저장공간 {plan.storage_limit_gb}GB</li>
                  {Array.isArray(plan.features) &&
                    plan.features.slice(0, 3).map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* 결제 수단 선택 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">결제 수단</h2>
            <button
              onClick={() => router.push('/onboarding/payment')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 카드 추가
            </button>
          </div>

          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <label
                  key={pm.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPaymentMethodId === pm.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={pm.id}
                    checked={selectedPaymentMethodId === pm.id}
                    onChange={() => setSelectedPaymentMethodId(pm.id)}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {pm.card_issuer} {pm.card_number_masked}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pm.card_expiry_year}/{pm.card_expiry_month}
                    </p>
                  </div>
                  {pm.is_default && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">기본</span>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">등록된 결제 수단이 없습니다.</p>
              <button
                onClick={() => router.push('/onboarding/payment')}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                카드 등록하기
              </button>
            </div>
          )}
        </div>

        {/* 쿠폰 코드 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-gray-800 mb-3">쿠폰 코드</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="쿠폰 코드 입력 (선택)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 결제 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            뒤로
          </button>
          <button
            onClick={handleUpgrade}
            disabled={!selectedPlanId || !selectedPaymentMethodId || upgradeMutation.isPending}
            className="flex-2 bg-blue-600 text-white py-3 px-8 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upgradeMutation.isPending ? '결제 처리 중...' : '결제하고 시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
