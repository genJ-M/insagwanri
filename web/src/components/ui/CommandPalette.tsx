'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Sparkles, X, ArrowRight,
  Users, ClipboardList, FilePen, Loader2,
  CornerDownLeft, Clock, ChevronRight,
} from 'lucide-react';
import { useUiStore } from '@/store/ui.store';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

// ── 타입 ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'employee' | 'task' | 'approval';
  id: string;
  label: string;
  sub?: string;
  href: string;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── 검색 결과 아이콘 ─────────────────────────────────────────────────────────

const TYPE_META: Record<SearchResult['type'], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  employee: { icon: Users,          label: '직원',   color: 'text-blue-500 bg-blue-50' },
  task:     { icon: ClipboardList,  label: '업무',   color: 'text-emerald-500 bg-emerald-50' },
  approval: { icon: FilePen,        label: '결재',   color: 'text-amber-500 bg-amber-50' },
};

// ── 단일 결과 행 ─────────────────────────────────────────────────────────────

function ResultRow({
  result,
  selected,
  onClick,
}: {
  result: SearchResult;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[result.type];
  const Icon = meta.icon;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-colors',
        selected ? 'bg-primary-50' : 'hover:bg-zinc-50',
      )}
    >
      <span className={clsx('flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold', meta.color)}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm truncate', selected ? 'text-primary-700 font-medium' : 'text-text-primary')}>{result.label}</p>
        {result.sub && <p className="text-xs text-text-muted truncate">{result.sub}</p>}
      </div>
      <span className="text-[10px] text-text-muted bg-zinc-100 px-1.5 py-0.5 rounded-md flex-shrink-0">{meta.label}</span>
      <ChevronRight className={clsx('w-3.5 h-3.5 flex-shrink-0 transition-colors', selected ? 'text-primary-400' : 'text-text-muted')} />
    </button>
  );
}

// ── 검색 모드 ────────────────────────────────────────────────────────────────

function SearchMode({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  const router = useRouter();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [usersRes, tasksRes, approvalsRes] = await Promise.allSettled([
          api.get(`/users?search=${encodeURIComponent(query)}&limit=3`),
          api.get(`/tasks?search=${encodeURIComponent(query)}&limit=3`),
          api.get(`/approvals?search=${encodeURIComponent(query)}&limit=3`),
        ]);

        const combined: SearchResult[] = [];

        if (usersRes.status === 'fulfilled') {
          const users = usersRes.value.data?.data?.items ?? usersRes.value.data?.data ?? [];
          (Array.isArray(users) ? users : []).slice(0, 3).forEach((u: any) => {
            combined.push({ type: 'employee', id: u.id, label: u.name, sub: `${u.department ?? ''} ${u.position ?? ''}`.trim() || u.email, href: `/team/${u.id}` });
          });
        }
        if (tasksRes.status === 'fulfilled') {
          const tasks = tasksRes.value.data?.data?.items ?? tasksRes.value.data?.data ?? [];
          (Array.isArray(tasks) ? tasks : []).slice(0, 3).forEach((t: any) => {
            combined.push({ type: 'task', id: t.id, label: t.title, sub: t.assigneeName ?? t.status, href: `/tasks/${t.id}` });
          });
        }
        if (approvalsRes.status === 'fulfilled') {
          const approvals = approvalsRes.value.data?.data?.items ?? approvalsRes.value.data?.data ?? [];
          (Array.isArray(approvals) ? approvals : []).slice(0, 3).forEach((a: any) => {
            combined.push({ type: 'approval', id: a.id, label: a.title, sub: a.status, href: `/approvals` });
          });
        }

        setResults(combined);
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onNavigate();
  }, [router, onNavigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!results.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); navigate(results[selectedIdx].href); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedIdx, navigate]);

  if (!query.trim()) {
    return (
      <div className="px-4 py-8 text-center text-text-muted">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">직원, 업무, 결재를 검색하세요</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">검색 중...</span>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="px-4 py-8 text-center text-text-muted">
        <p className="text-sm">"{query}"에 대한 결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-0.5">
      {results.map((r, i) => (
        <ResultRow
          key={`${r.type}-${r.id}`}
          result={r}
          selected={i === selectedIdx}
          onClick={() => navigate(r.href)}
        />
      ))}
      <p className="text-[11px] text-text-muted text-center pt-2 pb-1">
        <span className="inline-flex items-center gap-1"><CornerDownLeft className="w-2.5 h-2.5" /> 이동</span>
        <span className="mx-2">·</span>
        <span>↑↓ 선택</span>
      </p>
    </div>
  );
}

