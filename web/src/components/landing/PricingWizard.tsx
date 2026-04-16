'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPES,
  PLANS,
  ADDONS,
  type PlanKey,
  derivePlan,
  fmt,
  buildQuoteUrl,
} from '@/lib/landing-pricing';

// ─── 커스텀 체크박스 ──────────────────────────────────────────────────────

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
        transition-all duration-150
        ${checked ? 'bg-primary-600 border-primary-600' : 'border-zinc-300'}`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

// ─── PDF 문서 날짜 유틸 ────────────────────────────────────────────────────

function getDocMeta() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  const validDate = new Date(now);
  validDate.setDate(validDate.getDate() + 30);
  const validStr = `${validDate.getFullYear()}.${pad(validDate.getMonth() + 1)}.${pad(validDate.getDate())}`;
  const no = `GW-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.floor(Math.random() * 9000 + 1000)}`;
  return { dateStr, validStr, no };
}

// ─── 숨겨진 PDF 캡처 전용 레이아웃 ──────────────────────────────────────
// · 오른쪽 패널(다크 테마)과 동일한 비주얼, CTA 제거, 문서 헤더 추가
// · position fixed / left -9999px 로 화면 밖에 상주 (display:none 사용 불가 — html2canvas 제약)

interface PrintMirrorProps {
  printRef: React.RefObject<HTMLDivElement>;
  type: (typeof BUSINESS_TYPES)[0];
  planKey: ReturnType<typeof derivePlan>;
  plan: (typeof PLANS)[PlanKey] | null;
  employees: number;
  selectedAddons: (typeof ADDONS)[0][];
  monthlyTotal: number;
  perEmployee: number;
  yearlyTotal: number;
  docMeta: ReturnType<typeof getDocMeta>;
}

function PrintMirror({
  printRef, type, planKey, plan,
  employees, selectedAddons, monthlyTotal, perEmployee, yearlyTotal, docMeta,
}: PrintMirrorProps) {
  return (
    <div
      ref={printRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '440px',
        backgroundColor: '#18181B',
        fontFamily: 'Inter, "Noto Sans KR", sans-serif',
        lineHeight: 1.5,
      }}
    >
      {/* ── 문서 헤더 ────────────────────────────────── */}
      <div style={{
        background: '#111113',
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div>
          <p style={{ color: '#A78BFA', fontWeight: 900, fontSize: '20px', margin: 0 }}>관리왕</p>
          <p style={{ color: '#71717A', fontSize: '11px', margin: '2px 0 0' }}>서비스 제안서</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#52525B', fontSize: '10px', margin: 0 }}>{docMeta.no}</p>
          <p style={{ color: '#52525B', fontSize: '10px', margin: '2px 0 0' }}>발행일 {docMeta.dateStr}</p>
          <p style={{ color: '#52525B', fontSize: '10px', margin: '2px 0 0' }}>유효기간 {docMeta.validStr}</p>
        </div>
      </div>

      {/* ── 본문 (오른쪽 패널과 동일한 레이아웃) ─────── */}
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 업종 + 플랜명 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#71717A', fontSize: '11px', margin: '0 0 4px', fontWeight: 500 }}>
              {type.icon} {type.label} · 직원 {employees >= 100 ? '100명+' : `${employees}명`}
            </p>
            <p style={{
              fontSize: '22px', fontWeight: 900, margin: 0,
              color: planKey === 'enterprise' ? '#FCD34D'
                : planKey === 'free' ? '#D4D4D8'
                : planKey === 'basic' ? '#60A5FA'
                : '#C4B5FD',
            }}>
              {planKey === 'enterprise' ? 'Enterprise' : plan?.label} 플랜
            </p>
          </div>
          {planKey !== 'enterprise' && (
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#34D399',
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
              padding: '3px 8px', borderRadius: '20px',
            }}>
              ✓ 추천
            </span>
          )}
        </div>

        {planKey === 'enterprise' ? (
          /* Enterprise 분기 */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '36px', margin: '0 0 8px' }}>🏢</p>
            <p style={{ color: '#F4F4F6', fontWeight: 700, fontSize: '15px', margin: '0 0 4px' }}>100명 이상 규모</p>
            <p style={{ color: '#71717A', fontSize: '12px', margin: 0 }}>
              전용 온보딩 · 커스텀 계약 · 온프레미스 구성 지원<br />
              contact@gwanliwang.com
            </p>
          </div>
        ) : (
          <>
            {/* 서비스 명세 */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {/* 기본 플랜 행 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ color: '#A1A1AA', fontSize: '13px' }}>{plan?.label} 플랜 기본 요금</span>
                <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {plan?.price === 0 ? '무료' : fmt(plan?.price ?? 0)}
                </span>
              </div>
              {/* 선택된 애드온 행 */}
              {selectedAddons.map((addon) => (
                <div key={addon.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ color: '#A1A1AA', fontSize: '13px' }}>
                    {addon.emoji} {addon.name}
                  </span>
                  <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    +{fmt(addon.price)}
                  </span>
                </div>
              ))}
            </div>

            {/* 총액 */}
            <div style={{ borderTop: '2px solid rgba(255,255,255,0.15)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ color: '#71717A', fontSize: '10px', margin: '0 0 4px' }}>월 합계 (VAT 별도)</p>
                  <p style={{
                    color: '#F4F4F6', fontSize: '36px', fontWeight: 900, margin: 0,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  }}>
                    {monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                  </p>
                </div>
                {monthlyTotal > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#52525B', fontSize: '10px', margin: '0 0 3px' }}>인당 월 비용</p>
                    <p style={{ color: '#D4D4D8', fontSize: '18px', fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(perEmployee)}
                    </p>
                    <p style={{ color: '#52525B', fontSize: '10px', margin: '2px 0 0' }}>{employees}명 기준</p>
                  </div>
                )}
              </div>

              {monthlyTotal > 0 && (
                <div style={{
                  marginTop: '12px', padding: '8px 12px', borderRadius: '10px',
                  background: 'rgba(5,46,22,0.8)', border: '1px solid rgba(22,101,52,0.5)',
                }}>
                  <p style={{ color: '#34D399', fontSize: '11px', fontWeight: 600, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    연간 결제 시 17% 할인 — {fmt(yearlyTotal)}/년
                  </p>
                </div>
              )}
            </div>

            {/* 포함 기능 */}
            <div>
              <p style={{ color: '#52525B', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: '0 0 8px' }}>
                {type.label} 기본 포함 기능
              </p>
              {type.included.map((feat) => (
                <p key={feat} style={{ color: '#71717A', fontSize: '11px', margin: '0 0 5px', display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#34D399' }}>✓</span>{feat}
                </p>
              ))}
            </div>
          </>
        )}

        {/* 문서 하단 */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <p style={{ color: '#3F3F46', fontSize: '9px', margin: 0 }}>
            14일 무료 체험 · 신용카드 불필요 · 언제든 취소
          </p>
          <p style={{ color: '#3F3F46', fontSize: '9px', margin: 0 }}>insagwanri-nine.vercel.app</p>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────

export default function PricingWizard() {
  const [typeId, setTypeId] = useState<string>(BUSINESS_TYPES[0].id);
  const [employees, setEmployees] = useState(10);
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // PDF 캡처 대상 ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const printRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  const type = BUSINESS_TYPES.find((t) => t.id === typeId)!;
  const planKey = derivePlan(type, employees);
  const plan = planKey !== 'enterprise' ? PLANS[planKey as PlanKey] : null;

  const selectedAddons = ADDONS.filter((a) => addons.has(a.id));
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const monthlyTotal = (plan?.price ?? 0) + addonTotal;
  const perEmployee = employees > 0 && monthlyTotal > 0 ? Math.ceil(monthlyTotal / employees) : 0;
  const yearlyTotal = Math.floor(monthlyTotal * 0.83 * 12);

  const quoteUrl = buildQuoteUrl({ planKey, employees, addons: [...addons], typeId });
  const displayAddons = ADDONS.filter((a) => addons.has(a.id) || exitingIds.has(a.id));

  // ─── 토글 (애니메이션 포함) ────────────────────────────────────────────

  function toggleAddon(id: string) {
    if (addons.has(id)) {
      setAddons((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setExitingIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setExitingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }, 220);
    } else {
      setAddons((prev) => new Set([...prev, id]));
    }
  }

  // ─── PDF 생성 엔진 ────────────────────────────────────────────────────
  // 1. printRef (오프스크린 PrintMirror div) 을 html2canvas로 캡처
  // 2. jsPDF로 PDF 생성 후 즉시 다운로드
  // 3. 라이브러리는 dynamic import (초기 번들 미포함)

  async function generatePDF() {
    if (!printRef.current || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      // 폰트 로드 대기 (한글 폰트가 캡처 전에 완전히 로드되도록)
      await document.fonts.ready;

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(printRef.current, {
        scale: 2,                        // 레티나 품질
        useCORS: true,
        logging: false,
        backgroundColor: '#18181B',      // zinc-900 명시적 지정
        removeContainer: true,
      });

      const imgData = canvas.toDataURL('image/png');

      // PDF 크기 = 캡처된 실제 픽셀 비율 그대로 (A4 너비 기준 스케일)
      const pdfWidthMm = 210; // A4 너비
      const pdfHeightMm = (canvas.height / canvas.width) * pdfWidthMm;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidthMm, pdfHeightMm],
        compress: true,
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);

      const { no } = getDocMeta();
      pdf.save(`관리왕-견적서-${no}.pdf`);
    } catch (err) {
      console.error('[PricingWizard] PDF 생성 실패:', err);
      // 실패 시 폴백: 기존 견적서 페이지로 이동
      window.open(quoteUrl, '_blank');
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const planColorClass =
    planKey === 'enterprise' ? 'text-amber-400'
    : planKey === 'free'     ? 'text-zinc-300'
    : planKey === 'basic'    ? 'text-blue-400'
    : 'text-primary-300';

  // PDF 문서 메타 (PrintMirror에 전달)
  const docMeta = getDocMeta();

  return (
    <>
      {/* ── PDF 캡처용 오프스크린 미러 (항상 DOM에 존재) ── */}
      <PrintMirror
        printRef={printRef}
        type={type}
        planKey={planKey}
        plan={plan}
        employees={employees}
        selectedAddons={selectedAddons}
        monthlyTotal={monthlyTotal}
        perEmployee={perEmployee}
        yearlyTotal={yearlyTotal}
        docMeta={docMeta}
      />

      {/* ── 메인 Split-Screen 레이아웃 ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden border border-border shadow-card">

        {/* ═══════════════════════════════════════════════════
            왼쪽 패널 — 빌더 컨트롤
        ════════════════════════════════════════════════════ */}
        <div className="bg-white p-8 lg:p-10 space-y-10 border-b lg:border-b-0 lg:border-r border-border">

          {/* 01 업종 */}
          <section>
            <p className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-4">
              01 — 업종 선택
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((t) => {
                const active = typeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTypeId(t.id)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left
                      transition-all duration-150
                      ${active
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-border bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
                  >
                    <span className="text-2xl flex-shrink-0">{t.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-snug ${active ? 'text-primary-700' : 'text-text-primary'}`}>
                        {t.label}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">{t.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p
              key={typeId}
              className="mt-3 text-xs text-primary-600 font-medium animate-fade-in"
            >
              💡 {type.tip}
            </p>
          </section>

          {/* 02 직원 수 */}
          <section>
            <div className="flex items-end justify-between mb-3">
              <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">
                02 — 직원 수
              </p>
              <span className="text-5xl font-black text-text-primary tabular-nums leading-none">
                {employees >= 100 ? '100+' : employees}
                <span className="text-xl font-semibold text-text-muted ml-1">명</span>
              </span>
            </div>
            <input
              type="range" min={1} max={100} value={employees}
              onChange={(e) => setEmployees(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-primary-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-text-muted mt-2">
              <span>1명</span><span>30명</span><span>100명+</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary bg-zinc-50
                            rounded-lg px-3 py-2 border border-zinc-100">
              <span>📌</span>
              {employees <= 5 && type.minPlan !== 'pro' && <span>5명 이하 → <strong>Free 플랜</strong> 이용 가능</span>}
              {employees > 5 && employees <= 30 && <span>최대 30명 → <strong>Basic 플랜</strong> 권장</span>}
              {employees > 30 && employees < 100 && <span>31~99명 → <strong>Pro 플랜</strong> 권장</span>}
              {employees >= 100 && <span>100명 이상 → <strong>Enterprise</strong> · 별도 문의</span>}
              {type.minPlan === 'pro' && employees <= 5 && <span><strong>Pro 플랜</strong> 필수 업종입니다</span>}
            </div>
          </section>

          {/* 03 추가 기능 */}
          <section>
            <p className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-4">
              03 — 추가 기능{' '}
              <span className="normal-case font-normal text-text-muted">(선택)</span>
            </p>
            <div className="space-y-2">
              {ADDONS.map((addon) => {
                const checked = addons.has(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer
                      transition-all duration-150
                      ${checked ? 'border-primary-400 bg-primary-50' : 'border-border bg-white hover:border-zinc-300'}`}
                  >
                    <Checkbox checked={checked} />
                    <input type="checkbox" checked={checked} onChange={() => toggleAddon(addon.id)} className="sr-only" />
                    <span className="text-xl flex-shrink-0">{addon.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">{addon.name}</span>
                        {addon.popular && (
                          <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">인기</span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{addon.desc}</p>
                    </div>
                    <span className="text-xs font-bold text-text-secondary whitespace-nowrap flex-shrink-0">
                      +{fmt(addon.price)}/월
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* ═══════════════════════════════════════════════════
            오른쪽 패널 — 실시간 견적 프리뷰
        ════════════════════════════════════════════════════ */}
        <div className="bg-zinc-900 p-8 lg:p-10 flex flex-col gap-6 lg:sticky lg:top-14 lg:self-start">

          {/* 헤더: 업종 + 플랜명 */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-zinc-500 text-xs font-medium mb-1.5">
                {type.icon} {type.label} · 직원 {employees >= 100 ? '100명+' : `${employees}명`}
              </p>
              <p
                key={`plan-${planKey}`}
                className={`text-2xl font-black animate-fade-in ${planColorClass}`}
              >
                {planKey === 'enterprise' ? 'Enterprise' : plan?.label} 플랜
              </p>
            </div>
            {planKey !== 'enterprise' && (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10
                               border border-emerald-400/20 px-2 py-1 rounded-full">
                ✓ 추천
              </span>
            )}
          </div>

          {/* Enterprise 분기 */}
          {planKey === 'enterprise' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-4">
              <span className="text-5xl">🏢</span>
              <div>
                <p className="text-white font-bold text-lg mb-1">100명 이상 규모</p>
                <p className="text-zinc-400 text-sm leading-relaxed">전용 온보딩 · 커스텀 계약<br />온프레미스 구성 지원</p>
              </div>
              <a
                href="mailto:contact@gwanliwang.com"
                className="bg-amber-500 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors"
              >
                영업팀에 문의하기 →
              </a>
            </div>
          ) : (
            <>
              {/* 서비스 구성 명세 */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-zinc-400 text-sm">{plan?.label} 플랜 기본 요금</span>
                  <span
                    key={`base-${planKey}`}
                    className="text-white text-base font-semibold tabular-nums animate-fade-in"
                  >
                    {plan?.price === 0 ? '무료' : fmt(plan?.price ?? 0)}
                  </span>
                </div>

                {/*
                  ── 애니메이션: grid-template-rows 트랜지션 ─────────────────
                  진입: animate-addon-enter (0fr→1fr + opacity + translateY)
                  퇴장: animate-addon-exit  (1fr→0fr + opacity)
                  내부 div overflow:hidden + min-h-0 이 수축 시 clipping을 담당
                  ────────────────────────────────────────────────────────── */}
                {displayAddons.map((addon) => {
                  const isExiting = exitingIds.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      className={`grid ${isExiting ? 'animate-addon-exit' : 'animate-addon-enter'}`}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                          <span className="text-zinc-400 text-sm flex items-center gap-1.5">
                            {addon.emoji} {addon.name}
                          </span>
                          <span className="text-white text-base font-semibold tabular-nums">
                            +{fmt(addon.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {displayAddons.length === 0 && (
                  <p className="text-zinc-600 text-xs py-3 animate-fade-in">
                    ← 추가 기능을 선택하면 여기에 표시됩니다
                  </p>
                )}
              </div>

              {/* 총액 */}
              <div className="border-t border-white/20 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs mb-1.5">월 합계 (VAT 별도)</p>
                    <p
                      key={`total-${monthlyTotal}`}
                      className="text-4xl font-black text-white tabular-nums animate-fade-in leading-none"
                    >
                      {monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                    </p>
                  </div>
                  {monthlyTotal > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-zinc-600 text-[11px] mb-1">인당 월 비용</p>
                      <p className="text-2xl font-bold text-zinc-300 tabular-nums leading-none">
                        {fmt(perEmployee)}
                      </p>
                      <p className="text-zinc-600 text-[10px] mt-0.5">{employees}명 기준</p>
                    </div>
                  )}
                </div>
                {monthlyTotal > 0 && (
                  <div className="mt-3.5 bg-emerald-950/80 border border-emerald-800/60 rounded-xl px-3.5 py-2.5">
                    <p className="text-emerald-400 text-xs font-semibold">
                      💰 연간 결제 시 17% 할인 —{' '}
                      <span key={`yearly-${yearlyTotal}`} className="tabular-nums animate-fade-in">
                        {fmt(yearlyTotal)}/년
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* 포함 기능 미리보기 */}
              <div>
                <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-bold mb-2.5">
                  {type.label} 기본 포함 기능
                </p>
                <div className="space-y-2">
                  {type.included.slice(0, 4).map((feat) => (
                    <p key={feat} className="text-zinc-400 text-xs flex items-center gap-2">
                      <span className="text-emerald-500 flex-shrink-0">✓</span>{feat}
                    </p>
                  ))}
                  {type.included.length > 4 && (
                    <p className="text-zinc-600 text-xs pl-4">+ {type.included.length - 4}개 기능 더 포함</p>
                  )}
                </div>
              </div>

              {/* CTA 버튼 */}
              <div className="space-y-2.5 pt-1">
                <Link
                  href="/auth/register"
                  className="flex items-center justify-center w-full py-3.5 rounded-xl
                             bg-white text-zinc-900 text-base font-black hover:bg-zinc-100 transition-colors"
                >
                  {monthlyTotal === 0 ? '무료로 시작하기' : '14일 무료 체험 시작'} →
                </Link>

                {/* PDF 생성 버튼 */}
                <button
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                             border border-white/15 text-zinc-300 text-sm font-semibold
                             hover:bg-white/5 hover:border-white/25 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <>
                      {/* 로딩 스피너 */}
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      PDF 생성 중…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      이 견적 PDF로 저장
                    </>
                  )}
                </button>

                <p className="text-zinc-600 text-[11px] text-center pt-1">
                  신용카드 등록 없이 시작 · 언제든 취소 가능
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
