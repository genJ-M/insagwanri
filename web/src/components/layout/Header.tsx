'use client';
import { Menu, Bell, Search, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';

/* ── 경로 → 타이틀 매핑 ─────────────────────────────────── */
const ROUTE_TITLES: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/$/, label: '대시보드' },
  { pattern: /^\/attendance/, label: '출퇴근 관리' },
  { pattern: /^\/vacations/, label: '휴가 관리' },
  { pattern: /^\/calendar/, label: '캘린더' },
  { pattern: /^\/tasks\/reports/, label: '업무 보고' },
  { pattern: /^\/tasks\/[^/]+$/, label: '업무 상세' },
  { pattern: /^\/tasks/, label: '업무 관리' },
  { pattern: /^\/schedule/, label: '스케줄' },
  { pattern: /^\/messages/, label: '메시지' },
  { pattern: /^\/ai/, label: 'AI 도구' },
  { pattern: /^\/team\/notes/, label: '인사 노트' },
  { pattern: /^\/team\/stats/, label: '조직 통계' },
  { pattern: /^\/team\/[^/]+$/, label: '직원 상세' },
  { pattern: /^\/team/, label: '직원 관리' },
  { pattern: /^\/salary/, label: '급여 관리' },
  { pattern: /^\/approvals/, label: '전자결재' },
  { pattern: /^\/contracts/, label: '계약 관리' },
  { pattern: /^\/certificates/, label: '증명서 발급' },
  { pattern: /^\/evaluations/, label: '인사평가' },
  { pattern: /^\/training/, label: '교육 관리' },
  { pattern: /^\/settings/, label: '설정' },
  { pattern: /^\/subscription/, label: '구독 관리' },
];

function getTitle(pathname: string, override?: string): string {
  if (override) return override;
  for (const { pattern, label } of ROUTE_TITLES) {
    if (pattern.test(pathname)) return label;
  }
  return '관리왕';
}

/* ── 역할 배지 ──────────────────────────────────────────── */
const ROLE_META: Record<string, { label: string; cls: string }> = {
  owner:    { label: '사업주', cls: 'bg-amber-50   text-amber-700   border-amber-200'   },
  manager:  { label: '관리자', cls: 'bg-blue-50    text-blue-700    border-blue-200'    },
  employee: { label: '직원',   cls: 'bg-zinc-100   text-zinc-600    border-zinc-200'    },
};

interface HeaderProps {
  title?: string;   // 생략 시 pathname으로 자동 감지
}

export default function Header({ title }: HeaderProps) {
  const pathname = usePathname();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const user = useAuthStore((s) => s.user);

  const pageTitle = getTitle(pathname, title);
  const roleMeta = ROLE_META[user?.role ?? ''] ?? { label: user?.role ?? '', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };

  return (
    <header className="h-14 bg-white shadow-header flex items-center px-4 md:px-6 gap-3 flex-shrink-0 sticky top-0 z-30">
      {/* 모바일 햄버거 */}
      <button
        onClick={toggleSidebar}
        aria-label="메뉴 열기"
        className="p-2 -ml-1 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-secondary transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* 페이지 타이틀 */}
      <h1 className="text-[15px] font-semibold text-text-primary flex-1 truncate">
        {pageTitle}
      </h1>

      {/* 우측 액션 영역 */}
      <div className="flex items-center gap-1.5">
        {/* 검색 + AI 버튼 */}
        <div className="hidden sm:flex items-center rounded-lg border border-border bg-zinc-50 overflow-hidden">
          <button
            aria-label="검색"
            onClick={() => openCommandPalette('search')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-100 text-text-muted hover:text-text-secondary text-[12.5px] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>검색...</span>
            <kbd className="ml-1 text-[10px] font-mono px-1 py-0.5 rounded border border-border bg-white text-text-muted">⌘K</kbd>
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            aria-label="AI 어시스턴트"
            onClick={() => openCommandPalette('ai')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-primary-50 text-text-muted hover:text-primary-600 text-[12.5px] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">AI</span>
          </button>
        </div>

        {/* 알림 */}
        <button
          aria-label="알림"
          className="relative p-2 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-secondary transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* 구분선 */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* 역할 배지 + 아바타 */}
        {user && (
          <div className="flex items-center gap-2.5">
            <span
              className={`hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border ${roleMeta.cls}`}
            >
              {roleMeta.label}
            </span>
            <div
              title={user.name}
              className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-[13px] font-bold text-white ring-2 ring-primary-100 flex-shrink-0 cursor-default"
            >
              {user.name?.charAt(0) ?? '?'}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
