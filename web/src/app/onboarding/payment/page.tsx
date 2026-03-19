'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      widgets: (options: { customerKey: string }) => {
        renderPaymentMethodWidget: (selector: string, options: { variantKey?: string }) => Promise<void>;
        requestBillingAuth: (method: string, options: {
          successUrl: string;
          failUrl: string;
        }) => Promise<void>;
      };
    };
  }
}

export default function PaymentRegistrationPage() {
  const router = useRouter();
  const widgetRef = useRef<ReturnType<ReturnType<typeof window.TossPayments>['widgets']> | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: keyData } = useQuery({
    queryKey: ['toss-client-key'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/toss/client-key');
      return res.data.data as { clientKey: string; customerKey: string };
    },
  });

  // Toss Payments SDK 동적 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // SDK + clientKey 준비되면 위젯 렌더링 (customerKey는 서버에서 반환된 companyId 사용)
  useEffect(() => {
    if (!sdkReady || !keyData?.clientKey || !keyData?.customerKey) return;

    const tossPayments = window.TossPayments(keyData.clientKey);
    const widgets = tossPayments.widgets({ customerKey: keyData.customerKey });
    widgetRef.current = widgets;

    widgets.renderPaymentMethodWidget('#payment-method-widget', {}).catch(() => {
      toast.error('결제 위젯을 불러오는 데 실패했습니다.');
    });
  }, [sdkReady, keyData]);

  // 성공/실패 URL 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authKey = params.get('authKey');
    const customerKey = params.get('customerKey');
    const code = params.get('code');

    if (code) {
      // 실패 콜백
      toast.error('카드 등록이 취소되었습니다.');
      return;
    }

    if (authKey && customerKey) {
      // 성공 콜백 — 서버에 빌링키 발급 요청
      setIsLoading(true);
      api
        .post('/subscriptions/toss/billing-key', { authKey, customerKey })
        .then(() => {
          toast.success('카드가 등록되었습니다.');
          router.push('/onboarding/plan');
        })
        .catch((err) => {
          toast.error(err.response?.data?.message ?? '카드 등록에 실패했습니다.');
          setIsLoading(false);
        });
    }
  }, [router]);

  const handleSubmit = async () => {
    if (!widgetRef.current) return;
    try {
      const origin = window.location.origin;
      await widgetRef.current.requestBillingAuth('카드', {
        successUrl: `${origin}/onboarding/payment`,
        failUrl: `${origin}/onboarding/payment`,
      });
    } catch {
      toast.error('카드 등록 요청 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">카드 등록</h1>
          <p className="text-gray-500 mt-1 text-sm">
            정기 결제에 사용할 카드를 등록합니다.
          </p>
        </div>

        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 카드 정보는 Toss Payments가 안전하게 보관합니다.</li>
            <li>• 등록 시 카드 유효성 확인을 위해 1원이 결제되었다가 즉시 환불됩니다.</li>
            <li>• 등록 후 언제든지 카드를 변경하거나 삭제할 수 있습니다.</li>
          </ul>
        </div>

        {/* Toss 결제 위젯 마운트 지점 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6 min-h-[200px]">
          {!sdkReady && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          )}
          <div id="payment-method-widget" />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            disabled={isLoading}
            className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            뒤로
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sdkReady || isLoading}
            className="flex-2 bg-blue-600 text-white py-3 px-8 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '처리 중...' : '카드 등록하기'}
          </button>
        </div>

        {/* 보안 뱃지 */}
        <p className="text-center text-xs text-gray-400 mt-4">
          결제 정보는 SSL로 암호화되어 안전하게 처리됩니다.
        </p>
      </div>
    </div>
  );
}
