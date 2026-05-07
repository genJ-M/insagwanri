'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowLeft, Puzzle, Search } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useModuleStatus } from '@/hooks/useModules';
import ModuleCard from '@/components/modules/ModuleCard';
import IndustryPresetSelector from '@/components/modules/IndustryPresetSelector';
import { ModuleStatus } from '@/types/modules';

// ── 그룹 표시 순서 ────────────────────────────────────────────────────────────

const GROUP_ORDER = ['attendance', 'work', 'hr', 'payroll', 'communication', 'advanced'];

const GROUP_LABEL: Record<string, string> = {
  attendance:    '근태 관리',
  work:          '업무·일정',
  hr:            'HR 관리',
  payroll:       '급여·세무',
  communication: '소통·검색',
  advanced:      '고급 기능',
};

// ── 현재 구독 플랜 조회 훅 ────────────────────────────────────────────────────

function useCurrentPlan() {
  return useQuery({
    queryKey: ['subscription', 'plan-name'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/current');
      return (data.data?.plan_name ?? 'free') as string;
    },
    staleTime: 5 * 60_000,
  });
}

// ── 프리셋 목록 조회 ──────────────────────────────────────────────────────────

function usePresets() {
  return useQuery({
    queryKey: ['feature-modules', 'presets'],
    queryFn: async () => {
      const { data } = await api.get('/feature-modules/presets');
      return data.data;
    },
    staleTime: 30 * 60_000,
  });
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function ModulesSettingsPage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner';
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | 'all'>('all');

  const { data: modules = [], isLoading } = useModuleStatus();
  const { data: planName = 'free' } = useCurrentPlan();
  const { data: presets = [] } = usePresets();

  // 검색 + 그룹 필터
  const filtered = useMemo(() => {
    return modules.filter((m) => {
      const matchSearch =
        !search ||
        m.name.includes(search) ||
        m.description.includes(search) ||
        m.id.includes(search);
      const matchGroup = activeGroup === 'all' || m.group === activeGroup;
      return matchSearch && matchGroup;
    });
  }, [modules, search, activeGroup]);

  // 그룹별 분류
  const grouped = useMemo(() => {
    const map: Record<string, ModuleStatus[]> = {};
    for (const m of filtered) {
      if (!map[m.group]) map[m.group] = [];
      map[m.group].push(m);
    }
    return map;
  }, [filtered]);

  const activeCount = modules.filter((m) => m.isActive).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-4 md:p-6 max-w-4xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/settings"
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-text-muted hover:text-text-primary"
            aria-label="설정으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg font-bold text-text-primary">모듈 관리</h1>
          </div>
          <span className="ml-auto text-xs text-text-muted bg-zinc-100 px-2 py-1 rounded-lg">
            {activeCount} / {modules.length} 활성
          </span>
        </div>

        {/* 업종 프리셋 (owner only) */}
        {isOwner && presets.length > 0 && (
          <section className="mb-8">
            <div className="mb-3">
              <h2 className="text-[13px] font-semibold text-text-primary">업종별 빠른 설정</h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                업종을 선택하면 해당 업종에 맞는 모듈이 자동으로 활성화됩니다.
              </p>
            </div>
            <IndustryPresetSelector presets={presets} currentPlanName={planName} />
          </section>
        )}

        {/* 플랜 안내 */}
        <div className="mb-6 p-3 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-between gap-4">
          <p className="text-[12px] text-primary-800">
            현재 플랜: <span className="font-bold capitalize">{planName}</span>
            {' — '}모듈 잠금 해제는 플랜 업그레이드가 필요합니다.
          </p>
          <Link
            href="/subscription"
            className="text-[11px] font-semibold text-primary-700 hover:text-primary-900 whitespace-nowrap"
          >
            플랜 변경 →
          </Link>
        </div>

        {/* 검색 + 그룹 필터 */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="모듈 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {['all', ...GROUP_ORDER].map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={clsx(
                  'whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-colors flex-shrink-0',
                  activeGroup === g
                    ? 'bg-primary-500 text-white'
                    : 'bg-white border border-border text-text-secondary hover:bg-zinc-50',
                )}
              >
                {g === 'all' ? '전체' : GROUP_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        {/* 모듈 카드 그룹별 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-muted text-sm">
            불러오는 중...
          </div>
        ) : (
          <div className="space-y-7">
            {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
              <section key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-[12px] font-bold text-text-secondary uppercase tracking-wide">
                    {GROUP_LABEL[group]}
                  </h2>
                  <span className="text-[10px] text-text-muted">
                    {grouped[group].filter((m) => m.isActive).length}/{grouped[group].length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {grouped[group].map((module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      currentPlanName={planName}
                      isOwner={isOwner}
                    />
                  ))}
                </div>
              </section>
            ))}

            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-12 text-text-muted text-sm">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
