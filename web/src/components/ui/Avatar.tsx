'use client';
import { clsx } from 'clsx';

const COLORS = [
  { bg: '#FFE0EC', text: '#C2185B' }, // 핑크
  { bg: '#DBEAFE', text: '#1D4ED8' }, // 파랑
  { bg: '#FEF9C3', text: '#A16207' }, // 노랑
  { bg: '#DCFCE7', text: '#15803D' }, // 초록
  { bg: '#EDE9FE', text: '#6D28D9' }, // 보라
  { bg: '#CCFBF1', text: '#0F766E' }, // 민트
  { bg: '#FFEDD5', text: '#C2410C' }, // 오렌지
  { bg: '#E0E7FF', text: '#3730A3' }, // 인디고
];

const SIZES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-lg',
};

function getColor(name: string) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  src?: string | null;
  className?: string;
}

export default function Avatar({ name, size = 'md', src, className }: AvatarProps) {
  const color = getColor(name);
  const initial = name ? name.trim()[0].toUpperCase() : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover flex-shrink-0', SIZES[size], className)}
      />
    );
  }

  return (
    <span
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color.bg, color: color.text }}
      aria-label={name}
    >
      {initial}
    </span>
  );
}

/** 여러 아바타를 겹쳐 표시 */
export function AvatarGroup({
  names,
  size = 'sm',
  max = 4,
}: {
  names: string[];
  size?: keyof typeof SIZES;
  max?: number;
}) {
  const visible = names.slice(0, max);
  const rest = names.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((name, i) => (
        <Avatar
          key={i}
          name={name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {rest > 0 && (
        <span
          className={clsx(
            'rounded-full flex items-center justify-center font-semibold ring-2 ring-white bg-gray-100 text-gray-500 flex-shrink-0',
            SIZES[size],
            'text-[10px]',
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
