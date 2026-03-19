import { useEffect } from 'react';

/**
 * 미저장 변경사항이 있을 때 브라우저 이탈(새로고침·탭 닫기) 경고를 표시합니다.
 * Next.js App Router의 클라이언트 측 라우터 이동은 별도 처리가 필요하므로,
 * 여기서는 브라우저 레벨 이탈(beforeunload)만 처리합니다.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
