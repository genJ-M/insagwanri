'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Bug, Lightbulb, PhoneCall, Loader2, CheckCircle, Camera } from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export type FeedbackType = 'bug' | 'suggestion' | 'contact';

interface FeedbackPanelProps {
  open: boolean;
  onClose: () => void;
  /** 우클릭 신고 시 미리 캡처된 스크린샷 dataURL */
  initialScreenshot?: string | null;
  /** 우클릭 신고 시 미리 선택된 유형 */
  initialType?: FeedbackType;
  /** 우클릭 시 캡처된 컨텍스트 */
  initialContext?: Record<string, any> | null;
}

const TYPE_OPTIONS: { type: FeedbackType; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }[] = [
  { type: 'bug',        icon: Bug,       label: '버그·오류 신고',  desc: '작동하지 않는 기능, 오류 메시지 등' },
  { type: 'suggestion', icon: Lightbulb, label: '기능 제안',       desc: '추가되면 좋을 기능 아이디어' },
  { type: 'contact',   icon: PhoneCall,  label: '직접 문의',       desc: '이메일로 담당자가 답변드립니다' },
];

export default function FeedbackPanel({
  open,
  onClose,
  initialScreenshot = null,
  initialType,
  initialContext = null,
}: FeedbackPanelProps) {
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<'type' | 'form' | 'done'>('type');
  const [type, setType] = useState<FeedbackType>(initialType ?? 'bug');
  const [content, setContent] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(initialScreenshot);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 패널이 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setStep(initialType ? 'form' : 'type');
      setType(initialType ?? 'bug');
      setContent('');
      setScreenshot(initialScreenshot ?? null);
      setSubmitting(false);
    }
  }, [open, initialType, initialScreenshot]);

  // Esc 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const captureScreen = useCallback(async () => {
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        scale: 0.6,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.id === 'feedback-panel-root',
      });
      setScreenshot(canvas.toDataURL('image/jpeg', 0.7));
    } catch {
      // 캡처 실패 시 무시
    } finally {
      setCapturing(false);
    }
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 스크린샷 업로드 (있는 경우)
      let screenshotUrl: string | undefined;
      if (screenshot) {
        const blob = await (await fetch(screenshot)).blob();
        const form = new FormData();
        form.append('file', blob, 'screenshot.jpg');
        const res = await api.post<{ data: { url: string } }>('/files/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        screenshotUrl = res.data?.data?.url;
      }

      const context = initialContext ?? {
        url: window.location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        role: user?.role,
        timestamp: new Date().toISOString(),
      };

      await api.post('/feedback', {
        type,
        content: content.trim() || undefined,
        contextJson: context,
        screenshotUrl,
      });

      setStep('done');
    } catch {
      // 실패 시에도 조용히 처리 — 사용자 불편 최소화
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div id="feedback-panel-root" className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* 배경 딤 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* 패널 */}
      <div className={clsx(
        'relative w-full sm:w-[420px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl',
        'animate-slide-up sm:animate-fade-in',
        'max-h-[90vh] overflow-y-auto',
      )}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-[15px] font-semibold text-text-primary">
            {step === 'done' ? '전송 완료' : '도움이 필요하신가요?'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: 유형 선택 */}
          {step === 'type' && (
            <div className="space-y-2">
              {TYPE_OPTIONS.map(({ type: t, icon: Icon, label, desc }) => (
                <button
                  key={t}
                  onClick={() => { setType(t); setStep('form'); }}
                  className="flex items-start gap-3.5 w-full p-3.5 rounded-xl border border-zinc-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 group-hover:bg-primary-100 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5">
                    <Icon className="h-4 w-4 text-text-secondary group-hover:text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 내용 입력 */}
          {step === 'form' && (
            <div className="space-y-4">
              {/* 유형 배지 */}
              <div className="flex items-center gap-2">
                {TYPE_OPTIONS.filter(o => o.type === type).map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 px-2.5 py-1 rounded-full border border-primary-200">
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
                <button
                  onClick={() => setStep('type')}
                  className="text-xs text-text-muted hover:text-text-secondary underline"
                >
                  변경
                </button>
              </div>

              {/* 내용 입력 */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  {type === 'bug' ? '어떤 문제가 발생했나요?' : type === 'suggestion' ? '어떤 기능을 원하시나요?' : '문의 내용을 입력해 주세요'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={type === 'bug' ? '예) 출퇴근 버튼을 누르면 오류가 나요' : type === 'suggestion' ? '예) 달력에 휴일 표시 기능이 있으면 좋겠어요' : ''}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-zinc-50 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
              </div>

              {/* 스크린샷 영역 (bug 타입만) */}
              {type === 'bug' && (
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    화면 캡처 <span className="text-text-muted font-normal">(선택)</span>
                  </label>
                  {screenshot ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={screenshot} alt="캡처 미리보기" className="w-full object-cover max-h-36" />
                      <button
                        onClick={() => setScreenshot(null)}
                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg text-white hover:bg-black/70"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={captureScreen}
                      disabled={capturing}
                      className="flex items-center gap-2 w-full py-3 px-4 rounded-xl border border-dashed border-zinc-300 hover:border-primary-300 hover:bg-primary-50 text-sm text-text-muted hover:text-primary-600 transition-all"
                    >
                      {capturing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {capturing ? '캡처 중...' : '현재 화면 캡처하기'}
                    </button>
                  )}
                </div>
              )}

              {/* 전송 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={clsx(
                  'flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm transition-all',
                  submitting
                    ? 'bg-zinc-200 text-text-muted cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.99]',
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? '전송 중...' : '전송하기'}
              </button>
            </div>
          )}

          {/* Step 3: 완료 */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <p className="text-[15px] font-semibold text-text-primary">소중한 의견 감사합니다</p>
              <p className="text-sm text-text-muted mt-1.5">
                개발팀이 검토 후 빠르게 반영하겠습니다.
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-6 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-sm font-medium text-text-secondary transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
