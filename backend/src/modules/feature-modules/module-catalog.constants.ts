export type ModuleGroup =
  | 'attendance'
  | 'work'
  | 'hr'
  | 'payroll'
  | 'communication'
  | 'advanced';

export interface ModuleDefinition {
  id: string;
  name: string;         // 한국어 표시명
  description: string;
  group: ModuleGroup;
  isBase: boolean;      // true면 Guard에서 DB 조회 없이 통과
}

// ─── BASE 모듈 (필수, 제거 불가) ──────────────────────────────────────────
// Guard에서 상수로 체크 — company_modules 테이블에 저장하지 않음

export const BASE_MODULE_IDS = [
  'auth',
  'users',
  'workspace',
  'notifications',
  'invitations',
  'files',
  'health',
  'dashboard',
] as const;

export type BaseModuleId = (typeof BASE_MODULE_IDS)[number];

// ─── 선택 모듈 ID 목록 ────────────────────────────────────────────────────

export const MODULE_IDS = [
  // 근태
  'attendance',
  'attendance_methods',
  'locations',
  'field_visits',
  // 업무
  'tasks',
  'schedules',
  'calendar',
  'calendar_settings',
  'approvals',
  'shift_schedule',
  'shift_swap',
  // HR
  'vacations',
  'contracts',
  'hr_notes',
  'evaluations',
  'training',
  // 급여·세무
  'salary',
  'tax_documents',
  // 소통
  'collaboration',
  'search',
  // 고급
  'ai',
  'care_worker',
  'custom_templates',
  'activity_logs_view',
  'credits',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

// ─── 전체 모듈 카탈로그 ────────────────────────────────────────────────────

export const MODULE_CATALOG: Record<ModuleId, ModuleDefinition> = {
  // 근태 그룹
  attendance: {
    id: 'attendance',
    name: '출퇴근',
    description: 'QR·GPS·WiFi 출퇴근 기록',
    group: 'attendance',
    isBase: false,
  },
  attendance_methods: {
    id: 'attendance_methods',
    name: '출퇴근 방식 설정',
    description: '인증 방식(QR/GPS/WiFi) 세부 설정',
    group: 'attendance',
    isBase: false,
  },
  locations: {
    id: 'locations',
    name: '지점·사업장 관리',
    description: '여러 지점 위치 등록 및 관리',
    group: 'attendance',
    isBase: false,
  },
  field_visits: {
    id: 'field_visits',
    name: '현장 방문',
    description: '외근·현장 방문 기록 및 GPS 체크인',
    group: 'attendance',
    isBase: false,
  },

  // 업무 그룹
  tasks: {
    id: 'tasks',
    name: '업무 관리',
    description: '업무 생성·할당·보고',
    group: 'work',
    isBase: false,
  },
  schedules: {
    id: 'schedules',
    name: '스케줄',
    description: '개인 일정 관리',
    group: 'work',
    isBase: false,
  },
  calendar: {
    id: 'calendar',
    name: '캘린더',
    description: '공유 캘린더·일정 공유',
    group: 'work',
    isBase: false,
  },
  calendar_settings: {
    id: 'calendar_settings',
    name: '캘린더 설정',
    description: '반복 일정·세무 캘린더·부서 가시성',
    group: 'work',
    isBase: false,
  },
  approvals: {
    id: 'approvals',
    name: '전자결재',
    description: '결재 문서·법적 봉인·5년 보존',
    group: 'work',
    isBase: false,
  },
  shift_schedule: {
    id: 'shift_schedule',
    name: '팀 근무표',
    description: '교대근무 스케줄·배정·인수인계',
    group: 'work',
    isBase: false,
  },
  shift_swap: {
    id: 'shift_swap',
    name: '근무 교환',
    description: '시프트 교환 요청 및 승인',
    group: 'work',
    isBase: false,
  },

  // HR 그룹
  vacations: {
    id: 'vacations',
    name: '휴가 관리',
    description: '휴가 신청·승인·잔여 일수 관리',
    group: 'hr',
    isBase: false,
  },
  contracts: {
    id: 'contracts',
    name: '근로계약서',
    description: '계약서 관리·전자서명·이력 보관',
    group: 'hr',
    isBase: false,
  },
  hr_notes: {
    id: 'hr_notes',
    name: '인사 노트',
    description: 'HR 메모·비공개 노트 (관리자 전용)',
    group: 'hr',
    isBase: false,
  },
  evaluations: {
    id: 'evaluations',
    name: '인사평가',
    description: '평가 사이클·설문·결과 관리',
    group: 'hr',
    isBase: false,
  },
  training: {
    id: 'training',
    name: '교육 관리',
    description: '교육 과정·수강 신청·이수 관리',
    group: 'hr',
    isBase: false,
  },

  // 급여·세무 그룹
  salary: {
    id: 'salary',
    name: '급여 관리',
    description: '급여 계산·명세서 발행·주휴수당',
    group: 'payroll',
    isBase: false,
  },
  tax_documents: {
    id: 'tax_documents',
    name: '세무·노무 서류',
    description: '세금 서류 생성·35일 전 자동 알림',
    group: 'payroll',
    isBase: false,
  },

  // 소통 그룹
  collaboration: {
    id: 'collaboration',
    name: '메시지',
    description: '채팅·채널·메시지 (실시간)',
    group: 'communication',
    isBase: false,
  },
  search: {
    id: 'search',
    name: '통합 검색',
    description: '직원·업무·서류 통합 검색',
    group: 'communication',
    isBase: false,
  },

  // 고급 그룹
  ai: {
    id: 'ai',
    name: 'AI 도구',
    description: 'AI 어시스턴트·공지 초안·업무 분석',
    group: 'advanced',
    isBase: false,
  },
  care_worker: {
    id: 'care_worker',
    name: '요양보호사 관리',
    description: '케어세션·수급자 기록·자격증 추적 (의료·요양 특화)',
    group: 'advanced',
    isBase: false,
  },
  custom_templates: {
    id: 'custom_templates',
    name: '커스텀 템플릿',
    description: '문서 양식 커스터마이징',
    group: 'advanced',
    isBase: false,
  },
  activity_logs_view: {
    id: 'activity_logs_view',
    name: '활동 로그 열람',
    description: '관리자 감사 로그 조회',
    group: 'advanced',
    isBase: false,
  },
  credits: {
    id: 'credits',
    name: '크레딧',
    description: '크레딧 포인트 시스템',
    group: 'advanced',
    isBase: false,
  },
};
