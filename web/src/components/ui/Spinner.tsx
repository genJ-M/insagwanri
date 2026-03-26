import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  xs: 'h-3.5 w-3.5 border-[1.5px]',
  sm: 'h-5 w-5 border-2',
  md: 'h-7 w-7 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'rounded-full border-primary-200 border-t-primary-500 animate-spin',
        SIZE[size],
        className,
      )}
      aria-label="로딩 중"
    />
  );
}
