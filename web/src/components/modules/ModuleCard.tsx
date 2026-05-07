'use client';
import { Lock, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ModuleStatus } from '@/types/modules';
import { MODULE_MIN_PLAN, PLAN_LABEL } from '@/types/modules';

const GROUP_LABEL: Record<string, string> = {
  attendance:    '근태',
  work:          '업무',
  hr:            'HR',
  payroll:       '급여·세무',
  communication: '소통',
  advanced:      '고급',
};

const GROUP_COLOR: Record<string, string> = {
  attendance:    'bg-blue-50 text-blue-700',
  work:          'bg-violet-50 text-violet-700',
  hr:            'bg-emerald-50 text-emerald-700',
  payroll:       'bg-amber-50 text-amber-700',
  communication: 'bg-sky-50 text-sky-700',
  advanced:      'bg-rose-50 text-rose-700',
};

interface ModuleCardProps {
  module: ModuleStatus;
  currentPlanName: string;
  isOwner: boolean;
}

export default function ModuleCard({ module, currentPlanName, isOwner }: ModuleCardProps) {
  const queryClient = useQueryClient();
  const minPlan = MODULE_MIN_PLAN[module.id] ?? 'pro';

  // 현재 플랜으로 사용 가능한지 (토글 가능 여부)
  const planOrder = ['free', 'basic', 'pro', 'enterprise'];
  const canUseInCurrentPlan =
    planOrder.indexOf(currentPlanName.toLowerCase()) >= planOrder.indexOf(minPlan);

  const toggleMut = useMutation({
    mutationFn: (isActive: boolean) =>
      api.patch(`/feature-modules/${module.id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-modules'] });
      toast.success(module.isActive ? `'${module.name}' 비활성화됨` : `'${module.name}' 활성화됨`);
    },
    onError: () => toast.error('모듈 설정 변경에 실패했습니다.'),
  });

  const handleToggle = () => {
    if (!isOwner) return;
    if (!canUseInCurrentPlan) return;
    toggleMut.mutate(!module.isActive);
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border transition-all duration-200 p-4',
        module.isActive
          ? 'border-primary-200 shadow-sm'
          : 'border-border',
        !canUseInCurrentPlan && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-semibold text-text-primary">{module.name}</span>
            <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-md', GROUP_COLOR[module.group])}>
              {GROUP_LABEL[module.group]}
            </span>
            {!canUseInCurrentPlan && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                {PLAN_LABEL[minPlan]} 이상
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">{module.description}</p>
        </div>

        {/* 토글 */}
        {isOwner && canUseInCurrentPlan ? (
          <button
            onClick={handleToggle}
            disabled={toggleMut.isPending}
            aria-label={module.isActive ? '비활성화' : '활성화'}
            className={clsx(
              'relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              module.isActive ? 'bg-primary-500' : 'bg-zinc-200',
              toggleMut.isPending && 'opacity-50',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                module.isActive ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        ) : module.isActive ? (
          <Check className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
        ) : (
          <Lock className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* 출처 뱃지 */}
      {module.isActive && module.source && (
        <div className="mt-2 pt-2 border-t border-zinc-50">
          <span className="text-[10px] text-text-muted">
            {module.source === 'plan' && '플랜 포함'}
            {module.source === 'addon' && '애드온 추가'}
            {module.source === 'manual' && '수동 설정'}
          </span>
        </div>
      )}
    </div>
  );
}
