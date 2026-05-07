export interface AddonItem {
  code: string;
  name: string;
  description: string;
  unit: string;
  priceMonthlyKrw: number;
  priceYearlyKrw: number;
  emoji: string;
}

/**
 * 직원 추가(extra_employees_N)와 지점 추가(extra_location)는
 * per-seat pricing 모델로 이동했습니다.
 *  - 직원: subscriptions.seat_count + SEAT_TIERS (`POST /seats/add`)
 *  - 지점: subscriptions.extra_locations (`POST /locations/add`)
 *
 * 여기 남은 항목은 정액 부가서비스(컴퍼니 단위 기능 토글)만.
 */
export const ADDON_CATALOG: AddonItem[] = [
  {
    code: 'extra_storage_10gb',
    name: '추가 저장공간 (+10GB)',
    description: '파일·첨부 저장공간을 10GB 추가합니다.',
    unit: '10GB 단위',
    priceMonthlyKrw: 3000,
    priceYearlyKrw: 30000,
    emoji: '🗄️',
  },
  {
    code: 'extra_ai_50',
    name: 'AI 기능 확장 (+50회/일)',
    description: 'AI 일일 사용 횟수를 50회 추가합니다.',
    unit: '50회/일 단위',
    priceMonthlyKrw: 9900,
    priceYearlyKrw: 99000,
    emoji: '🤖',
  },
  {
    code: 'contract',
    name: '전자계약서',
    description: '근로계약서 전자 서명 및 법적 보관 기능을 활성화합니다.',
    unit: '회사 단위',
    priceMonthlyKrw: 9900,
    priceYearlyKrw: 99000,
    emoji: '📝',
  },
  {
    code: 'tax_alert',
    name: '세무 자동 알림',
    description: '35일 이내 세무·노무 할 일을 자동으로 알림 발송합니다.',
    unit: '회사 단위',
    priceMonthlyKrw: 6900,
    priceYearlyKrw: 69000,
    emoji: '📅',
  },
];

export function findAddon(code: string): AddonItem | undefined {
  return ADDON_CATALOG.find((a) => a.code === code);
}
