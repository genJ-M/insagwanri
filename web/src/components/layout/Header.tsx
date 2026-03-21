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
    <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold text-text-primary flex-1">{title}</h1>

      <div className="flex items-center gap-3">
        {/* 알림 버튼 */}
        <button className="relative p-2 rounded-lg hover:bg-background text-text-secondary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* 역할 배지 + 아바타 */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-600">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-semibold text-primary-600">
              {user.name?.charAt(0) ?? '?'}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
