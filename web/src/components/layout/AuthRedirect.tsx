'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export default function AuthRedirect() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace('/attendance');
    }
  }, [hasHydrated, isAuthenticated, router]);

  return null;
}
