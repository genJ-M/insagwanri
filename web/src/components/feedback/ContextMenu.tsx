'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Link2 } from 'lucide-react';
import FeedbackPanel from './FeedbackPanel';

interface MenuPos { x: number; y: number }

export default function ContextMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos>({ x: 0, y: 0 });
  const [targetInfo, setTargetInfo] = useState<Record<string, any> | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 우클릭 인터셉트 (데스크탑만 — pointer:fine)
  useEffect(() => {
    // 터치 전용 기기에서는 우클릭 메뉴 비활성화
    const isPointerFine = window.matchMedia('(pointer: fine)').matches;
    if (!isPointerFine) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // 뷰포트 경계 보정
      const MENU_W = 220;
      const MENU_H = 90;
      const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8);
      const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8);

      setMenuPos({ x, y });
      setMenuOpen(true);

      const el = e.target as HTMLElement;
      setTargetInfo({
        url: window.location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        targetElement: `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`,
        timestamp: new Date().toISOString(),
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Esc 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuOpen]);

  const handleReport = useCallback(async () => {
    setMenuOpen(false);
    // 먼저 스크린샷 캡처 후 패널 오픈
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        scale: 0.6,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.id === 'feedback-panel-root' || el.id === 'context-menu-root',
      });
      setScreenshot(canvas.toDataURL('image/jpeg', 0.7));
    } catch {
      setScreenshot(null);
    }
    setPanelOpen(true);
  }, []);

  const handleCopyLink = useCallback(() => {
    setMenuOpen(false);
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }, []);

  return (
    <>
      {/* 커스텀 컨텍스트 메뉴 */}
      {menuOpen && (
        <div
          id="context-menu-root"
          ref={menuRef}
          style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
          className="w-[220px] bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden py-1 animate-fade-in"
        >
          <button
            onClick={handleReport}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 hover:bg-red-50 text-left transition-colors group"
          >
            <div className="w-6 h-6 rounded-md bg-red-50 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0">
              <Camera className="h-3.5 w-3.5 text-red-500" />
            </div>
            <span className="text-sm text-text-primary">이 화면 문제 신고하기</span>
          </button>
          <div className="h-px bg-zinc-100 mx-2" />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 hover:bg-zinc-50 text-left transition-colors group"
          >
            <div className="w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <Link2 className="h-3.5 w-3.5 text-text-muted" />
            </div>
            <span className="text-sm text-text-primary">현재 페이지 링크 복사</span>
          </button>
        </div>
      )}

      {/* 피드백 패널 */}
      <FeedbackPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setScreenshot(null); }}
        initialType="bug"
        initialScreenshot={screenshot}
        initialContext={targetInfo}
      />
    </>
  );
}
