// PricingWizard · 견적서 페이지 공유 데이터

export type PlanKey = 'free' | 'basic' | 'pro';

export interface BusinessType {
  id: string;
  icon: string;
  label: string;
  sub: string;
  minPlan: PlanKey;
  included: string[];
  tip: string;
  featureModules: string[];   // 업종별 핵심 기능 키 (중복 제거 계산용)
}

// 기능 키 → 한국어 레이블
export const FEATURE_MODULE_LABELS: Record<string, string> = {
  qr_checkin:         'QR 출퇴근',
  wifi_checkin:       'WiFi 자동 출퇴근',
  gps_checkin:        'GPS 체크인/아웃',
  shift_schedule:     '근무 시프트 관리',
  shift_swap:         '교대 교환',
  weekly_holiday_pay: '주휴수당 자동 계산',
  part_time_wage:     '파트타임 급여 정산',
  salary_slip:        '급여 명세서 발행',
  legal_break_auto:   '법정 휴게시간 자동 차감',
  field_visits:       '현장 방문 · 이동 기록',
  daily_wage:         '일용직 급여 정산',
  e_contracts:        '근로계약서 전자 서명',
  site_dashboard:     '현장 출역 현황 대시보드',
  ai_assistant:       'AI 공지 · 업무 어시스턴트',
  e_approvals:        '전자결재 (봉인 · 5년 보존)',
  tax_calendar:       '세무 캘린더 자동 알림',
  invite_onboarding:  '초대 링크 간편 온보딩',
  care_sessions:      '케어 세션 · 수급자 기록',
  license_tracking:   '자격증 갱신일 자동 추적',
  night_holiday_pay:  '야간 · 휴일 수당 자동 계산',
  care_vehicle:       '방문 돌봄 이동 기록',
  multi_location:     '다지점 직원 통합 현황판',
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'food',
    icon: '☕',
    label: '카페 / 식당',
    sub: '요식업 · 음식점',
    minPlan: 'basic',
    included: [
      'QR · 앱 출퇴근 기록',
      '주휴수당 자동 계산',
      '근무 시프트 관리',
      '급여 명세서 발행',
      '법정 휴게시간 자동 차감',
    ],
    tip: '주휴수당 계산 분쟁, 시스템이 막아줍니다',
    featureModules: [
      'qr_checkin', 'weekly_holiday_pay', 'shift_schedule',
      'shift_swap', 'salary_slip', 'legal_break_auto', 'part_time_wage',
    ],
  },
  {
    id: 'construction',
    icon: '🏗️',
    label: '건설 / 현장직',
    sub: '현장 · 외근 · 일용직',
    minPlan: 'basic',
    included: [
      'GPS 현장 체크인 / 체크아웃',
      '현장별 방문 · 이동 기록',
      '일용직 급여 정산',
      '근로계약서 전자 서명',
      '일별 출역 현황 대시보드',
    ],
    tip: '현장 어디서든 앱 하나로 출퇴근',
    featureModules: [
      'gps_checkin', 'field_visits', 'daily_wage',
      'e_contracts', 'site_dashboard',
    ],
  },
  {
    id: 'office',
    icon: '🏢',
    label: '일반 사무실',
    sub: '사무직 · IT · 서비스업',
    minPlan: 'basic',
    included: [
      'WiFi 자동 출퇴근',
      '전자결재 + 법적 봉인 · 5년 보존',
      '세무 캘린더 자동 알림',
      'AI 공지 초안 · 업무 어시스턴트',
      '초대 링크 간편 온보딩',
    ],
    tip: '세무 신고 깜빡? 35일 전부터 자동 알림',
    featureModules: [
      'wifi_checkin', 'e_approvals', 'tax_calendar',
      'ai_assistant', 'invite_onboarding',
    ],
  },
  {
    id: 'care',
    icon: '🏥',
    label: '돌봄 / 의료',
    sub: '요양원 · 병원 · 복지시설',
    minPlan: 'basic',
    included: [
      'GPS 출퇴근 (방문 케어 포함)',
      '케어 세션 · 수급자 기록',
      '자격증 · 갱신일 자동 추적',
      '야간 · 휴일 수당 자동 계산',
      '방문 돌봄 이동 기록',
    ],
    tip: '자격증 갱신일, 이제 시스템이 추적합니다',
    featureModules: [
      'gps_checkin', 'care_sessions', 'license_tracking',
      'night_holiday_pay', 'care_vehicle',
    ],
  },
  {
    id: 'retail',
    icon: '🛍️',
    label: '소매 / 유통',
    sub: '편의점 · 마트 · 매장',
    minPlan: 'basic',
    included: [
      'QR 출퇴근 (타임카드 대체)',
      '다지점 직원 통합 현황판',
      '시프트 스케줄 자동 배정',
      '주휴수당 자동 계산',
      '아르바이트 급여 정산',
    ],
    tip: '여러 매장 직원을 한 화면에서 관리',
    featureModules: [
      'qr_checkin', 'multi_location', 'shift_schedule',
      'weekly_holiday_pay', 'part_time_wage',
    ],
  },
];

