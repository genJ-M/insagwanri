'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

const NAV = [
  { href: '/companies',     label: '고객 회사',   icon: '🏢' },
  { href: '/subscriptions', label: '구독 관리',   icon: '📋' },
  { href: '/payments',      label: '결제 관리',   icon: '💳' },
  { href: '/coupons',       label: '쿠폰 관리',   icon: '🎟️' },
  { href: '/tax',           label: '세무 데이터', icon: '🧾' },
  { href: '/analytics',     label: '사용량 분석', icon: '📊' },
  { href: '/features',      label: 'Feature Flags', icon: '🚩' },
  { href: '/admin-users',   label: '운영자 관리', icon: '👥' },
  { href: '/audit',         label: '감사 로그',   icon: '🔍' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // 서버 오류 무시
    }
    localStorage.removeItem('adminToken');
    window.location.href = '/login';
  };

  return (
    <aside className="w-56 min-h-screen bg-gray-900 flex flex-col">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-gray-700">
        <p className="text-white font-bold text-lg">관리왕 Admin</p>
        <p className="text-gray-400 text-xs mt-0.5">운영 대시보드</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  );
}
