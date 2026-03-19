'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Clock, ClipboardList, FileText,
  Calendar, MessageSquare, Sparkles, Building2, LogOut,
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
  { href: '/team',     icon: Users,    label: '팀 관리', roles: ['owner', 'manager'] },
  { href: '/settings', icon: Settings, label: '설정',   roles: null },
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    <aside className={clsx(
      'flex flex-col w-60 bg-gray-900 text-white',
      // 데스크톱: 항상 표시 (relative)
      'lg:relative lg:translate-x-0 lg:min-h-screen',
      // 모바일: fixed overlay, sidebarOpen에 따라 슬라이드
      'fixed inset-y-0 left-0 z-50 min-h-screen transition-transform duration-200',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-700">
        <Building2 className="h-6 w-6 text-blue-400" />
        <span className="font-bold text-lg">관리왕</span>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainNav.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* 하단 네비 (팀, 설정) */}
        <div className="pt-2 mt-2 border-t border-gray-700/50 space-y-0.5">
          {bottomNav
            .filter(({ roles }) => !roles || roles.includes(user?.role ?? ''))
            .map(({ href, icon: Icon, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
        </div>
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
    </>
  );
}
