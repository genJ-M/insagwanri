import { clsx } from 'clsx';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'slate';

const styles: Record<BadgeVariant, string> = {
  gray:   'bg-gray-100 text-gray-500',
  blue:   'bg-primary-100 text-primary-600',
  green:  'bg-emerald-100 text-emerald-800',
  yellow: 'bg-amber-100 text-amber-800',
  red:    'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  slate:  'bg-slate-100 text-slate-600',
};

// 역할 / 고용형태 뱃지
export const ROLE_BADGE: Record<string, BadgeVariant> = {
  owner:   'purple',
  manager: 'green',
  employee:'blue',
};

export const EMPLOYMENT_BADGE: Record<string, BadgeVariant> = {
  full_time:  'slate',
  contract:   'yellow',
  part_time:  'orange',
  intern:     'gray',
};

export const ROLE_LABEL: Record<string, string> = {
  owner: '소유자', manager: '관리자', employee: '직원',
};

export const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: '정규직', contract: '계약직', part_time: '파트타임', intern: '인턴',
};

// 상태별 색상 매핑
export const TASK_STATUS_BADGE: Record<string, BadgeVariant> = {
  pending:     'gray',
  in_progress: 'blue',
  review:      'yellow',
  done:        'green',
  cancelled:   'red',
};

export const TASK_PRIORITY_BADGE: Record<string, BadgeVariant> = {
  low:    'gray',
  normal: 'blue',
  high:   'orange',
  urgent: 'red',
};

export const ATTENDANCE_STATUS_BADGE: Record<string, BadgeVariant> = {
  pending:     'gray',
  normal:      'green',
  late:        'yellow',
  early_leave: 'orange',
  absent:      'red',
  half_day:    'purple',
  vacation:    'blue',
};

const LABELS: Record<string, string> = {
  pending: '대기', in_progress: '진행중', review: '검토중', done: '완료', cancelled: '취소',
  low: '낮음', normal: '보통', high: '높음', urgent: '긴급',
  normal_attend: '정상', late: '지각', early_leave: '조퇴', absent: '결근',
  half_day: '반차', vacation: '휴가',
};

interface BadgeProps {
  value: string;
  colorMap?: Record<string, BadgeVariant>;
  label?: string;
  className?: string;
}

export default function Badge({ value, colorMap, label, className }: BadgeProps) {
  const variant = (colorMap?.[value] ?? 'gray') as BadgeVariant;
  const displayLabel = label ?? LABELS[value] ?? value;

  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      styles[variant],
      className,
    )}>
      {displayLabel}
    </span>
  );
}
