import Spinner from './Spinner';

interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({ message = '불러오는 중...' }: PageLoaderProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-screen bg-background">
      <Spinner size="lg" />
      <p className="text-sm text-text-muted animate-pulse">{message}</p>
    </div>
  );
}

/** 페이지 콘텐츠 영역 로딩 (min-h 없는 버전) */
export function SectionLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner size="md" />
      {message && <p className="text-sm text-text-muted">{message}</p>}
    </div>
  );
}
