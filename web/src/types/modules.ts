export type ModuleGroup =
  | 'attendance'
  | 'work'
  | 'hr'
  | 'payroll'
  | 'communication'
  | 'advanced';

export interface ModuleStatus {
  id: string;
  name: string;
  description: string;
  group: ModuleGroup;
  isBase: boolean;
  isActive: boolean;
  source: 'plan' | 'addon' | 'manual' | null;
}

export type ModuleId =
  | 'attendance' | 'attendance_methods' | 'locations' | 'field_visits'
  | 'tasks' | 'schedules' | 'calendar' | 'calendar_settings'
  | 'approvals' | 'shift_schedule' | 'shift_swap'
  | 'vacations' | 'contracts' | 'hr_notes' | 'evaluations' | 'training'
  | 'salary' | 'tax_documents'
  | 'collaboration' | 'search'
  | 'ai' | 'care_worker' | 'custom_templates' | 'activity_logs_view' | 'credits';

// BASE 모듈 — 항상 활성, 접근 제어 없음
export const BASE_MODULE_IDS = [
  'auth', 'users', 'workspace', 'notifications',
  'invitations', 'files', 'health', 'dashboard',
] as const;

// 플랜명 → 포함 모듈 (프론트 업그레이드 안내용)
export const PLAN_LABEL: Record<string, string> = {
  free: '무료',
  basic: '베이직',
  pro: '프로',
  enterprise: '엔터프라이즈',
};

// 모듈ID → 최소 필요 플랜 (업그레이드 안내용)
export const MODULE_MIN_PLAN: Record<string, string> = {
  attendance: 'free',
  tasks: 'free',
  calendar: 'free',
  vacations: 'free',
  schedules: 'free',
  attendance_methods: 'basic',
  locations: 'basic',
  contracts: 'basic',
  salary: 'basic',
  shift_schedule: 'basic',
  shift_swap: 'basic',
  approvals: 'basic',
  collaboration: 'basic',
  tax_documents: 'basic',
  calendar_settings: 'basic',
  ai: 'pro',
  field_visits: 'pro',
  hr_notes: 'pro',
  evaluations: 'pro',
  training: 'pro',
  search: 'pro',
  custom_templates: 'pro',
  activity_logs_view: 'pro',
  credits: 'pro',
  care_worker: 'enterprise',
};
