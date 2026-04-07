'use client';
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import FeedbackPanel from './FeedbackPanel';

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="도움말 및 피드백"
        title="도움이 필요하신가요?"
        className="
          fixed bottom-5 right-5 z-[100]
          w-10 h-10 rounded-full
          bg-white border border-zinc-200 shadow-md
          flex items-center justify-center
          text-text-muted
          opacity-30 hover:opacity-100
          transition-all duration-200
          hover:scale-110 hover:shadow-lg hover:border-primary-300 hover:text-primary-600
        "
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <FeedbackPanel
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
