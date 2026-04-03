// 한국 공휴일 유틸리티
// - 고정 공휴일: 연도만 넘기면 자동 계산
// - 음력 공휴일(설·추석·부처님오신날): 2024~2030 룩업 테이블

export interface KoreanHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

// ─── 고정 공휴일 (매년 동일 날짜) ──────────────────────────────────────────

function fixed(year: number): KoreanHoliday[] {
  return [
    { date: `${year}-01-01`, name: '신정' },
    { date: `${year}-03-01`, name: '삼일절' },
    { date: `${year}-05-05`, name: '어린이날' },
    { date: `${year}-06-06`, name: '현충일' },
    { date: `${year}-08-15`, name: '광복절' },
    { date: `${year}-10-03`, name: '개천절' },
    { date: `${year}-10-09`, name: '한글날' },
    { date: `${year}-12-25`, name: '성탄절' },
  ];
}

// ─── 음력 공휴일 (연도별 룩업 테이블) ──────────────────────────────────────
// 설 연휴 = 전날·당일·다음날 / 추석 연휴 = 전날·당일·다음날

const LUNAR_TABLE: Record<number, KoreanHoliday[]> = {
  2024: [
    { date: '2024-02-09', name: '설날 연휴' },
    { date: '2024-02-10', name: '설날' },
    { date: '2024-02-11', name: '설날 연휴' },
    { date: '2024-02-12', name: '대체공휴일' },
    { date: '2024-05-15', name: '부처님 오신 날' },
    { date: '2024-09-16', name: '추석 연휴' },
    { date: '2024-09-17', name: '추석' },
    { date: '2024-09-18', name: '추석 연휴' },
  ],
  2025: [
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-05-05', name: '부처님 오신 날' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일' },
  ],
  2026: [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-05-24', name: '부처님 오신 날' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
  ],
  2027: [
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-05-13', name: '부처님 오신 날' },
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
  ],
  2028: [
    { date: '2028-01-25', name: '설날 연휴' },
    { date: '2028-01-26', name: '설날' },
    { date: '2028-01-27', name: '설날 연휴' },
    { date: '2028-05-02', name: '부처님 오신 날' },
    { date: '2028-10-02', name: '추석 연휴' },
    { date: '2028-10-03', name: '추석' },
    { date: '2028-10-04', name: '추석 연휴' },
  ],
  2029: [
    { date: '2029-02-12', name: '설날 연휴' },
    { date: '2029-02-13', name: '설날' },
    { date: '2029-02-14', name: '설날 연휴' },
    { date: '2029-05-20', name: '부처님 오신 날' },
    { date: '2029-09-22', name: '추석 연휴' },
    { date: '2029-09-23', name: '추석' },
    { date: '2029-09-24', name: '추석 연휴' },
  ],
  2030: [
    { date: '2030-02-02', name: '설날 연휴' },
    { date: '2030-02-03', name: '설날' },
    { date: '2030-02-04', name: '설날 연휴' },
    { date: '2030-05-09', name: '부처님 오신 날' },
    { date: '2030-09-12', name: '추석 연휴' },
    { date: '2030-09-13', name: '추석' },
    { date: '2030-09-14', name: '추석 연휴' },
  ],
};

// ─── 공개 API ────────────────────────────────────────────────────────────────

/** 특정 연도의 전체 공휴일 목록 반환 */
export function getHolidaysByYear(year: number): KoreanHoliday[] {
  return [...fixed(year), ...(LUNAR_TABLE[year] ?? [])];
}

/** 특정 연·월의 공휴일 맵 반환 (key: YYYY-MM-DD) */
export function getHolidayMap(year: number, month: number): Map<string, string> {
  const map = new Map<string, string>();
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const h of getHolidaysByYear(year)) {
    if (h.date.startsWith(prefix)) {
      map.set(h.date, h.name);
    }
  }
  return map;
}
