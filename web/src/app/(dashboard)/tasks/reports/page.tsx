'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Filter, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TaskReport } from '@/types';

const PAGE_SIZE = 10;

export default function ReportsPage() {
  usePageTitle('업무 보고서');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports-me', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data } = await api.get('/reports/me', { params });
      return data.data as TaskReport[];
    },
  });

  const visible = (reports ?? []).slice(0, visibleCount);
  const hasMore = (reports?.length ?? 0) > visibleCount;

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="업무 보고" />

      <main className="p-8 space-y-4 max-w-[1200px]">
        {/* 필터 영역 */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-text-muted mt-5 flex-shrink-0" />
            <div>
              <label className="label">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="input w-auto"
              />
            </div>
            <div>
              <label className="label">종료일</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="input w-auto"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="text-xs text-text-muted hover:text-text-secondary underline mt-4 transition-colors"
              >
                초기화
              </button>
            )}
          </div>
        </Card>

        {/* 보고서 목록 */}
        <Card padding="none">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
            </div>
          ) : !reports?.length ? (
            <div className="py-12 text-center text-sm text-text-muted">
              {startDate || endDate ? '해당 기간에 보고 이력이 없습니다.' : '보고 이력이 없습니다.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {visible.map((r) => {
                  const safePct = r.progressPercent != null
                    ? Math.min(100, Math.max(0, r.progressPercent))
                    : null;
                  const taskTitle = (r as any).task?.title;

                  return (
                    <li key={r.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* 연결된 업무 제목 */}
                          {taskTitle && (
                            <Link
                              href="/tasks"
                              className="inline-flex items-center gap-1 text-xs text-primary-500 font-medium mb-1 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{taskTitle}</span>
                            </Link>
                          )}

                          <p className="text-sm text-text-primary">{r.content}</p>

                          {/* AI 보조 여부 */}
                          {r.isAiAssisted && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                              ✨ AI 보조 작성
                            </span>
                          )}

                          {/* 진척률 */}
                          {safePct != null && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden max-w-xs border border-border">
                                <div
                                  className="h-full bg-primary-500 rounded-full"
                                  style={{ width: `${safePct}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-muted tabular-nums">{safePct}%</span>
                            </div>
                          )}

                          {/* 피드백 */}
                          {r.feedback && (
                            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs font-medium text-amber-700 mb-0.5">관리자 피드백</p>
                              <p className="text-xs text-amber-800">{r.feedback}</p>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-text-muted flex-shrink-0">
                          {format(new Date(r.createdAt), 'MM/dd HH:mm')}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* 더 보기 */}
              {hasMore && (
                <div className="px-5 py-3 border-t border-border text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    더 보기 ({(reports?.length ?? 0) - visibleCount}개 남음)
                  </Button>
                </div>
              )}

              {/* 총 건수 */}
              <div className="px-5 py-2 border-t border-border">
                <p className="text-xs text-text-muted">총 {reports?.length ?? 0}건</p>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
