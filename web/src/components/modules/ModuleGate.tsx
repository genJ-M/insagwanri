'use client';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useIsModuleActive } from '@/hooks/useModules';
import { MODULE_MIN_PLAN, PLAN_LABEL } from '@/types/modules';

interface ModuleGateProps {
  moduleId: string;
  children: React.ReactNode;
  // 비활성 시 표시 방식: 'block'(전체 차단 UI) | 'hide'(완전 숨김)
  fallback?: 'block' | 'hide';
}

export default function ModuleGate({
  moduleId,
  children,
  fallback = 'block',
}: ModuleGateProps) {
  const isActive = useIsModuleActive(moduleId);

  if (isActive) return <>{children}</>;
  if (fallback === 'hide') return null;

  const minPlan = MODULE_MIN_PLAN[moduleId] ?? 'pro';
  const planLabel = PLAN_LABEL[minPlan] ?? minPlan;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-5">
        <Lock className="w-7 h-7 text-zinc-400" />
      </div>

      <h2 className="text-xl font-bold text-text-primary mb-2">
        이 기능은 잠금 상태입니다
      </h2>
      <p className="text-sm text-text-secondary mb-1 max-w-sm">
        현재 플랜에서는 이 모듈을 사용할 수 없습니다.
      </p>
      <p className="text-sm text-text-muted mb-6">
        <span className="font-semibold text-primary-600">{planLabel} 플랜</span> 이상에서 사용 가능합니다.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/subscription"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700
                     text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          플랜 업그레이드
        </Link>
        <Link
          href="/settings?tab=modules"
          className="inline-flex items-center gap-2 bg-white border border-border
                     text-text-secondary text-sm font-medium px-5 py-2.5 rounded-xl
                     hover:bg-zinc-50 transition-colors"
        >
          모듈 설정 보기
        </Link>
      </div>
    </div>
  );
}
