import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface SearchIndexItem {
  type: 'employee' | 'task' | 'approval';
  id: string;
  label: string;
  sub: string;
  href: string;
}

async function fetchSearchIndex(): Promise<SearchIndexItem[]> {
  const res = await api.get('/search/index');
  const data = res.data?.data ?? res.data;
  return Array.isArray(data) ? data : [];
}

export function useSearchIndex() {
  return useQuery({
    queryKey: ['search-index'],
    queryFn: fetchSearchIndex,
    staleTime: 5 * 60 * 1000, // 5분간 캐싱 — 재요청 없음
    gcTime: 10 * 60 * 1000,
  });
}
