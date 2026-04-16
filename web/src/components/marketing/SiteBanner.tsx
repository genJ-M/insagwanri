'use client';

import { useState } from 'react';

interface BannerData {
  id: string;
  text: string;
  link_url?: string | null;
  link_text?: string | null;
  bg_color: string;
  text_color: string;
}

export default function SiteBanner({ banner }: { banner: BannerData | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (!banner || dismissed) return null;

  return (
    <div
      className="w-full py-2.5 px-4 text-center text-sm font-medium flex items-center justify-center gap-3 relative"
      style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
    >
      <span>{banner.text}</span>
      {banner.link_url && (
        <a
          href={banner.link_url}
          className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity"
        >
          {banner.link_text ?? '자세히 보기'}
        </a>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="배너 닫기"
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: banner.text_color }}
      >
        ✕
      </button>
    </div>
  );
}