// 업종별 "추가 비용" — 복합 구성 시 2번째 업종부터 할인 적용
export const TYPE_ADDON_PRICE: Record<string, number> = {
  food:         9_000,
  construction: 12_000,
  office:       12_000,
  care:         15_000,
  retail:       8_000,
};

// 추가 업종별 할인율: index 1 = 60% 할인, index 2 = 70% 할인, index 3+ = 75% 할인
const COMBO_DISCOUNT_BY_INDEX = [0, 0.60, 0.70, 0.75];

export const MODULE_LABELS: Record<string, string> = {
  attendance:          '출퇴근 관리',
  tasks:               '업무 관리',
  calendar:            '캘린더',
  vacations:           '휴가 관리',
  schedules:           '일정',
  attendance_methods:  '출퇴근 방법',
  locations:           '지점 관리',
  contracts:           '근로계약서',
  salary:              '급여 명세서',
  shift_schedule:      '근무표',
  shift_swap:          '교대 교환',
  approvals:           '전자결재',
  collaboration:       '협업·공지',
  tax_documents:       '세무 서류',
  calendar_settings:   '캘린더 설정',
  ai:                  'AI 어시스턴트',
  field_visits:        '현장 방문',
  hr_notes:            '인사 노트',
  evaluations:         '직원 평가',
  training:            '교육·훈련',
  search:              '통합 검색',
  custom_templates:    '맞춤 템플릿',
  activity_logs_view:  '활동 로그',
  credits:             '크레딧',
};

export const PLANS: Record<PlanKey, {
  name: string;
  label: string;
  price: number;       // 플랜 기본료 (1명 포함, 인원 무관 고정)
  priceYearly: number; // 기본료 연간 (17% 할인)
  yearlyDiscount: number;
  maxEmployees: number;
  features: string[];
  moduleIds: string[];
}> = {
  free: {
    name: 'Free',
    label: '무료',
    price: 0,
    priceYearly: 0,
    yearlyDiscount: 0,
    maxEmployees: 1,
    features: ['직원 1명', '기본 출퇴근 기록', '직원 프로필 관리', '모바일 앱'],
    moduleIds: ['attendance', 'tasks', 'calendar', 'vacations', 'schedules'],
  },
  basic: {
    name: 'Basic',
    label: '베이직',
    price: 29000,      // 기본료 (1명 포함) — 추가 인원은 SEAT_TIERS 참고
    priceYearly: 290000,
    yearlyDiscount: 17,
    maxEmployees: 30,
    features: ['직원 최대 30명', '급여 명세서 발행', '전자결재 기본', '시프트 스케줄', '세무 캘린더'],
    moduleIds: [
      'attendance', 'tasks', 'calendar', 'vacations', 'schedules',
      'attendance_methods', 'locations', 'contracts', 'salary',
      'shift_schedule', 'shift_swap', 'approvals', 'collaboration',
      'tax_documents', 'calendar_settings',
    ],
  },
  pro: {
    name: 'Pro',
    label: '프로',
    price: 49000,      // 기본료 (1명 포함) — 추가 인원은 SEAT_TIERS 참고
    priceYearly: 490000,
    yearlyDiscount: 17,
    maxEmployees: 100,
    features: ['직원 최대 100명', 'AI 어시스턴트', '고급 리포트 · 분석', '전자결재 고급 (봉인·보존)', '우선 고객 지원'],
    moduleIds: [
      'attendance', 'tasks', 'calendar', 'vacations', 'schedules',
      'attendance_methods', 'locations', 'contracts', 'salary',
      'shift_schedule', 'shift_swap', 'approvals', 'collaboration',
      'tax_documents', 'calendar_settings',
      'ai', 'field_visits', 'hr_notes', 'evaluations', 'training',
      'search', 'custom_templates', 'activity_logs_view', 'credits',
    ],
  },
};

