'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Copy, Check, Loader2, AlertCircle, History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { AiResult, AiFeature, AiHistoryRecord } from '@/types';
import { clsx } from 'clsx';

const AI_FEATURES: {
  id: AiFeature;
  label: string;
  description: string;
  placeholder: string;
  endpoint: string;
}[] = [
  {
    id: 'draft',
    label: '업무 문장 작성',
    description: '키워드나 요점을 입력하면 완성된 업무 문서 초안을 작성합니다.',
    placeholder: '예: 김철수에게 3월 15일까지 영업 보고서 작성 요청',
    endpoint: '/ai/draft',
  },
  {
    id: 'summarize',
    label: '업무 보고 요약',
    description: '긴 보고 내용을 핵심만 간결하게 정리합니다.',
    placeholder: '요약할 업무 보고 내용을 입력하세요...',
    endpoint: '/ai/summarize',
  },
  {
    id: 'announcement',
    label: '공지 메시지 생성',
    description: '전달할 핵심 내용을 입력하면 공지용 메시지를 작성합니다.',
    placeholder: '예: 3월 16일 오전 10시 2층 회의실 전체 회의',
    endpoint: '/ai/announcement',
  },
  {
    id: 'schedule_summary',
    label: '일정 정리',
    description: '여러 일정을 시간순으로 정리하여 보기 쉽게 요약합니다.',
    placeholder: '일정을 한 줄씩 입력하세요.\n예: 오전 10시 팀 회의\n오후 2시 A사 미팅',
    endpoint: '/ai/schedule-summary',
  },
  {
    id: 'refine',
    label: '문장 다듬기',
    description: '구어체나 비격식 문장을 업무용 표현으로 다듬어 줍니다.',
    placeholder: '예: 오늘 거래처 만났는데 가격 낮춰달라고 해서 검토하기로 함',
    endpoint: '/ai/refine',
  },
];

const TONE_OPTIONS = [
  { value: 'formal',   label: '격식체' },
  { value: 'friendly', label: '친근체' },
  { value: 'concise',  label: '간결체' },
];

