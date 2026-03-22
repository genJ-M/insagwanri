'use client';
import { Menu, Bell } from 'lucide-react';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';

const ROLE_LABEL: Record<string, string> = {
  owner: '사업주', manager: '관리자', employee: '직원',
};

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0 sticky top-0 z-30">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-[15px] font-semibold text-text-primary flex-1">{title}</h1>

      <div className="flex items-center gap-2">
        {/* 알림 버튼 */}
        <button className="relative p-2 rounded-lg hover:bg-background text-text-muted hover:text-text-secondary transition-colors">
          <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-white" />
        </button>

        {/* 역할 배지 + 아바타 */}
        {user && (
          <div className="flex items-center gap-2.5 pl-1">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-primary-100">
              {user.name?.charAt(0) ?? '?'}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
