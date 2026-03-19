'use client';
import { useEffect } from 'react';

const APP_NAME = '관리왕';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
