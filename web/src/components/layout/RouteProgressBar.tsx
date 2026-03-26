'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // 진행 시작
    setWidth(0);
    setVisible(true);

    // 짧은 딜레이 후 빠르게 80%까지 진행
    timerRef.current = setTimeout(() => setWidth(80), 30);

    // 완료 처리 — pathname이 바뀌면 곧 렌더 완료로 간주
    const done = setTimeout(() => {
      setWidth(100);
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 300);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(done);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none">
      <div
        className="h-full bg-primary-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(37,99,235,0.6)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
