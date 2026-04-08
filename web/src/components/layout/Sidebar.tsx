'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Clock, ClipboardList, FileText,
  Calendar, MessageSquare, Sparkles, LogOut,
  Users, Settings, Banknote, Umbrella, FilePen, FileSignature, Award,
  ClipboardCheck, BarChart2, GraduationCap, ChevronRight, ShieldCheck,
  Pencil, CalendarDays, SlidersHorizontal, Link2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import api from '@/lib/api';

/* ── 타입 ──────────────────────────────────────────────── */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  matchPattern?: RegExp;
  roles?: string[] | null;
  pageKey?: string; // 가시성 설정 키 (없으면 항상 표시)
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
  pageKey?: string;
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
      { href: '/attendance', icon: Clock,     label: '출퇴근',   pageKey: '/attendance' },
      { href: '/vacations',  icon: Umbrella,  label: '휴가 관리', pageKey: '/vacations' },
      { href: '/calendar',   icon: Calendar,  label: '캘린더',   pageKey: '/calendar' },
    ],
  },
  {
    type: 'group',
    id: 'work',
    label: '업무',
    icon: ClipboardList,
    items: [
      { href: '/tasks', icon: ClipboardList, label: '업무 관리', pageKey: '/tasks', matchPattern: /^\/tasks(\/(?!reports)[^/]+)?$/ },
      { href: '/tasks/reports', icon: FileText,     label: '업무 보고',  pageKey: '/tasks/reports' },
      { href: '/schedule',       icon: Calendar,     label: '스케줄',     pageKey: '/schedule' },
      { href: '/shift-schedule', icon: CalendarDays, label: '팀 근무표',  pageKey: '/shift-schedule' },
    ],
  },
  {
    type: 'single',
    href: '/messages',
    icon: MessageSquare,
    label: '메시지',
    pageKey: '/messages',
  },
  {
    type: 'group',
    id: 'hr',
    label: 'HR 관리',
    icon: Users,
    roles: ['owner', 'manager'],
    items: [
      { href: '/team',       icon: Users,         label: '직원 관리', pageKey: '/team',       roles: ['owner', 'manager'], matchPattern: /^\/team(\/(?!notes|stats)[^/]+)?$/ },
      { href: '/team/notes', icon: FileText,       label: '인사 노트', pageKey: '/team/notes', roles: ['owner', 'manager'] },
      { href: '/team/stats', icon: BarChart2,      label: '조직 통계', pageKey: '/team/stats', roles: ['owner', 'manager'] },
      { href: '/salary',     icon: Banknote,       label: '급여 관리', pageKey: '/salary',     roles: ['owner', 'manager'] },
      { href: '/contracts',    icon: FileSignature, label: '계약 관리',   pageKey: '/contracts',    roles: ['owner', 'manager'] },
      { href: '/invitations',  icon: Link2,         label: '초대 링크',   pageKey: '/invitations',  roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'group',
    id: 'docs',
    label: '결재 · 평가',
    icon: FilePen,
    items: [
      { href: '/approvals',    icon: FilePen,        label: '전자결재',   pageKey: '/approvals' },
      { href: '/certificates', icon: Award,          label: '증명서 발급', pageKey: '/certificates' },
      { href: '/evaluations',  icon: ClipboardCheck, label: '인사평가',   pageKey: '/evaluations' },
      { href: '/training',     icon: GraduationCap,  label: '교육 관리',  pageKey: '/training' },
    ],
  },
  {
    type: 'group',
    id: 'tax',
    label: '세무·노무',
    icon: ShieldCheck,
    roles: ['owner', 'manager'],
    items: [
      { href: '/tax-documents',    icon: ShieldCheck,        label: '세무·노무 서류', pageKey: '/tax-documents',    roles: ['owner', 'manager'] },
      { href: '/calendar-settings', icon: SlidersHorizontal, label: '캘린더 설정',    pageKey: '/calendar-settings', roles: ['owner', 'manager'] },
    ],
  },
  {
    type: 'single',
    href: '/ai',
    icon: Sparkles,
    label: 'AI 도구',
    pageKey: '/ai',
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
  isPageVisible,
}: {
  item: NavItem;
  pathname: string;
  userRole: string;
  onClose: () => void;
  isPageVisible: (key: string | undefined) => boolean;
}) {
  if (item.roles && !item.roles.includes(userRole)) return null;
  if (!isPageVisible(item.pageKey)) return null;
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
  isOpen,
  onToggle,
  isPageVisible,
}: {
  group: NavGroup;
  pathname: string;
  userRole: string;
  onClose: () => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
  isPageVisible: (key: string | undefined) => boolean;
}) {
  // 그룹 역할 제한
  if (group.roles && !group.roles.includes(userRole)) return null;

  // 보여줄 아이템이 하나도 없으면 숨김
  const visibleItems = group.items.filter(
    (item) => (!item.roles || item.roles.includes(userRole)) && isPageVisible(item.pageKey),
  );
  if (visibleItems.length === 0) return null;

  // 자식 중 하나라도 활성이면 그룹 헤더 강조
  const hasActiveChild = visibleItems.some((item) => isPathActive(item, pathname));

  const Icon = group.icon;

  return (
    <div>
      {/* 그룹 헤더 */}
      <button
        onClick={() => onToggle(group.id)}
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
            isOpen ? 'rotate-90' : 'rotate-0',
            hasActiveChild ? 'text-primary-400' : 'text-text-muted',
          )}
        />
      </button>

      {/* 자식 아이템 (그리드 애니메이션) */}
      <div className={clsx('nav-group-wrap', isOpen && 'open')}>
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
                  isPageVisible={isPageVisible}
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

