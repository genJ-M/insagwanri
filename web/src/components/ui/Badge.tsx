import { clsx } from 'clsx';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

const styles: Record<BadgeVariant, string> = {
  gray:   'bg-gray-100 text-gray-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
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
  pending:    'gray',
  normal:     'green',
  late:       'yellow',
  early_leave:'orange',
  absent:     'red',
  half_day:   'purple',
  vacation:   'blue',
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
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[variant], className)}>
      {displayLabel}
    </span>
  );
}
