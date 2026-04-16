/**
 * 업종 코드 enum
 * 한국 표준산업분류 기반 중소사업장 주요 업종
 */
export enum IndustryCode {
  RESTAURANT     = 'restaurant',
  RETAIL         = 'retail',
  IT             = 'it',
  MANUFACTURING  = 'manufacturing',
  CONSTRUCTION   = 'construction',
  HEALTHCARE     = 'healthcare',
  EDUCATION      = 'education',
  BEAUTY         = 'beauty',
  LOGISTICS      = 'logistics',
  REALESTATE     = 'realestate',
  FINANCE        = 'finance',
  SERVICE        = 'service',
}

export interface IndustryPreset {
  code: IndustryCode;
  label: string;
  emoji: string;
  description: string;
  /**
   * 이 업종에서 기본으로 활성화할 기능 페이지 목록.
   * DepartmentPageVisibility 기본값 설정(P7)에서 사용.
   */
  defaultPages: string[];
  /**
   * 이 업종에서 권장하는 출퇴근 방식.
   */
  recommendedAttendanceMethods: ('manual' | 'gps' | 'wifi' | 'qr' | 'face')[];
}

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    code: IndustryCode.RESTAURANT,
    label: '음식점 / 카페',
    emoji: '🍽️',
    description: '식당, 카페, 베이커리, 프랜차이즈 요식업',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'tasks'],
    recommendedAttendanceMethods: ['qr', 'manual'],
  },
  {
    code: IndustryCode.RETAIL,
    label: '소매 / 유통',
    emoji: '🛒',
    description: '편의점, 마트, 의류·잡화 소매, 온라인 쇼핑몰',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'tasks', 'locations'],
    recommendedAttendanceMethods: ['qr', 'wifi', 'manual'],
  },
  {
    code: IndustryCode.IT,
    label: 'IT / 소프트웨어',
    emoji: '💻',
    description: '소프트웨어 개발, IT 서비스, 스타트업, 게임',
    defaultPages: ['attendance', 'vacations', 'tasks', 'approvals', 'calendar', 'team'],
    recommendedAttendanceMethods: ['manual', 'wifi', 'face'],
  },
  {
    code: IndustryCode.MANUFACTURING,
    label: '제조업',
    emoji: '🏭',
    description: '공장, 생산직, 가공·조립, 식품 제조',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'hr-notes', 'tasks', 'shift-swap'],
    recommendedAttendanceMethods: ['qr', 'face', 'gps'],
  },
  {
    code: IndustryCode.CONSTRUCTION,
    label: '건설 / 건축',
    emoji: '🏗️',
    description: '건설, 토목, 인테리어, 설비·전기 공사',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'contracts', 'tasks', 'field-visits'],
    recommendedAttendanceMethods: ['gps', 'qr', 'manual'],
  },
  {
    code: IndustryCode.HEALTHCARE,
    label: '의료 / 헬스케어',
    emoji: '🏥',
    description: '병원, 의원, 약국, 요양원, 헬스장·스포츠센터',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'hr-notes', 'approvals', 'care-worker'],
    recommendedAttendanceMethods: ['face', 'qr', 'manual'],
  },
  {
    code: IndustryCode.EDUCATION,
    label: '교육 / 학원',
    emoji: '📚',
    description: '학원, 교습소, 어린이집, 유치원, 과외',
    defaultPages: ['attendance', 'vacations', 'payroll', 'tasks', 'calendar', 'approvals'],
    recommendedAttendanceMethods: ['manual', 'wifi', 'qr'],
  },
  {
    code: IndustryCode.BEAUTY,
    label: '미용 / 뷰티',
    emoji: '💇',
    description: '미용실, 네일샵, 피부관리, 마사지',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'tasks'],
    recommendedAttendanceMethods: ['qr', 'manual'],
  },
  {
    code: IndustryCode.LOGISTICS,
    label: '물류 / 운송',
    emoji: '🚚',
    description: '배송, 택배, 화물, 창고관리, 이사',
    defaultPages: ['attendance', 'shift-schedule', 'vacations', 'payroll', 'tasks', 'contracts', 'field-visits'],
    recommendedAttendanceMethods: ['gps', 'manual'],
  },
  {
    code: IndustryCode.REALESTATE,
    label: '부동산 / 임대',
    emoji: '🏢',
    description: '부동산 중개, 임대관리, 자산관리',
    defaultPages: ['attendance', 'vacations', 'payroll', 'tasks', 'calendar', 'approvals'],
    recommendedAttendanceMethods: ['manual', 'wifi'],
  },
  {
    code: IndustryCode.FINANCE,
    label: '금융 / 보험',
    emoji: '💰',
    description: '보험, 대출, 증권, 회계·세무 사무소',
    defaultPages: ['attendance', 'vacations', 'payroll', 'approvals', 'hr-notes', 'calendar'],
    recommendedAttendanceMethods: ['face', 'manual', 'wifi'],
  },
  {
    code: IndustryCode.SERVICE,
    label: '기타 서비스',
    emoji: '🏪',
    description: '그 밖의 서비스업 또는 직접 입력',
    defaultPages: ['attendance', 'vacations', 'payroll', 'tasks'],
    recommendedAttendanceMethods: ['manual'],
  },
];

/** code로 프리셋 찾기 */
export function findPresetByCode(code: string): IndustryPreset | undefined {
  return INDUSTRY_PRESETS.find((p) => p.code === code);
}
