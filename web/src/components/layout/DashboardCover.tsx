'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

// 3-tier priority: personal > company > system default
const SYSTEM_DEFAULT_COVER = '/images/default-cover.jpg';

interface CoverData {
  coverImageUrl?: string | null;
  coverImageMobileUrl?: string | null;
  brandingTextColor?: string;
}

interface DashboardCoverProps {
  children?: React.ReactNode;
  height?: number; // px
}

export default function DashboardCover({ children, height = 180 }: DashboardCoverProps) {
  const { user } = useAuthStore();

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => { const { data } = await api.get('/users/me'); return data.data ?? data; },
    staleTime: 1000 * 60,
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
    staleTime: 1000 * 60,
  });

  // 3-tier fallback
  const coverUrl: string =
    profile?.coverImageUrl ??
    workspace?.coverImageUrl ??
    SYSTEM_DEFAULT_COVER;

  const textColor: string = workspace?.brandingTextColor ?? '#FFFFFF';

  return (
    <div
      className="relative w-full overflow-hidden flex-shrink-0"
      style={{ height }}
    >
      {/* 배경 이미지 */}
      <div
        className="absolute inset-0 bg-center bg-cover transition-all duration-500"
        style={{ backgroundImage: `url(${coverUrl})` }}
      />
      {/* 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />

      {/* 콘텐츠 */}
      {children && (
        <div
          className="relative z-10 h-full flex flex-col justify-end p-6"
          style={{ color: textColor }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
