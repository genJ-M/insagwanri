/**
 * 마케팅 블록 / 배너 / 팝업 서버사이드 fetcher.
 * page.tsx (Server Component) 에서 import해서 사용.
 * 실패해도 빈 기본값 반환 — 랜딩이 깨지지 않도록.
 */

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type BlockMap = Record<string, Record<string, string>>;

export async function fetchBlocks(): Promise<BlockMap> {
  try {
    const res = await fetch(`${API_BASE}/marketing/public/blocks`, {
      next: { revalidate: 60 }, // ISR: 60초마다 갱신
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export interface BannerData {
  id: string;
  text: string;
  link_url?: string | null;
  link_text?: string | null;
  bg_color: string;
  text_color: string;
}

export async function fetchActiveBanner(): Promise<BannerData | null> {
  try {
    const res = await fetch(`${API_BASE}/marketing/public/banner`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface PopupData {
  id: string;
  title: string;
  body: string;
  cta_text?: string | null;
  cta_url?: string | null;
  trigger_type: string;
  trigger_value: number;
  dismiss_days: number;
}

export async function fetchActivePopups(): Promise<PopupData[]> {
  try {
    const res = await fetch(`${API_BASE}/marketing/public/popups`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** 블록 값 getter — 없으면 fallback 반환 */
export function b(map: BlockMap, section: string, key: string, fallback: string): string {
  return map[section]?.[key] ?? fallback;
}
