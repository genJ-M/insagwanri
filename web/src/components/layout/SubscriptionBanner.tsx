'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock } from 'lucide-react';
import api from '@/lib/api';

/**
 * 구독 상태 안내 배너 — 대시보드 모든 페이지 상단에 표시.
 *  - expired (체험 만료): 빨간 배너 + 결제 또는 무료 플랜 전환 유도
 *  - trialing (체험 중): 파란 배너 + 종료일 표시 + 결제 유도
 *  - past_due (결제 실패): 빨간 배너 + 카드 변경 유도
 * /billing, /subscription, /onboarding/* 페이지에서는 자체 안내가 있으므로 숨김.
 */
export default function SubscriptionBanner() {
  const pathname = usePathname();

  // 배너 자체 안내가 있는 페이지에서는 숨김
  const skip =
    pathname?.startsWith('/billing') ||
    pathname?.startsWith('/subscription') ||
    pathname?.startsWith('/onboarding');
  // hooks 순서를 유지하기 위해 useQuery는 항상 호출
  const { data } = useQuery<{
    currentSubscription: {
      status: string;
      plan_name: string;
      plan_display_name: string;
      trial_end_at: string | null;
    } | null;
  }>({
    queryKey: ['subscription-banner'],
    queryFn: () => api.get('/subscriptions/plans').then((r) => r.data.data),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: !skip,
  });

  if (skip) return null;
  const sub = data?.currentSubscription;
  if (!sub) return null;
  if (sub.plan_name === 'free') return null;

  if (sub.status === 'expired') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
        <p className="text-sm text-red-800 flex-1">
          <strong>{sub.plan_display_name} 무료 체험이 종료되어 서비스가 일시 정지되었습니다.</strong>{' '}
          결제하거나 무료 플랜으로 전환하세요.
        </p>
        <Link
          href="/billing"
          className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex-shrink-0"
        >
          결제 관리 →
        </Link>
      </div>
    );
  }

  if (sub.status === 'trialing' && sub.trial_end_at) {
    const endDate = new Date(sub.trial_end_at);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));
    if (daysRemaining > 7) return null; // 7일 이하 남았을 때만 노출
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center gap-3">
        <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800 flex-1">
          <strong>무료 체험 {daysRemaining}일 남음</strong> · {endDate.toLocaleDateString('ko-KR')}에 종료
          {' '}— 자동결제는 진행되지 않습니다. 종료 전 결제하거나 무료 플랜으로 전환하세요.
        </p>
        <Link
          href="/billing"
          className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          결제 관리 →
        </Link>
      </div>
    );
  }

  if (sub.status === 'past_due') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          <strong>자동결제 실패</strong> — 카드 정보를 확인해 주세요.
        </p>
        <Link
          href="/billing"
          className="text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
        >
          카드 관리 →
        </Link>
      </div>
    );
  }

  return null;
}