// ── AI 채팅 모드 ─────────────────────────────────────────────────────────────

function AiMode({ initialQuery }: { initialQuery: string }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (question: string) =>
      api.post('/ai/draft', { input: question, tone: 'formal' }).then((r) => r.data.data?.result ?? r.data?.result ?? ''),
    onSuccess: (result: string) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: result }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }]);
    },
  });

  const send = useCallback(() => {
    const q = input.trim();
    if (!q || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    mutation.mutate(q);
  }, [input, mutation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col">
      {/* 메시지 영역 */}
      <div className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6 text-text-muted">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary-300" />
            <p className="text-sm font-medium text-text-secondary">AI 어시스턴트</p>
            <p className="text-xs mt-1">업무 문서 작성, 메시지 다듬기, 일정 정리 등을 도와드립니다.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2 mt-0.5">
                <Sparkles className="w-3 h-3 text-primary-500" />
              </div>
            )}
            <div
              className={clsx(
                'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-tr-sm'
                  : 'bg-zinc-50 text-text-primary rounded-tl-sm border border-zinc-100',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-500" />
            </div>
            <div className="bg-zinc-50 border border-zinc-100 px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 면책 문구 */}
      <p className="text-[10px] text-text-muted text-center px-4 pb-1">
        AI 결과는 참고용이며, 최종 판단은 직접 확인하세요.
      </p>

      {/* 입력창 */}
      <div className="px-3 pb-3 border-t border-zinc-100 pt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="AI에게 질문하세요..."
          className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-border bg-zinc-50 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
        />
        <button
          onClick={send}
          disabled={!input.trim() || mutation.isPending}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          {mutation.isPending
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <ArrowRight className="w-4 h-4 text-white" />
          }
        </button>
      </div>
    </div>
  );
}

// ── 메인 CommandPalette ──────────────────────────────────────────────────────

export default function CommandPalette() {
  const { commandPaletteOpen, commandPaletteMode, closeCommandPalette, openCommandPalette } = useUiStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) { closeCommandPalette(); } else { openCommandPalette('search'); }
      }
      if (e.key === 'Escape' && commandPaletteOpen) { closeCommandPalette(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, closeCommandPalette, openCommandPalette]);

  // 열릴 때 input 포커스 + query 초기화
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen, commandPaletteMode]);

  if (!commandPaletteOpen) return null;

  const isSearch = commandPaletteMode === 'search';

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={closeCommandPalette}
      />

      {/* 팔레트 패널 */}
      <div className="fixed z-50 top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-[540px] px-4">
        <div className="bg-white rounded-2xl shadow-popover border border-zinc-100 overflow-hidden animate-slide-in">
          {/* 검색 입력 행 */}
          {isSearch && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
              <Search className="w-4 h-4 flex-shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="직원, 업무, 결재 검색..."
                className="flex-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none bg-transparent"
              />
              {/* AI 전환 버튼 */}
              <button
                onClick={() => openCommandPalette('ai')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-600 text-xs font-medium transition-colors flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI
              </button>
              <button onClick={closeCommandPalette} className="p-1 rounded-lg hover:bg-zinc-100 text-text-muted transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* AI 모드 헤더 */}
          {!isSearch && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
              <Sparkles className="w-4 h-4 flex-shrink-0 text-primary-500" />
              <span className="flex-1 text-sm font-medium text-text-primary">AI 어시스턴트</span>
              {/* 검색 전환 버튼 */}
              <button
                onClick={() => openCommandPalette('search')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-text-secondary text-xs font-medium transition-colors flex-shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                검색
              </button>
              <button onClick={closeCommandPalette} className="p-1 rounded-lg hover:bg-zinc-100 text-text-muted transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 콘텐츠 영역 */}
          {isSearch
            ? <SearchMode query={query} onNavigate={closeCommandPalette} />
            : <AiMode initialQuery={query} />
          }
        </div>
      </div>
    </>
  );
}
