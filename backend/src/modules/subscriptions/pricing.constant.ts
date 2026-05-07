/**
 * 구독 가격 산정 상수 & 유틸 (프론트 web/src/lib/landing-pricing.ts와 동기화 유지)
 *
 * 가격 모델: 플랜 기본료 + 인원 추가 graduated per-seat
 *  - Free:  1명 무료
 *  - Basic: 기본료 29,000원 (1명 포함) + 2~10명 인당 2,000원 / 11~30명 인당 1,500원
 *  - Pro:   기본료 49,000원 (1명 포함) + 2~30명 인당 2,000원 / 31~50명 인당 1,500원 / 51~100명 인당 1,000원
 *
 * 추가 지점:
 *  - 1개당 9,900원/월
 */

export type PlanName = 'free' | 'basic' | 'pro' | 'enterprise';

export interface SeatTier {
  upTo: number;
  pricePerSeatKrw: number;
}

export const SEAT_TIERS: Record<'basic' | 'pro', SeatTier[]> = {
  basic: [
    { upTo: 10, pricePerSeatKrw: 2_000 },
    { upTo: 30, pricePerSeatKrw: 1_500 },
  ],
  pro: [
    { upTo: 30,  pricePerSeatKrw: 2_000 },
    { upTo: 50,  pricePerSeatKrw: 1_500 },
    { upTo: 100, pricePerSeatKrw: 1_000 },
  ],
};

/** 기본료 (1명 포함) — DB plans.price_monthly_krw 와 동기화 */
export const PLAN_BASE_FEE_KRW: Record<'basic' | 'pro', number> = {
  basic: 29_000,
  pro:   49_000,
};

export const EXTRA_LOCATION_PRICE_KRW = 9_900;

export interface SeatBreakdown {
  count: number;
  pricePerSeatKrw: number;
  subtotalKrw: number;
}

/** 직원 수에 따른 인원 추가 과금 합산 (1번째 직원은 기본료 포함) */
export function calcSeatsKrw(planName: PlanName, employees: number): number {
  if (planName === 'free' || planName === 'enterprise') return 0;
  if (employees <= 1) return 0;
  const tiers = SEAT_TIERS[planName];
  let cost = 0;
  let prev = 1;
  for (const tier of tiers) {
    if (employees <= prev) break;
    const end = Math.min(employees, tier.upTo);
    cost += (end - prev) * tier.pricePerSeatKrw;
    prev = tier.upTo;
  }
  return cost;
}

/** 구간별 과금 내역 */
export function calcSeatsBreakdown(planName: PlanName, employees: number): SeatBreakdown[] {
  if (planName === 'free' || planName === 'enterprise' || employees <= 1) return [];
  const tiers = SEAT_TIERS[planName];
  const out: SeatBreakdown[] = [];
  let prev = 1;
  for (const tier of tiers) {
    if (employees <= prev) break;
    const end = Math.min(employees, tier.upTo);
    const count = end - prev;
    if (count > 0) {
      out.push({ count, pricePerSeatKrw: tier.pricePerSeatKrw, subtotalKrw: count * tier.pricePerSeatKrw });
    }
    prev = tier.upTo;
  }
  return out;
}

/**
 * 일할 계산: 현재 청구주기 내 남은 일수에 비례한 비용
 *
 * @param fullMonthlyAmount 한 달 만큼의 추가 비용 (원)
 * @param periodStart       현재 청구주기 시작 (Date)
 * @param periodEnd         현재 청구주기 종료 (Date)
 * @param now               기준 시각 (default = Date.now())
 * @returns { totalDays, daysRemaining, factor, amountKrw }
 *
 * 정책: 같은 날짜 안에서는 1일로 처리. (반올림: Math.ceil)
 */
export interface ProrationResult {
  totalDays: number;
  daysRemaining: number;
  factor: number;        // 0..1
  amountKrw: number;     // 일할 적용된 비용
}

export function calcProration(
  fullMonthlyAmount: number,
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date(),
): ProrationResult {
  const MS_PER_DAY = 86_400_000;
  // 시작일 자정~종료일 자정으로 정규화하여 일수 계산
  const startMid = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate()));
  const endMid   = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate()));
  const nowMid   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const totalDays     = Math.max(1, Math.round((endMid.getTime() - startMid.getTime()) / MS_PER_DAY));
  const daysRemaining = Math.max(0, Math.round((endMid.getTime() - nowMid.getTime()) / MS_PER_DAY));

  if (totalDays === 0 || daysRemaining === 0) {
    return { totalDays, daysRemaining, factor: 0, amountKrw: 0 };
  }

  const factor = Math.min(1, daysRemaining / totalDays);
  const amountKrw = Math.round(fullMonthlyAmount * factor);

  return { totalDays, daysRemaining, factor, amountKrw };
}

/**
 * 플랜 + 직원수 + 지점 수 → 정상 월 합계 (VAT 별도)
 */
export interface MonthlyTotalBreakdown {
  baseFeeKrw: number;
  seatFeeKrw: number;
  locationFeeKrw: number;
  totalKrw: number;
  seatBreakdown: SeatBreakdown[];
}

export function calcMonthlyTotal(
  planName: PlanName,
  employees: number,
  extraLocations: number = 0,
  baseFeeKrwOverride?: number, // DB에서 읽은 plan.price_monthly_krw 우선 사용
): MonthlyTotalBreakdown {
  let baseFeeKrw = 0;
  if (planName === 'basic' || planName === 'pro') {
    baseFeeKrw = baseFeeKrwOverride ?? PLAN_BASE_FEE_KRW[planName];
  }
  const seatFeeKrw = calcSeatsKrw(planName, employees);
  const locationFeeKrw = Math.max(0, extraLocations) * EXTRA_LOCATION_PRICE_KRW;
  return {
    baseFeeKrw,
    seatFeeKrw,
    locationFeeKrw,
    totalKrw: baseFeeKrw + seatFeeKrw + locationFeeKrw,
    seatBreakdown: calcSeatsBreakdown(planName, employees),
  };
}
