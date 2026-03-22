'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Clock, ClipboardList, FileText,
  Calendar, MessageSquare, Sparkles, LogOut,
  Users, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import api from '@/lib/api';

const mainNav = [
  { href: '/',              icon: LayoutDashboard, label: '대시보드',  roles: null },
  { href: '/attendance',    icon: Clock,            label: '출퇴근',   roles: null },
  { href: '/tasks',         icon: ClipboardList,    label: '업무 관리', roles: null },
  { href: '/tasks/reports', icon: FileText,         label: '업무 보고', roles: null },
  { href: '/schedule',      icon: Calendar,         label: '스케줄',   roles: null },
  { href: '/messages',      icon: MessageSquare,    label: '메시지',   roles: null },
  { href: '/ai',            icon: Sparkles,         label: 'AI 도구',  roles: null },
];

const bottomNav = [
  { href: '/team',     icon: Users,    label: '직원 관리', roles: ['owner', 'manager'] },
  { href: '/settings', icon: Settings, label: '설정',     roles: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();

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
      {/* 모바일 백드롭 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={clsx(
        'flex flex-col w-[240px] bg-sidebar-bg',
        'lg:relative lg:translate-x-0 lg:min-h-screen',
        'fixed inset-y-0 left-0 z-50 min-h-screen transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* 로고 */}
        <div className="flex items-center px-5 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">관</span>
            </div>
            <span className="font-bold text-[15px] text-white tracking-tight">관리왕</span>
          </div>
        </div>

        {/* 메인 네비 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
          {mainNav.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                )}
              >
                <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-400' : '')} />
                {label}
              </Link>
            );
          })}

          {/* 하단 네비 */}
          <div className="pt-3 mt-3 border-t border-sidebar-border space-y-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold text-sidebar-muted uppercase tracking-wider">관리</p>
            {bottomNav
              .filter(({ roles }) => !roles || roles.includes(user?.role ?? ''))
              .map(({ href, icon: Icon, label }) => {
                const isActive = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                    )}
                  >
                    <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-400' : '')} />
                    {label}
                  </Link>
                );
              })}
          </div>
        </nav>

        {/* 유저 정보 + 로그아웃 */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-hover transition-colors cursor-default mb-1">
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-sidebar-text truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-sidebar-text hover:text-white hover:bg-sidebar-hover rounded-lg transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
