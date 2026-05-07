import { ModuleId } from './module-catalog.constants';

export type IndustryPresetId =
  | 'office'
  | 'food'
  | 'construction'
  | 'care'
  | 'retail'
  | 'public'
  | 'education'
  | 'sales';

export interface IndustryPreset {
  id: IndustryPresetId;
  name: string;
  icon: string;
  description: string;
  // 이 프리셋을 선택했을 때 기본으로 활성화할 모듈 (플랜 범위 내에서만 적용)
  recommendedModules: ModuleId[];
}

export const INDUSTRY_PRESETS: Record<IndustryPresetId, IndustryPreset> = {
  office: {
    id: 'office',
    name: '일반 사무실 / IT',
    icon: '🏢',
    description: '사무직·IT·서비스업 — 전자결재, AI, 채팅 중심',
    recommendedModules: [
      'attendance',
      'tasks',
      'approvals',
      'calendar',
      'collaboration',
      'search',
      'ai',
      'evaluations',
      'training',
      'vacations',
    ],
  },

  food: {
    id: 'food',
    name: '카페 / 식당',
    icon: '☕',
    description: '요식업·음식점 — 시프트, 주휴수당, 급여 중심',
    recommendedModules: [
      'attendance',
      'shift_schedule',
      'shift_swap',
      'salary',
      'vacations',
      'tasks',
      'contracts',
    ],
  },

  construction: {
    id: 'construction',
    name: '건설 / 현장직',
    icon: '🏗️',
    description: '현장·외근·일용직 — GPS 체크인, 일용직 급여 중심',
    recommendedModules: [
      'attendance',
      'field_visits',
      'locations',
      'salary',
      'contracts',
      'shift_schedule',
      'tasks',
    ],
  },

  care: {
    id: 'care',
    name: '돌봄 / 의료',
    icon: '🏥',
    description: '요양원·병원·복지시설 — 케어세션, 자격증, 방문 기록',
    recommendedModules: [
      'attendance',
      'care_worker',
      'field_visits',
      'locations',
      'training',
      'salary',
      'vacations',
      'contracts',
    ],
  },

  retail: {
    id: 'retail',
    name: '소매 / 유통',
    icon: '🛍️',
    description: '편의점·마트·매장 — 다지점, 시프트, 아르바이트 급여',
    recommendedModules: [
      'attendance',
      'shift_schedule',
      'shift_swap',
      'salary',
      'tasks',
      'locations',
      'vacations',
      'contracts',
    ],
  },

  public: {
    id: 'public',
    name: '공공 / 관공서',
    icon: '🏛️',
    description: '공공기관·관공서 — 결재, 세무, 인사평가 중심',
    recommendedModules: [
      'attendance',
      'approvals',
      'contracts',
      'vacations',
      'hr_notes',
      'evaluations',
      'tax_documents',
      'salary',
      'training',
      'calendar_settings',
    ],
  },

  education: {
    id: 'education',
    name: '교육 / 학원',
    icon: '📚',
    description: '학교·학원·교육기관 — 교육 관리, 평가, 일정 중심',
    recommendedModules: [
      'attendance',
      'tasks',
      'training',
      'calendar',
      'vacations',
      'salary',
      'evaluations',
      'schedules',
    ],
  },

  sales: {
    id: 'sales',
    name: '영업 / 외근',
    icon: '🚗',
    description: '영업직·외근직 — 현장 방문, 위치, 성과 관리',
    recommendedModules: [
      'attendance',
      'field_visits',
      'locations',
      'tasks',
      'salary',
      'calendar',
      'collaboration',
      'schedules',
    ],
  },
};
