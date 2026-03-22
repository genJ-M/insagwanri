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
        'flex flex-col w-[220px] bg-white border-r border-sidebar-border',
        'lg:relative lg:translate-x-0 lg:min-h-screen',
        'fixed inset-y-0 left-0 z-50 min-h-screen transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* 로고 */}
        <div className="flex items-center px-5 h-[60px]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white text-sm font-bold">관</span>
            </div>
            <span className="font-bold text-[16px] text-text-primary tracking-tight">관리왕</span>
          </div>
        </div>

        {/* 메인 네비 */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
          {mainNav.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary',
                )}
              >
                <Icon className={clsx('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-primary-500' : '')} />
                {label}
              </Link>
            );
          })}

          {/* 하단 네비 */}
          <div className="pt-3 mt-2 border-t border-sidebar-border space-y-0.5">
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
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-text-primary',
                    )}
                  >
                    <Icon className={clsx('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-primary-500' : '')} />
                    {label}
                  </Link>
                );
              })}
          </div>
        </nav>

        {/* 유저 정보 + 로그아웃 */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1">
            <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary truncate">{user?.name}</p>
              <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-sidebar-text hover:text-text-primary hover:bg-sidebar-hover rounded-xl transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}