/* ── 회사 로고 영역 ──────────────────────────────────────── */
function CompanyLogo({ userRole }: { userRole: string }) {
  const canEdit = userRole === 'owner' || userRole === 'manager';

  const { data: workspace } = useQuery({
    queryKey: ['workspace-logo'],
    queryFn: async () => {
      const { data } = await api.get('/workspace/settings');
      return data.data ?? data;
    },
    staleTime: 5 * 60_000, // 5분 캐시
  });

  const logoUrl: string | null = workspace?.logoUrl ?? null;
  const companyName: string = workspace?.name ?? '관리왕';

  const inner = (
    <div className="flex items-center gap-3 group">
      {/* 로고 이미지 or 기본 아이콘 */}
      <div className="relative w-8 h-8 flex-shrink-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="w-8 h-8 rounded-[10px] object-cover shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-[10px] bg-primary-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-[13px] font-bold tracking-tight">
              {companyName.charAt(0)}
            </span>
          </div>
        )}
        {/* 편집 아이콘 (owner/manager만, hover 시 표시) */}
        {canEdit && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="w-2.5 h-2.5 text-text-secondary" />
          </div>
        )}
      </div>

      {/* 회사명 */}
      <div className="flex flex-col leading-none min-w-0">
        <span className="text-[15px] font-bold text-text-primary tracking-tight truncate">
          {companyName}
        </span>
        {canEdit && (
          <span className="text-[10px] text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            로고 편집
          </span>
        )}
      </div>
    </div>
  );

  // owner/manager: 클릭 시 설정 > 브랜딩으로 이동
  // employee: 클릭 불가, 표시만
  if (canEdit) {
    return (
      <Link
        href="/settings?tab=branding"
        className="flex items-center gap-0 px-5 h-[60px] flex-shrink-0 cursor-pointer rounded-none hover:bg-zinc-50 transition-colors"
        title="로고 및 브랜딩 편집"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-0 px-5 h-[60px] flex-shrink-0">
      {inner}
    </div>
  );
}

/* ── 메인 Sidebar ───────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  const userRole = user?.role ?? 'employee';

  // 팀별 페이지 가시성 설정
  const { data: visibilityMap } = useQuery<Record<string, boolean>>({
    queryKey: ['page-visibility', user?.id],
    queryFn: () =>
      api.get('/calendar-settings/visibility/my').then(r => r.data.data as Record<string, boolean>),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  const isPageVisible = (pageKey: string | undefined) => {
    if (!pageKey || !visibilityMap) return true; // 설정 없으면 기본 표시
    return visibilityMap[pageKey] !== false;
  };

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  // 현재 경로의 활성 그룹을 초기값으로 설정
  const initialOpenId = NAV.find(
    (entry): entry is NavGroup =>
      entry.type === 'group' &&
      entry.items.some((item) => isPathActive(item, pathname)),
  )?.id ?? null;

  const [openGroupId, setOpenGroupId] = useState<string | null>(initialOpenId);

  // 라우트 변경 시 활성 그룹이 있으면 자동으로 열기
  useEffect(() => {
    const activeGroup = NAV.find(
      (entry): entry is NavGroup =>
        entry.type === 'group' &&
        entry.items.some((item) => isPathActive(item, pathname)),
    );
    if (activeGroup) setOpenGroupId(activeGroup.id);
  }, [pathname]);

  const handleGroupToggle = useCallback((id: string) => {
    setOpenGroupId((prev) => (prev === id ? null : id));
  }, []);

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
        {/* ── 로고 (회사 이미지 / owner·manager는 편집 가능) ── */}
        <CompanyLogo userRole={userRole} />

        {/* ── 메인 네비 ─────────────────────────────────── */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto sidebar-scroll space-y-0.5">
          {NAV.map((entry) =>
            entry.type === 'single' ? (
              isPageVisible((entry as any).pageKey) ? (
                <NavSingleItem
                  key={entry.href}
                  item={entry}
                  pathname={pathname}
                  userRole={userRole}
                  onClose={closeSidebar}
                />
              ) : null
            ) : (
              <NavGroupBlock
                key={entry.id}
                group={entry}
                pathname={pathname}
                userRole={userRole}
                onClose={closeSidebar}
                isOpen={openGroupId === entry.id}
                onToggle={handleGroupToggle}
                isPageVisible={isPageVisible}
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
