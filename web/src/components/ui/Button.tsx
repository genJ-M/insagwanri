import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:   'bg-primary-500 hover:bg-primary-600 text-white disabled:bg-primary-100 disabled:text-primary-300 active:scale-[0.98]',
  secondary: 'bg-white border-[1.5px] border-primary-500 text-primary-500 hover:bg-primary-50 disabled:opacity-50 active:scale-[0.98]',
  ghost:     'text-text-secondary hover:bg-background disabled:opacity-50',
  danger:    'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 active:scale-[0.98]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

/** Link 등 non-button 요소에 Button 스타일을 적용할 때 사용 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
} = {}) {
  return clsx(
    'inline-flex items-center gap-2 rounded-lg font-semibold transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
    variants[variant!],
    sizes[size!],
    className,
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg font-semibold transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
