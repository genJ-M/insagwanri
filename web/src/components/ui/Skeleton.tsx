import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

/** 단일 스켈레톤 블록 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
    />
  );
}

/** 텍스트 라인 스켈레톤 */
export function SkeletonLine({ className }: SkeletonProps) {
  return <Skeleton className={clsx('h-4', className)} />;
}

/** 카드 내 행 스켈레톤 (아바타 + 두 줄 텍스트) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <SkeletonLine className="w-1/3" />
        <SkeletonLine className="w-1/2 h-3" />
      </div>
      <SkeletonLine className="w-16" />
      <SkeletonLine className="w-12" />
    </div>
  );
}

/** 테이블 행 스켈레톤 (n개) */
export function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** 통계 카드 스켈레톤 */
export function SkeletonStatCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-12" />
        <SkeletonLine className="w-20 h-3" />
      </div>
    </div>
  );
}

/** 기본 카드 스켈레톤 */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <SkeletonLine className="w-1/4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i % 2 === 0 ? 'w-3/4' : 'w-1/2'} />
      ))}
    </div>
  );
}
