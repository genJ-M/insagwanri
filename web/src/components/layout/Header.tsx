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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
      <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-base font-semibold text-gray-900 flex-1">{title}</h1>

      <div className="flex items-center gap-3">
        {/* 알림 버튼 */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* 역할 배지 */}
        {user && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        )}
      </div>
    </header>
  );
}
