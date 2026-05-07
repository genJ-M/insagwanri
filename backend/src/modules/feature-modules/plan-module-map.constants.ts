import { ModuleId } from './module-catalog.constants';

export type PlanName = 'free' | 'basic' | 'pro' | 'enterprise';

// 각 플랜에 포함된 모듈 목록
// 상위 플랜은 하위 플랜의 모든 모듈을 포함 (누적)
export const PLAN_MODULES: Record<PlanName, ModuleId[]> = {
  free: [
    'attendance',
    'tasks',
    'calendar',
    'vacations',
    'schedules',
  ],

  basic: [
    // FREE 전체 포함
    'attendance',
    'tasks',
    'calendar',
    'vacations',
    'schedules',
    // BASIC 추가
    'attendance_methods',
    'locations',
    'contracts',
    'salary',
    'shift_schedule',
    'shift_swap',
    'approvals',
    'collaboration',
    'tax_documents',
    'calendar_settings',
  ],

  pro: [
    // BASIC 전체 포함
    'attendance',
    'tasks',
    'calendar',
    'vacations',
    'schedules',
    'attendance_methods',
    'locations',
    'contracts',
    'salary',
    'shift_schedule',
    'shift_swap',
    'approvals',
    'collaboration',
    'tax_documents',
    'calendar_settings',
    // PRO 추가
    'ai',
    'field_visits',
    'hr_notes',
    'evaluations',
    'training',
    'search',
    'custom_templates',
    'activity_logs_view',
    'credits',
  ],

  enterprise: [
    // PRO 전체 포함
    'attendance',
    'tasks',
    'calendar',
    'vacations',
    'schedules',
    'attendance_methods',
    'locations',
    'contracts',
    'salary',
    'shift_schedule',
    'shift_swap',
    'approvals',
    'collaboration',
    'tax_documents',
    'calendar_settings',
    'ai',
    'field_visits',
    'hr_notes',
    'evaluations',
    'training',
    'search',
    'custom_templates',
    'activity_logs_view',
    'credits',
    // ENTERPRISE 추가
    'care_worker',
  ],
};

// 애드온 코드 → 활성화되는 모듈 ID 매핑
// addon-catalog.constant.ts의 code 값과 반드시 일치해야 함
export const ADDON_MODULE_MAP: Record<string, ModuleId> = {
  // 실제 카탈로그 코드
  contract:           'contracts',    // 전자계약서 애드온 → contracts 모듈
  // 향후 추가될 모듈형 애드온용 (카탈로그에 추가 시 코드 맞춰 등록)
  addon_care_worker:  'care_worker',
  addon_field_visits: 'field_visits',
  addon_ai:           'ai',
};

// 플랜 이름 정규화 (DB plans 테이블의 name 컬럼값 → PlanName)
// plans 테이블에서 name 컬럼이 'Free', 'Basic', 'Pro', 'Enterprise' 등으로 저장된 경우 처리
export function normalizePlanName(raw: string): PlanName {
  const lower = raw.toLowerCase();
  if (lower === 'enterprise') return 'enterprise';
  if (lower === 'pro') return 'pro';
  if (lower === 'basic') return 'basic';
  return 'free';
}