// ── 결과 패널 ──────────────────────────────────
function ResultPanel({ result }: { result: AiResult }) {
  const [copied, setCopied] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.output_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="relative bg-background rounded-xl border border-border p-4">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-border text-text-muted transition-colors"
          title="복사"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed pr-8">
          {result.output_text}
        </p>
      </div>

      {/* 면책 문구 */}
      <div className="border border-amber-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setDisclaimerOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 text-left hover:bg-amber-100 transition-colors"
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 flex-1">AI 이용 주의사항</span>
          <span className="text-xs text-amber-500">{disclaimerOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {disclaimerOpen && (
          <div className="px-3 py-2.5 bg-amber-50 border-t border-amber-200">
            <p className="text-xs text-amber-700 leading-relaxed">{result.disclaimer}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted text-right">
        {result.model_name} · {result.tokens_used} tokens
      </p>
    </div>
  );
}

const FEATURE_LABELS: Record<AiFeature, string> = {
  draft: '업무 문장 작성',
  summarize: '업무 보고 요약',
  announcement: '공지 메시지 생성',
  schedule_summary: '일정 정리',
  refine: '문장 다듬기',
};

// ── 히스토리 패널 ────────────────────────────────
function HistoryPanel() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-history', page],
    queryFn: async () => {
      const { data } = await api.get('/ai/history', { params: { page, limit: 10 } });
      return data.data as { records: AiHistoryRecord[]; total: number; total_pages: number };
    },
  });

  const handleCopy = async (record: AiHistoryRecord) => {
    await navigator.clipboard.writeText(record.output_text);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.records?.length) {
    return (
      <div className="text-center py-10 text-sm text-text-muted">
        AI 생성 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {data.records.map((record) => {
        const isExpanded = expandedId === record.id;
        return (
          <div key={record.id} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              className="w-full flex items-start gap-3 px-4 py-3 bg-white hover:bg-background transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    {FEATURE_LABELS[record.feature]}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(record.created_at), { addSuffix: true, locale: ko })}
                  </span>
                  <span className="text-xs text-text-muted">{record.tokens_used} tokens</span>
                </div>
                <p className="text-sm text-text-secondary mt-1 truncate">{record.output_text}</p>
              </div>
              {isExpanded
                ? <ChevronUp className="h-4 w-4 text-text-muted flex-shrink-0 mt-0.5" />
                : <ChevronDown className="h-4 w-4 text-text-muted flex-shrink-0 mt-0.5" />
              }
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 bg-background border-t border-border">
                <div className="relative mt-3 bg-white rounded-lg border border-border p-3">
                  <button
                    onClick={() => handleCopy(record)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-background text-text-muted transition-colors"
                    title="복사"
                  >
                    {copiedId === record.id
                      ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5" />
                    }
                  </button>
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed pr-8">
                    {record.output_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 페이지네이션 */}
      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            이전
          </button>
          <span className="text-xs text-text-secondary">{page} / {data.total_pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
            className="px-3 py-1.5 text-xs rounded-lg border border-border disabled:opacity-40 hover:bg-background transition-colors"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────
export default function AiPage() {
  usePageTitle('AI 도구');
  const [view, setView] = useState<'generate' | 'history'>('generate');
  const [activeFeature, setActiveFeature] = useState<AiFeature>('draft');
  const [inputText, setInputText] = useState('');
  const [tone, setTone] = useState('formal');
  const [result, setResult] = useState<AiResult | null>(null);

  const feature = AI_FEATURES.find((f) => f.id === activeFeature)!;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload =
        activeFeature === 'schedule_summary'
          ? { schedules: inputText.split('\n').filter(Boolean), period: 'daily' }
          : { input_text: inputText, tone };

      const { data } = await api.post(feature.endpoint, payload);
      return data.data as AiResult;
    },
    onSuccess: (data) => setResult(data),
  });

  const errorMsg = (mutation.error as any)?.response?.data?.error?.message
    ?? (mutation.error as any)?.response?.data?.message
    ?? null;
  const isAuthError = errorMsg?.includes('인증 오류');
  const isLimitError = errorMsg?.includes('한도') || errorMsg?.includes('한도에');
  const charCount = inputText.length;
  const usedCount = result?.used_count ?? 0;
  const planLimit = result?.plan_limit ?? null;

  const handleFeatureChange = (id: AiFeature) => {
    setActiveFeature(id);
    setInputText('');
    setResult(null);
    mutation.reset();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="AI 도구" />

      <main className="p-8 max-w-3xl space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">AI 문서 보조</h2>
              <p className="text-xs text-text-secondary">업무 문서 작성을 도와주는 AI 보조 도구</p>
            </div>
          </div>
          <div className="flex gap-1 bg-background border border-border rounded-lg p-1">
            <button
              onClick={() => setView('generate')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'generate' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              생성
            </button>
            <button
              onClick={() => setView('history')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'history' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <History className="h-3.5 w-3.5" />
              히스토리
            </button>
          </div>
        </div>

        {view === 'history' && (
          <Card>
            <CardHeader title="AI 생성 히스토리" description="내가 생성한 AI 결과 목록" />
            <HistoryPanel />
          </Card>
        )}

        {view === 'generate' && (
          <>
            {/* 기능 선택 탭 */}
            <div className="flex flex-wrap gap-2">
              {AI_FEATURES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFeatureChange(f.id)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border',
                    activeFeature === f.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-text-secondary border-border hover:border-purple-300 hover:text-purple-600',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 입력 영역 */}
            <Card>
              <CardHeader title={feature.label} description={feature.description} />

              <div className="space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={feature.placeholder}
                  rows={activeFeature === 'schedule_summary' ? 6 : 4}
                  className="input resize-none"
                />

                {/* 문체 선택 */}
                {activeFeature !== 'schedule_summary' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary flex-shrink-0">문체:</span>
                    <div className="flex gap-1.5">
                      {TONE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                            tone === t.value
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-background border border-border text-text-secondary hover:bg-border',
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{charCount}자</span>
                  <Button
                    onClick={() => mutation.mutate()}
                    disabled={!inputText.trim()}
                    loading={mutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 gap-2"
                  >
                    {mutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> AI 생성 중...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> AI 생성</>
                    )}
                  </Button>
                </div>
              </div>

              {/* 에러 */}
              {mutation.isError && (
                <div className="mt-3">
                  {isAuthError ? (
                    <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 px-3 py-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">AI 서비스가 설정되지 않았습니다</p>
                        <p className="text-amber-700 mt-0.5 text-xs">관리자에게 OpenAI API 키 설정을 요청하세요.</p>
                      </div>
                    </div>
                  ) : isLimitError ? (
                    <div className="flex items-start gap-2 text-sm bg-orange-50 border border-orange-200 px-3 py-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">오늘의 AI 사용 한도에 도달했습니다</p>
                        <p className="text-orange-700 mt-0.5 text-xs">내일 다시 사용하거나 플랜을 업그레이드하세요.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle className="h-4 w-4" />
                      {errorMsg ?? 'AI 요청 중 오류가 발생했습니다.'}
                    </div>
                  )}
                </div>
              )}

              {/* 사용 한도 */}
              {planLimit !== null && (
                <div className="mt-3 flex items-center justify-between text-xs text-text-secondary bg-background px-3 py-2 rounded-lg border border-border">
                  <span>오늘 사용량</span>
                  <span className={clsx('font-medium', usedCount >= planLimit ? 'text-red-500' : 'text-text-primary')}>
                    {usedCount} / {planLimit}회
                  </span>
                </div>
              )}

              {/* 결과 */}
              {result && <ResultPanel result={result} />}
            </Card>

            {/* 사용 안내 */}
            <p className="text-xs text-text-muted text-center leading-relaxed">
              AI는 문서 작성 보조 목적으로만 사용됩니다. 경영 판단이나 인사 결정은 포함되지 않습니다.
              <br />생성된 결과는 반드시 검토 후 사용하시기 바랍니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
