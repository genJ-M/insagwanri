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
}

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
  },
  {
    id: 'office',
    icon: '🏢',
    label: '일반 사무실',
    sub: '사무직 · IT · 서비스업',
    minPlan: 'pro',
    included: [
      'WiFi 자동 출퇴근',
      '전자결재 + 법적 봉인 · 5년 보존',
      '세무 캘린더 자동 알림',
      'AI 공지 초안 · 업무 어시스턴트',
      '초대 링크 간편 온보딩',
    ],
    tip: '세무 신고 깜빡? 35일 전부터 자동 알림',
  },
  {
    id: 'care',
    icon: '🏥',
    label: '돌봄 / 의료',
    sub: '요양원 · 병원 · 복지시설',
    minPlan: 'pro',
    included: [
      'GPS 출퇴근 (방문 케어 포함)',
      '케어 세션 · 수급자 기록',
      '자격증 · 갱신일 자동 추적',
      '야간 · 휴일 수당 자동 계산',
      '방문 돌봄 차량 연동',
    ],
    tip: '자격증 갱신일, 이제 시스템이 추적합니다',
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
  },
];

export const PLANS: Record<PlanKey, {
  name: string;
  label: string;
  price: number;          // 월간 정가
  priceYearly: number;    // 연간 (월 환산 = price × 0.8)
  yearlyDiscount: number; // %
  maxEmployees: number;
  features: string[];
}> = {
  free: {
    name: 'Free',
    label: '무료',
    price: 0,
    priceYearly: 0,
    yearlyDiscount: 0,
    maxEmployees: 5,
    features: ['직원 5명 이하', '기본 출퇴근 기록', '직원 프로필 관리', '모바일 앱'],
  },
  basic: {
    name: 'Basic',
    label: '베이직',
    price: 49000,
    priceYearly: 470400,   // 49,000 × 12 × 0.8
    yearlyDiscount: 20,
    maxEmployees: 30,
    features: ['직원 최대 30명', '급여 명세서 발행', '전자결재 기본', '시프트 스케줄', '세무 캘린더'],
  },
  pro: {
    name: 'Pro',
    label: '프로',
    price: 99000,
    priceYearly: 950400,   // 99,000 × 12 × 0.8
    yearlyDiscount: 20,
    maxEmployees: 100,
    features: ['직원 최대 100명', 'AI 어시스턴트', '고급 리포트 · 분석', '전자결재 고급 (봉인·보존)', '우선 고객 지원'],
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
  { id: 'contract',          emoji: '📝', name: '전자계약서',         desc: '근로계약서 전자 서명 · 법적 보관',          price: 9900, popular: true  },
  { id: 'tax_alert',         emoji: '📅', name: '세무 자동 알림',     desc: '35일 이내 세무 · 노무 할 일 자동 알림',    price: 5000, popular: true  },
  { id: 'extra_ai_50',       emoji: '🤖', name: 'AI 어시스턴트 확장', desc: '공지 초안 생성 · 업무 분석 (+50회/일)',    price: 8000, popular: false },
  { id: 'extra_location',    emoji: '🏢', name: '추가 지점 (+1개)',   desc: '사업장(지점) 1개 추가 관리',              price: 9900, popular: false },
  { id: 'extra_employees_5', emoji: '👥', name: '추가 직원 (+5명)',   desc: '직원 한도를 5명 추가 (여러 개 구매 가능)', price: 5000, popular: false },
];

export function derivePlan(type: BusinessType, employees: number): PlanKey | 'enterprise' {
  if (employees > 100) return 'enterprise';  // Pro 상한 100명 초과 시 → 영업 문의
  if (employees > 30) return 'pro';
  if (employees > 5) return type.minPlan;
  return type.minPlan === 'pro' ? 'pro' : 'free';
}

export function fmt(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

/** quote URL 생성 헬퍼 */
export function buildQuoteUrl(params: {
  planKey: PlanKey | 'enterprise';
  employees: number;
  addons: string[];
  typeId: string;
}): string {
  const p = new URLSearchParams({
    plan: params.planKey,
    employees: String(params.employees),
    type: params.typeId,
  });
  if (params.addons.length) p.set('addons', params.addons.join(','));
  return `/quote?${p.toString()}`;
}
