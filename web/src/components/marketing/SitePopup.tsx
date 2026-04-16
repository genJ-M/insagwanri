'use client';

import { useState, useEffect } from 'react';

interface PopupData {
  id: string;
  title: string;
  body: string;
  cta_text?: string | null;
  cta_url?: string | null;
  trigger_type: string; // 'immediate' | 'scroll' | 'delay'
  trigger_value: number; // seconds for delay, percent for scroll
  dismiss_days: number;
}

function isDismissed(popup: PopupData): boolean {
  if (typeof window === 'undefined') return false;
  const key = `popup_dismissed_${popup.id}`;
  const val = localStorage.getItem(key);
  if (!val) return false;
  const until = parseInt(val, 10);
  return Date.now() < until;
}

function markDismissed(popup: PopupData) {
  const key = `popup_dismissed_${popup.id}`;
  const until = Date.now() + popup.dismiss_days * 86400 * 1000;
  localStorage.setItem(key, String(until));
}

function PopupModal({ popup, onClose }: { popup: PopupData; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="팝업 닫기"
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-black text-text-primary mb-3 pr-6">{popup.title}</h2>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line mb-6">
          {popup.body}
        </p>

        {popup.cta_text && (
          <a
            href={popup.cta_url ?? '#'}
            className="block w-full text-center bg-primary-600 hover:bg-primary-700 text-white
                       font-semibold text-sm py-3 rounded-xl transition-colors"
            onClick={onClose}
          >
            {popup.cta_text}
          </a>
        )}
      </div>
    </div>
  );
}

export default function SitePopup({ popups }: { popups: PopupData[] }) {
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);

  useEffect(() => {
    const candidates = popups.filter((p) => !isDismissed(p));
    if (!candidates.length) return;

    // immediate 처리 (trigger_type 별 구분)
    for (const popup of candidates) {
      if (popup.trigger_type === 'immediate') {
        setActivePopup(popup);
        return;
      }
      if (popup.trigger_type === 'delay') {
        const ms = (popup.trigger_value || 3) * 1000;
        const t = setTimeout(() => setActivePopup(popup), ms);
        return () => clearTimeout(t);
      }
    }
    // scroll trigger
    const scrollPopups = candidates.filter((p) => p.trigger_type === 'scroll');
    if (!scrollPopups.length) return;
    const popup = scrollPopups[0];
    const threshold = popup.trigger_value || 50; // percent
    const handler = () => {
      const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (pct >= threshold) {
        setActivePopup(popup);
        window.removeEventListener('scroll', handler);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [popups]);

  if (!activePopup) return null;

  return (
    <PopupModal
      popup={activePopup}
      onClose={() => {
        markDismissed(activePopup);
        setActivePopup(null);
      }}
    />
  );
}
