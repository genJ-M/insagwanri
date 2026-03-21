'use client';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** 모달 내부 콘텐츠가 길어질 때 스크롤 활성화 */
  scrollable?: boolean;
  /** body 영역 className 오버라이드 (예: padding 제거) */
  bodyClassName?: string;
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl' };

export default function Modal({
  open, onClose, title, subtitle, children,
  size = 'md', scrollable = false, bodyClassName,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className={clsx(
        'relative w-full bg-white rounded-xl shadow-xl',
        sizes[size],
        scrollable && 'max-h-[85vh] flex flex-col',
      )}>
        {/* Header */}
        {(title !== undefined) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-text-primary">{title}</h2>
              {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors ml-4"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Body */}
        <div className={clsx(
          scrollable && 'flex-1 overflow-y-auto',
          bodyClassName ?? 'px-6 py-5',
        )}>
          {children}
        </div>
      </div>
    </div>
  );
}
