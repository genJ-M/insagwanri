'use client';
import { useRef, useState, useEffect } from 'react';
import { Menu, Bell, Search, Sparkles, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

/* ── 알림 딥링크 라우트 맵 ───────────────────────────────── */
const NOTIFICATION_ROUTE: Record<string, (id: string | null) => string> = {
  approval:       (id) => id ? `/approvals/${id}` : '/approvals',
  vacation:       ()   => '/vacations',
  salary:         ()   => '/salary',
  attendance:     ()   => '/attendance',
  contract:       (id) => id ? `/contracts/${id}` : '/contracts',
  task:           (id) => id ? `/tasks/${id}` : '/tasks',
  task_report:    ()   => '/tasks/reports',
  schedule:       ()   => '/calendar',
  payment:        ()   => '/subscription',
  subscription:   ()   => '/subscription',
  shift_handover: ()   => '/shift-schedule',
  shift_swap:     ()   => '/shift-swap',
  field_visit:    ()   => '/locations',
  care_license:   ()   => '/team',
  care_session:   ()   => '/team',
};

function getNotificationRoute(refType: string | null, refId: string | null): string {
  if (!refType) return '/';
  const resolver = NOTIFICATION_ROUTE[refType];
  return resolver ? resolver(refId) : '/';
}

/* ── 알림 벨 드롭다운 ────────────────────────────────────── */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-header'],
    queryFn: () => api.get('/notifications?limit=10').then(r => r.data.data),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const notifications: any[] = data?.notifications ?? [];
  const unreadCount: number = data?.unread_count ?? 0;

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-header'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-header'] }),
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (n: any) => {
    if (!n.isRead) markReadMut.mutate(n.id);
    const route = getNotificationRoute(n.refType, n.refId);
    setOpen(false);
    router.push(route);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="알림"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 text-text-muted hover:text-text-secondary transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-lg border border-zinc-100 z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold text-text-primary">알림</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMut.mutate()}
                className="text-xs text-primary-500 hover:text-primary-600 transition-colors"
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-text-muted text-center py-6">불러오는 중...</p>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">새 알림이 없습니다.</p>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    'w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0',
                    !n.isRead && 'bg-primary-50/40',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                    <div className={clsx('flex-1 min-w-0', n.isRead && 'pl-4')}>
                      <p className="text-xs font-medium text-text-primary leading-snug truncate">{n.title}</p>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                      <p className="text-[10px] text-text-muted mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

/* ── 아바타 이니셜 ───────────────────────────────────────── */
function UserAvatar({ name, imageUrl, size = 'sm' }: { name?: string; imageUrl?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-[13px]';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ?? ''}
        className={clsx(dim, 'rounded-full object-cover ring-2 ring-primary-100 flex-shrink-0')}
      />
    );
  }
  return (
    <div className={clsx(dim, 'rounded-full bg-primary-500 flex items-center justify-center font-bold text-white ring-2 ring-primary-100 flex-shrink-0')}>
      {name?.charAt(0) ?? '?'}
    </div>
  );
}

/* ── 유저 드롭다운 ──────────────────────────────────────── */
function UserDropdown({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const roleMeta = ROLE_META[user?.role ?? ''] ?? { label: user?.role ?? '', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' };

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 라우트 이동 시 닫기
  const go = (href: string) => { setOpen(false); router.push(href); };

  const handleLogout = async () => {
    setOpen(false);
    try {
      await api.post('/auth/logout', { refresh_token: localStorage.getItem('refresh_token') });
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* 트리거 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="내 메뉴"
        className={clsx(
          'flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-all duration-150',
          open ? 'bg-zinc-100' : 'hover:bg-zinc-50',
        )}
      >
        <UserAvatar name={user?.name} imageUrl={user?.profileImageUrl} size="sm" />
        <ChevronDown className={clsx('h-3.5 w-3.5 text-text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden z-50 animate-fade-in">
          {/* 프로필 헤더 */}
          <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center gap-3">
            <UserAvatar name={user?.name} imageUrl={user?.profileImageUrl} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-text-muted truncate mt-0.5">{user?.email}</p>
              <span className={clsx('inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border', roleMeta.cls)}>
                {roleMeta.label}
              </span>
            </div>
          </div>

          {/* 메뉴 아이템 */}
          <div className="py-1.5">
            <DropItem icon={User} label="내 프로필" desc="정보 수정 · 비밀번호" onClick={() => go('/settings')} />
            <DropItem icon={Settings} label="환경설정" desc="알림 · 테마 · 보안" onClick={() => go('/settings')} />
          </div>

          <div className="border-t border-zinc-100 py-1.5">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropItem({
  icon: Icon, label, desc, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
    >
      <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-text-secondary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary leading-tight">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

/* ── 메인 Header ─────────────────────────────────────────── */
interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const pathname = usePathname();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const user = useAuthStore((s) => s.user);

  const pageTitle = getTitle(pathname, title);

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
        <NotificationBell />

        {/* 구분선 */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* 유저 드롭다운 */}
        {user && <UserDropdown user={user} />}
      </div>
    </header>
  );
}
