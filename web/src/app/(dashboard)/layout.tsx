'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandPalette from '@/components/ui/CommandPalette';
import { useAuthStore } from '@/store/auth.store';
import PageLoader from '@/components/ui/PageLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) {
    return <PageLoader message="인증 확인 중..." />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header는 layout에서 공통 렌더링 — 각 페이지에서 별도 import 불필요 */}
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      {/* ⌘K 커맨드 팔레트 — layout-level 마운트 */}
      <CommandPalette />
    </div>
  );
}
