'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useModulesStore } from '@/store/modules.store';
import { useAuthStore } from '@/store/auth.store';
import { ModuleStatus, ModuleId, MODULE_MIN_PLAN } from '@/types/modules';

// ── 활성 모듈 ID 목록 fetch + 스토어 동기화 ──────────────────────────────────

export function useModules() {
  const { isAuthenticated } = useAuthStore();
  const { setActiveModules, isModuleActive, hydrated } = useModulesStore();

  const query = useQuery<string[]>({
    queryKey: ['feature-modules', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/feature-modules/active');
      return data.data as string[];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,  // 5분 캐시
    gcTime: 10 * 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setActiveModules(query.data);
    }
  }, [query.data, setActiveModules]);

  return {
    activeModuleIds: query.data ?? [],
    isModuleActive,
    hydrated,
    isLoading: query.isLoading,
  };
}

// ── 전체 모듈 상태 목록 (설정 페이지용) ──────────────────────────────────────

export function useModuleStatus() {
  const { isAuthenticated } = useAuthStore();

  return useQuery<ModuleStatus[]>({
    queryKey: ['feature-modules', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/feature-modules');
      return data.data as ModuleStatus[];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

// ── 특정 모듈 활성 여부 (동기, 스토어 기반) ──────────────────────────────────

export function useIsModuleActive(moduleId: ModuleId | string): boolean {
  return useModulesStore((s) => s.isModuleActive(moduleId));
}

// ── 모듈이 비활성일 때 필요한 플랜 안내 ──────────────────────────────────────

export function useModuleUpgradeInfo(moduleId: string) {
  const isActive = useIsModuleActive(moduleId);
  const minPlan = MODULE_MIN_PLAN[moduleId] ?? 'pro';
  return { isActive, minPlan };
}
