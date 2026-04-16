'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

/**
 * 페이지 가시성 가드 훅
 * 해당 pageKey가 내 가시성 설정에서 false이면 /dashboard로 리다이렉트
 *
 * 사용 예시:
 *   const { isAllowed, isLoading } = usePageGuard('/salary');
 */
export function usePageGuard(pageKey: string) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: visibilityMap, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ['page-visibility', user?.id],
    queryFn: () =>
      api.get('/calendar-settings/visibility/my').then((r) => r.data.data as Record<string, boolean>),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  const isAllowed = !visibilityMap || visibilityMap[pageKey] !== false;

  useEffect(() => {
    if (!isLoading && visibilityMap && visibilityMap[pageKey] === false) {
      router.replace('/');
    }
  }, [isLoading, visibilityMap, pageKey, router]);

  return { isAllowed, isLoading: isLoading || !visibilityMap };
}
