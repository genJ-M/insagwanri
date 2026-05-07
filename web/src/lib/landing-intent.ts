/**
 * 랜딩 PricingWizard에서 회원가입/온보딩으로 전달되는 사용자 선택 의도.
 * sessionStorage(우선) + URL 쿼리(폴백)로 보존되어 페이지 이동 후 자동 복원.
 */

export const LANDING_INTENT_KEY = 'gwanri_landing_intent_v1';

/** 랜딩 업종 ID → 백엔드 IndustryCode 매핑 */
export const WIZARD_TYPE_TO_INDUSTRY_CODE: Record<string, string> = {
  food:         'restaurant',
  construction: 'construction',
  office:       'service',
  care:         'healthcare',
  retail:       'retail',
};

export interface LandingIntent {
  /** 'free' | 'basic' | 'pro' | 'enterprise' — 백엔드 plan.name과 매칭 */
  planKey: string;
  /** 직원 수 (랜딩 슬라이더/입력값) */
  employees: number;
  /** 'monthly' | 'yearly' — 랜딩은 현재 monthly 고정 */
  billingCycle: 'monthly' | 'yearly';
  /** 랜딩에서 선택한 업종 ID 배열 (food/construction/...) */
  typeIds: string[];
  /** 선택한 애드온 ID 배열 (contract/tax_alert/extra_ai_50) */
  addonIds: string[];
  /** 추가 지점 수 */
  extraLocations: number;
  /** 저장 시각 (TTL 검사용) */
  savedAt: number;
}

const TTL_MS = 1000 * 60 * 60 * 24; // 24시간

export function saveLandingIntent(intent: Omit<LandingIntent, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: LandingIntent = { ...intent, savedAt: Date.now() };
    sessionStorage.setItem(LANDING_INTENT_KEY, JSON.stringify(payload));
    // localStorage에도 백업 — 새 탭에서 회원가입을 열어도 복원 가능
    localStorage.setItem(LANDING_INTENT_KEY, JSON.stringify(payload));
  } catch {
    /* storage 차단 시 무시 */
  }
}

export function loadLandingIntent(): LandingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LANDING_INTENT_KEY)
             ?? localStorage.getItem(LANDING_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LandingIntent;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      clearLandingIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLandingIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LANDING_INTENT_KEY);
    localStorage.removeItem(LANDING_INTENT_KEY);
  } catch { /* noop */ }
}

/** URL 쿼리스트링 직렬화 (sessionStorage 폴백용) */
export function intentToQueryString(intent: Omit<LandingIntent, 'savedAt'>): string {
  const p = new URLSearchParams({
    plan: intent.planKey,
    employees: String(intent.employees),
    cycle: intent.billingCycle,
    types: intent.typeIds.join(','),
  });
  if (intent.addonIds.length) p.set('addons', intent.addonIds.join(','));
  if (intent.extraLocations > 0) p.set('locations', String(intent.extraLocations));
  return p.toString();
}

/** URL 쿼리에서 intent 복원 시도 */
export function intentFromSearchParams(sp: URLSearchParams): LandingIntent | null {
  const plan = sp.get('plan');
  const employees = sp.get('employees');
  if (!plan || !employees) return null;
  return {
    planKey: plan,
    employees: parseInt(employees, 10) || 1,
    billingCycle: (sp.get('cycle') as 'monthly' | 'yearly') ?? 'monthly',
    typeIds: sp.get('types')?.split(',').filter(Boolean) ?? [],
    addonIds: sp.get('addons')?.split(',').filter(Boolean) ?? [],
    extraLocations: parseInt(sp.get('locations') ?? '0', 10) || 0,
    savedAt: Date.now(),
  };
}