export interface Addon {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  price: number;
  popular: boolean;
}

export const ADDONS: Addon[] = [
  { id: 'contract',    emoji: '📝', name: '전자계약서',         desc: '근로계약서 전자 서명 · 법적 보관',       price: 9900, popular: true  },
  { id: 'tax_alert',  emoji: '📅', name: '세무 자동 알림',     desc: '35일 이내 세무 · 노무 할 일 자동 알림', price: 6900, popular: true  },
  { id: 'extra_ai_50', emoji: '🤖', name: 'AI 어시스턴트 확장', desc: '공지 초안 생성 · 업무 분석 (+50회/일)', price: 9900, popular: false },
];

// 추가 지점 단가 (개당)
export const EXTRA_LOCATION_PRICE = 9_900;

// ── 인원 추가 과금 구조 (1번째 직원은 기본료에 포함) ──────────────
export interface SeatTier {
  upTo: number;         // 이 구간까지의 누적 인원 수 (포함)
  pricePerSeat: number; // 이 구간 인당 월 추가 요금 (원)
}

export const SEAT_TIERS: Record<'basic' | 'pro', SeatTier[]> = {
  basic: [
    { upTo: 10,  pricePerSeat: 2_000 },  // 2~10명
    { upTo: 30,  pricePerSeat: 1_500 },  // 11~30명
  ],
  pro: [
    { upTo: 30,  pricePerSeat: 2_000 },  // 2~30명
    { upTo: 50,  pricePerSeat: 1_500 },  // 31~50명
    { upTo: 100, pricePerSeat: 1_000 },  // 51~100명
  ],
};

export interface SeatBreakdown {
  count: number;
  pricePerSeat: number;
  subtotal: number;
}

export function calcSeats(planKey: 'basic' | 'pro', employees: number): number {
  if (employees <= 1) return 0;
  const tiers = SEAT_TIERS[planKey];
  let cost = 0;
  let prev = 1;
  for (const tier of tiers) {
    if (employees <= prev) break;
    const end = Math.min(employees, tier.upTo);
    cost += (end - prev) * tier.pricePerSeat;
    prev = tier.upTo;
  }
  return cost;
}

export function calcSeatsBreakdown(planKey: 'basic' | 'pro', employees: number): SeatBreakdown[] {
  if (employees <= 1) return [];
  const tiers = SEAT_TIERS[planKey];
  const breakdown: SeatBreakdown[] = [];
  let prev = 1;
  for (const tier of tiers) {
    if (employees <= prev) break;
    const end = Math.min(employees, tier.upTo);
    const count = end - prev;
    if (count > 0) {
      breakdown.push({ count, pricePerSeat: tier.pricePerSeat, subtotal: count * tier.pricePerSeat });
    }
    prev = tier.upTo;
  }
  return breakdown;
}

// ── 단일 업종 플랜 도출 ───────────────────────────────────────
export function derivePlan(type: BusinessType, employees: number): PlanKey | 'enterprise' {
  if (employees > 100) return 'enterprise';
  if (employees > 30) return 'pro';
  if (employees > 1) return type.minPlan;
  return 'free'; // 1명만 무료
}

// ── 복합 업종 가격 계산 결과 ──────────────────────────────────
export interface ComboResult {
  planKey: PlanKey | 'enterprise';
  baseFee: number;   // 플랜 기본료 (인원 무관)
  seatFee: number;   // 인원 추가 과금
  basePrice: number; // baseFee + seatFee
  comboAddOns: Array<{
    type: BusinessType;
    originalPrice: number;
    discountPct: number;  // 0.60 = 60% 할인
    finalPrice: number;
  }>;
  comboAddOnTotal: number;
  totalMonthly: number;
  sharedFeatures: string[];   // 2개 이상 업종에 겹치는 기능 키
  addedFeatures: string[];    // 추가 업종의 신규 기능 키
  standaloneTotal: number;    // 각각 구독 시 합산 가격
  savings: number;
  savingsPct: number;
}

