'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Clock, ClipboardList, FileText,
  Calendar, MessageSquare, Sparkles, LogOut,
  Users, Settings, Banknote, Umbrella, FilePen, FileSignature, Award,
  ClipboardCheck, BarChart2, GraduationCap, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import api from '@/lib/api';

/* ── 타입 ──────────────────────────────────────────────── */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  matchPattern?: RegExp;   // 커스텀 활성 매칭 (siblings 충돌 방지용)
  roles?: string[] | null;
}

interface NavGroup {
  type: 'group';
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[] | null;   // 그룹 자체를 숨길 역할 제한
  items: NavItem[];
}

interface NavSingle {
  type: 'single';
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  roles?: string[] | null;
}

type NavEntry = NavGroup | NavSingle;

/* ── 네비게이션 구조 정의 ───────────────────────────────── */
const NAV: NavEntry[] = [
  {
    type: 'single',
    href: '/',
    icon: LayoutDashboard,
    label: '대시보드',
    exact: true,
  },
  {
    type: 'group',
    id: 'attendance',
    label: '근태 관리',
    icon: Clock,
    items: [
      { href: '/attendance', icon: Clock,     label: '출퇴근' },
      { href: '/vacations',  icon: Umbrella,  label: '휴가 관리' },
      { href: '/calendar',   icon: Calendar,  label: '캘린더' },
    ],
  },
  {
    type: 'group',
    id: 'work',
    label: '업무',
    icon: ClipboardList,
    items: [
      // /tasks/reports 와 충돌하지 않도록 — reports를 제외한 하위 경로(상세 페이지)만 매칭
      { href: '/tasks', icon: ClipboardList, label: '업무 관리', matchPattern: /^\/tasks(\/(?!reports)[^/]+)?$/ },
      { href: '/tasks/reports', icon: FileText, label: '업무 보고' },
      { href: '/schedule',      icon: Calendar,      label: '스케줄' },
    ],
  },
  {
    type: 'single',
    href: '/messages',
    icon: MessageSquare,
    label: '메시지',
  },
  {
    type: 'group',
    id: 'hr',
    label: 'HR 관리',
    icon: Users,
    roles: ['owner', 'manager'],
    items: [
      // /team/notes, /team/stats 와 충돌하지 않도록 — notes·stats를 제외한 하위 경로(직원 상세)만 매칭
      { href: '/team', icon: Users, label: '직원 관리', roles: ['owner', 'manager'], matchPattern: /^\/team(\/(?!notes|stats)[^/]+)?$/ },
      { href: '/team/notes', icon: FileText,        label: '인사 노트',  roles: ['owner', 'manager'] },
      { href: '/team/stats', icon: BarChart2,       label: '조직 통계',  roles: ['owner', 'manager'] },
      { href: '/salary',     icon: Banknote,        label: '급여 관리',  roles: ['owner', 'manager'] },
      { href: '/contracts',  icon: FileSignature,   label: '계약 관리',  roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'group',
    id: 'docs',
    label: '결재 · 평가',
    icon: FilePen,
    items: [
      { href: '/approvals',    icon: FilePen,        label: '전자결재' },
      { href: '/certificates', icon: Award,          label: '증명서 발급' },
      { href: '/evaluations',  icon: ClipboardCheck, label: '인사평가' },
      { href: '/training',     icon: GraduationCap,  label: '교육 관리' },
    ],
  },
  {
    type: 'group',
    id: 'tax',
    label: '세무·노무',
    icon: ShieldCheck,
    roles: ['owner', 'manager'],
    items: [
      { href: '/tax-documents', icon: ShieldCheck, label: '세무·노무 서류', roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'single',
    href: '/ai',
    icon: Sparkles,
    label: 'AI 도구',
  },
];

const BOTTOM_NAV: NavSingle[] = [
  { type: 'single', href: '/settings', icon: Settings, label: '설정' },
];

const ROLE_LABEL: Record<string, string> = {
  owner: '사업주',
  manager: '관리자',
  employee: '직원',
};

/* ── 유틸: 경로가 활성 상태인지 ─────────────────────────── */
function isPathActive(item: Pick<NavItem, 'href' | 'exact' | 'matchPattern'>, pathname: string) {
  if (item.matchPattern) return item.matchPattern.test(pathname);
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/* ── 서브 아이템 (그룹 내) ──────────────────────────────── */
function NavChild({
  item,
  pathname,
  userRole,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  userRole: string;
  onClose: () => void;
}) {
  if (item.roles && !item.roles.includes(userRole)) return null;
  const active = isPathActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={clsx(
        'group flex items-center gap-2.5 pl-9 pr-3 py-[7px] rounded-lg text-[13px] transition-all duration-150',
        active
          ? 'bg-primary-50 text-primary-700 font-semibold'
          : 'text-text-secondary hover:bg-zinc-50 hover:text-text-primary',
      )}
    >
      <Icon
        className={clsx(
          'w-3.5 h-3.5 flex-shrink-0 transition-colors',
          active ? 'text-primary-500' : 'text-text-muted group-hover:text-text-secondary',
        )}
      />
      {item.label}
    </Link>
  );
}

/* ── 그룹 컴포넌트 ──────────────────────────────────────── */
function NavGroupBlock({
  group,
  pathname,
  userRole,
  onClose,
}: {
  group: NavGroup;
  pathname: string;
  userRole: string;
  onClose: () => void;
}) {
  // 그룹 역할 제한
  if (group.roles && !group.roles.includes(userRole)) return null;

  // 보여줄 아이템이 하나도 없으면 숨김
  const visibleItems = group.items.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );
  if (visibleItems.length === 0) return null;

  // 자식 중 하나라도 활성이면 그룹도 자동 오픈
  const hasActiveChild = visibleItems.some((item) => isPathActive(item, pathname));

  const [open, setOpen] = useState(hasActiveChild);

  // 라우트 바뀔 때 활성 자식 생기면 자동 오픈
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const Icon = group.icon;

  return (
    <div>
      {/* 그룹 헤더 */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'flex items-center gap-2.5 w-full px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group',
          hasActiveChild
            ? 'text-primary-700'
            : 'text-text-secondary hover:bg-zinc-50 hover:text-text-primary',
        )}
      >
        <Icon
          className={clsx(
            'w-[17px] h-[17px] flex-shrink-0 transition-colors',
            hasActiveChild ? 'text-primary-500' : 'text-text-muted group-hover:text-text-secondary',
          )}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight
          className={clsx(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200',
            open ? 'rotate-90' : 'rotate-0',
            hasActiveChild ? 'text-primary-400' : 'text-text-muted',
          )}
        />
      </button>

      {/* 자식 아이템 (그리드 애니메이션) */}
      <div className={clsx('nav-group-wrap', open && 'open')}>
        <div className="nav-group-inner">
          {/* 왼쪽 세로선 + 아이템들 */}
          <div className="relative ml-[22px] mt-0.5 mb-1">
            <div className="absolute left-[10px] top-0 bottom-0 w-px bg-zinc-100" />
            <div className="space-y-0.5">
              {visibleItems.map((item) => (
                <NavChild
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  userRole={userRole}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 단독 아이템 ────────────────────────────────────────── */
function NavSingleItem({
  item,
  pathname,
  userRole,
  onClose,
}: {
  item: NavSingle;
  pathname: string;
  userRole: string;
  onClose: () => void;
}) {
  if (item.roles && !item.roles.includes(userRole)) return null;
  const active = isPathActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={clsx(
        'group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150',
        active
          ? 'bg-primary-50 text-primary-700'
          : 'text-text-secondary hover:bg-zinc-50 hover:text-text-primary',
      )}
    >
      <Icon
        className={clsx(
          'w-[17px] h-[17px] flex-shrink-0 transition-colors',
          active ? 'text-primary-500' : 'text-text-muted group-hover:text-text-secondary',
        )}
      />
      {item.label}
    </Link>
  );
}

/* ── 메인 Sidebar ───────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  const userRole = user?.role ?? 'employee';

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token'),
      });
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden animate-fade-in"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={clsx(
          'flex flex-col w-[240px] bg-white shadow-sidebar flex-shrink-0',
          'lg:relative lg:translate-x-0 lg:min-h-screen',
          'fixed inset-y-0 left-0 z-50 min-h-screen',
          'transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── 로고 ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 h-[60px] flex-shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-primary-500 flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-[13px] font-bold tracking-tight">관</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold text-text-primary tracking-tight">관리왕</span>
            <span className="text-[10px] text-text-muted mt-0.5 tracking-wide">
              {user?.name ? `${user.name}님` : '직원 관리 플랫폼'}
            </span>
          </div>
        </div>

        {/* ── 메인 네비 ─────────────────────────────────── */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto sidebar-scroll space-y-0.5">
          {NAV.map((entry) =>
            entry.type === 'single' ? (
              <NavSingleItem
                key={entry.href}
                item={entry}
                pathname={pathname}
                userRole={userRole}
                onClose={closeSidebar}
              />
            ) : (
              <NavGroupBlock
                key={entry.id}
                group={entry}
                pathname={pathname}
                userRole={userRole}
                onClose={closeSidebar}
              />
            ),
          )}
        </nav>

        {/* ── 하단 네비 (설정 등) ───────────────────────── */}
        <div className="px-3 pt-2 pb-1 border-t border-zinc-100 space-y-0.5">
          {BOTTOM_NAV.map((item) => (
            <NavSingleItem
              key={item.href}
              item={item}
              pathname={pathname}
              userRole={userRole}
              onClose={closeSidebar}
            />
          ))}
        </div>

        {/* ── 유저 카드 ──────────────────────────────────── */}
        <div className="px-3 pb-4 pt-2">
          <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
            <div className="flex items-center gap-2.5 mb-2.5">
              {/* 아바타 */}
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">
                  {user?.name}
                </p>
                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary-100 text-primary-700 mt-0.5">
                  {ROLE_LABEL[userRole] ?? userRole}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] font-medium text-text-muted hover:text-text-primary hover:bg-white transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
