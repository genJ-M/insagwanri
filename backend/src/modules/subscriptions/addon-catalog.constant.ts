export interface AddonItem {
  code: string;
  name: string;
  description: string;
  unit: string;
  priceMonthlyKrw: number;
  priceYearlyKrw: number;
  emoji: string;
}

export const ADDON_CATALOG: AddonItem[] = [
  {
    code: 'extra_employees_5',
    name: '추가 직원 (+5명)',
    description: '직원 한도를 5명 추가합니다. 여러 개 구매 가능합니다.',
    unit: '5명 단위',
    priceMonthlyKrw: 5000,
    priceYearlyKrw: 50000,
    emoji: '👥',
  },
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
    priceMonthlyKrw: 8000,
    priceYearlyKrw: 80000,
    emoji: '🤖',
  },
  {
    code: 'extra_location',
    name: '추가 지점 (+1개)',
    description: '사업장(지점)을 1개 추가합니다. 여러 개 구매 가능합니다.',
    unit: '지점 1개 단위',
    priceMonthlyKrw: 9900,
    priceYearlyKrw: 99000,
    emoji: '🏢',
  },
];

export function findAddon(code: string): AddonItem | undefined {
  return ADDON_CATALOG.find((a) => a.code === code);
}