export function deriveComboPrice(types: BusinessType[], employees: number): ComboResult {
  if (types.length === 0) {
    return {
      planKey: 'free', baseFee: 0, seatFee: 0, basePrice: 0,
      comboAddOns: [], comboAddOnTotal: 0,
      totalMonthly: 0, sharedFeatures: [], addedFeatures: [],
      standaloneTotal: 0, savings: 0, savingsPct: 0,
    };
  }

  // 1. 필요 최고 플랜 결정
  const planOrder: (PlanKey | 'enterprise')[] = ['free', 'basic', 'pro', 'enterprise'];
  const highestMinPlan = types.reduce<PlanKey>((max, t) =>
    planOrder.indexOf(t.minPlan) > planOrder.indexOf(max) ? t.minPlan : max,
  'free');

  let planKey: PlanKey | 'enterprise';
  if (employees > 100)         planKey = 'enterprise';
  else if (employees > 30)     planKey = 'pro';
  else if (employees > 5)      planKey = highestMinPlan === 'pro' ? 'pro' : 'basic';
  else                         planKey = highestMinPlan === 'pro' ? 'pro' : 'free';

  const baseFee = planKey === 'enterprise' ? 99_000 : (planKey === 'free' ? 0 : (PLANS[planKey as PlanKey]?.price ?? 0));
  const seatFee = (planKey !== 'enterprise' && planKey !== 'free')
    ? calcSeats(planKey as 'basic' | 'pro', employees)
    : 0;
  const basePrice = baseFee + seatFee;

  // 2. 추가 업종 할인 계산
  //    add-on 가격이 높은 업종을 먼저 → 더 저렴한 업종이 할인 대상
  const sortedByAddon = [...types].sort(
    (a, b) => (TYPE_ADDON_PRICE[b.id] ?? 0) - (TYPE_ADDON_PRICE[a.id] ?? 0),
  );

  const comboAddOns = sortedByAddon.slice(1).map((t, idx) => {
    const originalPrice = TYPE_ADDON_PRICE[t.id] ?? 0;
    const discountPct = COMBO_DISCOUNT_BY_INDEX[idx + 1] ?? 0.75;
    const finalPrice = Math.round(originalPrice * (1 - discountPct));
    return { type: t, originalPrice, discountPct, finalPrice };
  });

  const comboAddOnTotal = comboAddOns.reduce((s, a) => s + a.finalPrice, 0);
  const totalMonthly = basePrice + comboAddOnTotal;

  // 3. 기능 중복 계산
  const featureCount = new Map<string, number>();
  types.forEach(t => t.featureModules.forEach(f =>
    featureCount.set(f, (featureCount.get(f) ?? 0) + 1),
  ));
  const sharedFeatures = [...featureCount.entries()]
    .filter(([, cnt]) => cnt > 1).map(([f]) => f);

  const primaryModules = new Set(sortedByAddon[0]?.featureModules ?? []);
  const addedFeatures = [
    ...new Set(sortedByAddon.slice(1).flatMap(t =>
      t.featureModules.filter(f => !primaryModules.has(f)),
    )),
  ];

  // 4. 각각 구독 시 비교
  const standaloneTotal = types.reduce((sum, t) => {
    const tPlan = derivePlan(t, employees);
    if (tPlan === 'enterprise') return sum + 99_000;
    if (tPlan === 'free') return sum;
    const planFee = PLANS[tPlan as PlanKey]?.price ?? 0;
    const seats = calcSeats(tPlan as 'basic' | 'pro', employees);
    return sum + planFee + seats;
  }, 0);

  const savings = Math.max(0, standaloneTotal - totalMonthly);
  const savingsPct = standaloneTotal > 0 ? Math.round((savings / standaloneTotal) * 100) : 0;

  return {
    planKey, baseFee, seatFee, basePrice,
    comboAddOns, comboAddOnTotal, totalMonthly,
    sharedFeatures, addedFeatures, standaloneTotal, savings, savingsPct,
  };
}

export function fmt(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function buildQuoteUrl(params: {
  planKey: PlanKey | 'enterprise';
  employees: number;
  addons: string[];
  typeIds: string[];
}): string {
  const p = new URLSearchParams({
    plan: params.planKey,
    employees: String(params.employees),
    type: params.typeIds.join(','),
  });
  if (params.addons.length) p.set('addons', params.addons.join(','));
  return `/quote?${p.toString()}`;
}
