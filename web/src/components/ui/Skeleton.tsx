import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={clsx('animate-pulse rounded-md bg-slate-100', className)} />
  );
}

export function SkeletonLine({ className }: SkeletonProps) {
  return <Skeleton className={clsx('h-4', className)} />;
}

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

export function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-12" />
        <SkeletonLine className="w-20 h-3" />
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-3">
      <SkeletonLine className="w-1/4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i % 2 === 0 ? 'w-3/4' : 'w-1/2'} />
      ))}
    </div>
  );
}

// ─── 대시보드 홈 스켈레톤 ──────────────────────────────────
export function SkeletonDashboard() {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* 상단 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
      </div>
      {/* 중단 2열 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><SkeletonCard lines={5} /></div>
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}

// ─── 테이블 페이지 스켈레톤 ───────────────────────────────
export function SkeletonTablePage() {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <SkeletonLine className="w-32" />
          <SkeletonLine className="w-48 h-3" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
      </div>
      {/* 테이블 */}
      <div className="bg-white border border-border rounded-xl p-4">
        <SkeletonTableRows count={8} />
      </div>
    </div>
  );
}

// ─── 상세 페이지 스켈레톤 (2열: 좌측 패널 + 우측 콘텐츠) ──
export function SkeletonDetailPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex gap-6 max-w-[1100px] mx-auto">
        {/* 좌측 패널 */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <div className="bg-white border border-border rounded-2xl p-6 flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-32 h-3" />
          </div>
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                <SkeletonLine className="w-20" />
              </div>
            ))}
          </div>
        </div>
        {/* 우측 콘텐츠 */}
        <div className="flex-1 bg-white border border-border rounded-2xl p-6 space-y-4">
          <SkeletonLine className="w-1/4" />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex gap-3 py-3 border-b border-gray-50">
              <Skeleton className="w-28 h-4 flex-shrink-0" />
              <SkeletonLine className={i % 2 === 0 ? 'w-1/3' : 'w-1/2'} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
