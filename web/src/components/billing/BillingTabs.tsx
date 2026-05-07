'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { href: '/billing',         label: '구독',     icon: CreditCard },
  { href: '/billing/credits', label: 'AI 크레딧', icon: Sparkles   },
];

export default function BillingTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-zinc-100 -mx-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary-500 text-primary-700'
                : 'border-transparent text-text-muted hover:text-text-primary',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
