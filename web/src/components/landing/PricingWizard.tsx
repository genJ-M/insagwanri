'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPES,
  PLANS,
  ADDONS,
  SEAT_TIERS,
  EXTRA_LOCATION_PRICE,
  MODULE_LABELS,
  FEATURE_MODULE_LABELS,
  TYPE_ADDON_PRICE,
  type PlanKey,
  type ComboResult,
  type SeatBreakdown,
  derivePlan,
  deriveComboPrice,
  calcSeatsBreakdown,
  fmt,
  buildQuoteUrl,
} from '@/lib/landing-pricing';
import { saveLandingIntent, intentToQueryString } from '@/lib/landing-intent';

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

// ─── PDF 캡처용 오프스크린 미러 ────────────────────────────────────────────

interface PrintMirrorProps {
  printRef: React.RefObject<HTMLDivElement>;
  typeLabels: string;
  planKey: PlanKey | 'enterprise';
  planLabel: string;
  employees: number;
  comboResult: ComboResult;
  selectedAddons: (typeof ADDONS)[0][];
  extraLocations: number;
  locationTotal: number;
  monthlyTotal: number;
  perEmployee: number;
  yearlyTotal: number;
  docMeta: ReturnType<typeof getDocMeta>;
  isCombo: boolean;
}

function PrintMirror({
  printRef, typeLabels, planKey, planLabel,
  employees, comboResult, selectedAddons,
  extraLocations, locationTotal,
  monthlyTotal, perEmployee, yearlyTotal, docMeta, isCombo,
}: PrintMirrorProps) {
  const planColor =
    planKey === 'enterprise' ? '#FCD34D'
    : planKey === 'free'     ? '#D4D4D8'
    : planKey === 'basic'    ? '#60A5FA'
    : '#C4B5FD';

  return (
    <div
      ref={printRef}
      aria-hidden="true"
      style={{
        position: 'fixed', left: '-9999px', top: 0,
        width: '440px', backgroundColor: '#18181B',
        fontFamily: 'Inter, "Noto Sans KR", sans-serif', lineHeight: 1.5,
      }}
    >
      {/* 헤더 */}
      <div style={{
        background: '#111113', padding: '20px 28px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
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

      {/* 본문 */}
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <p style={{ color: '#71717A', fontSize: '11px', margin: '0 0 4px', fontWeight: 500 }}>
            {typeLabels} · 직원 {employees >= 100 ? '100명+' : `${employees}명`}
          </p>
          <p style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: planColor }}>
            {planLabel}
          </p>
        </div>

        {planKey === 'enterprise' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '36px', margin: '0 0 8px' }}>🏢</p>
            <p style={{ color: '#F4F4F6', fontWeight: 700, fontSize: '15px', margin: '0 0 4px' }}>100명 이상 규모</p>
            <p style={{ color: '#71717A', fontSize: '12px', margin: 0 }}>
              전용 온보딩 · 커스텀 계약 · 온프레미스 구성 지원<br />contact@gwanliwang.com
            </p>
          </div>
        ) : (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {/* 기본료 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ color: '#A1A1AA', fontSize: '13px' }}>{planLabel} 기본료</span>
                <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600 }}>
                  {comboResult.baseFee === 0 ? '무료' : fmt(comboResult.baseFee)}
                </span>
              </div>
              {/* 인원 추가 */}
              {comboResult.seatFee > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ color: '#A1A1AA', fontSize: '13px' }}>직원 {employees - 1}명 추가</span>
                  <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600 }}>
                    +{fmt(comboResult.seatFee)}
                  </span>
                </div>
              )}
              {/* 복합 업종 추가 */}
              {comboResult.comboAddOns.map((a) => (
                <div key={a.type.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ color: '#A1A1AA', fontSize: '13px' }}>
                    {a.type.icon} {a.type.label} 추가 ({Math.round(a.discountPct * 100)}% 할인)
                  </span>
                  <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600 }}>
                    +{fmt(a.finalPrice)}
                  </span>
                </div>
              ))}
              {/* 애드온 */}
              {selectedAddons.map((addon) => (
                <div key={addon.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ color: '#A1A1AA', fontSize: '13px' }}>{addon.emoji} {addon.name}</span>
                  <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600 }}>+{fmt(addon.price)}</span>
                </div>
              ))}
              {/* 추가 지점 */}
              {extraLocations > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ color: '#A1A1AA', fontSize: '13px' }}>🏢 추가 지점 {extraLocations}개</span>
                  <span style={{ color: '#F4F4F6', fontSize: '14px', fontWeight: 600 }}>+{fmt(locationTotal)}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '2px solid rgba(255,255,255,0.15)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ color: '#71717A', fontSize: '10px', margin: '0 0 4px' }}>월 합계 (VAT 별도)</p>
                  <p style={{ color: '#F4F4F6', fontSize: '36px', fontWeight: 900, margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                  </p>
                </div>
                {monthlyTotal > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#52525B', fontSize: '10px', margin: '0 0 3px' }}>인당 월 비용</p>
                    <p style={{ color: '#D4D4D8', fontSize: '18px', fontWeight: 700, margin: 0 }}>{fmt(perEmployee)}</p>
                    <p style={{ color: '#52525B', fontSize: '10px', margin: '2px 0 0' }}>{employees}명 기준</p>
                  </div>
                )}
              </div>
              {monthlyTotal > 0 && (
                <div style={{
                  marginTop: '12px', padding: '8px 12px', borderRadius: '10px',
                  background: 'rgba(5,46,22,0.8)', border: '1px solid rgba(22,101,52,0.5)',
                }}>
                  <p style={{ color: '#34D399', fontSize: '11px', fontWeight: 600, margin: 0 }}>
                    연간 결제 시 17% 할인 — {fmt(yearlyTotal)}/년
                  </p>
                  {isCombo && comboResult.savings > 0 && (
                    <p style={{ color: '#6EE7B7', fontSize: '10px', margin: '4px 0 0' }}>
                      복합 업종 묶음 할인으로 {fmt(comboResult.savings)} 절약 중
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ color: '#3F3F46', fontSize: '9px', margin: 0 }}>14일 무료 체험 · 신용카드 불필요 · 언제든 취소</p>
          <p style={{ color: '#3F3F46', fontSize: '9px', margin: 0 }}>insagwanri-nine.vercel.app</p>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────

export default function PricingWizard() {
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set(['food']));
  const [employees, setEmployees] = useState(10);
  const [isEditingEmployees, setIsEditingEmployees] = useState(false);
  const [employeeInput, setEmployeeInput] = useState('');
  const [extraLocations, setExtraLocations] = useState(0);
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const printRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  // 선택된 업종 배열
  const selectedTypes = useMemo(
    () => BUSINESS_TYPES.filter(t => selectedTypeIds.has(t.id)),
    [selectedTypeIds],
  );
  const isCombo = selectedTypes.length > 1;

  // 단일 or 복합 가격 계산
  const comboResult = useMemo(
    () => deriveComboPrice(selectedTypes, employees),
    [selectedTypes, employees],
  );

  const selectedAddons = ADDONS.filter(a => addons.has(a.id));
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const locationTotal = extraLocations * EXTRA_LOCATION_PRICE;
  const monthlyTotal = comboResult.totalMonthly + addonTotal + locationTotal;
  const perEmployee = employees > 0 && monthlyTotal > 0 ? Math.ceil(monthlyTotal / employees) : 0;
  const yearlyTotal = Math.floor(monthlyTotal * 0.83 * 12);

  const seatBreakdown = useMemo<SeatBreakdown[]>(() => {
    const pk = comboResult.planKey;
    if (pk === 'enterprise' || pk === 'free') return [];
    return calcSeatsBreakdown(pk as 'basic' | 'pro', employees);
  }, [comboResult.planKey, employees]);

  const { planKey } = comboResult;
  const plan = planKey !== 'enterprise' ? PLANS[planKey as PlanKey] : null;

  // 단일 업종일 때는 해당 type 기준 display, 복합이면 "복합 업종"
  const primaryType = selectedTypes[0] ?? BUSINESS_TYPES[0];

  const typeLabels = isCombo
    ? selectedTypes.map(t => `${t.icon} ${t.label}`).join(' + ')
    : `${primaryType.icon} ${primaryType.label}`;

  const planLabel = isCombo
    ? `복합 업종 · ${planKey === 'enterprise' ? 'Enterprise' : plan?.label} 플랜`
    : `${planKey === 'enterprise' ? 'Enterprise' : plan?.label} 플랜`;

  const quoteUrl = buildQuoteUrl({
    planKey, employees,
    addons: [...addons],
    typeIds: [...selectedTypeIds],
  });
  const displayAddons = ADDONS.filter(a => addons.has(a.id) || exitingIds.has(a.id));

  const planColorClass =
    planKey === 'enterprise' ? 'text-amber-400'
    : planKey === 'free'     ? 'text-zinc-300'
    : planKey === 'basic'    ? 'text-blue-400'
    : 'text-primary-300';

  const docMeta = getDocMeta();

  // ── 직원 수 직접 입력 ─────────────────────────────────────────
  function startEditingEmployees() {
    setEmployeeInput(String(employees));
    setIsEditingEmployees(true);
  }

  function commitEmployeeInput() {
    const v = parseInt(employeeInput, 10);
    if (!isNaN(v) && v >= 1) {
      setEmployees(Math.min(v, 100));
    }
    setIsEditingEmployees(false);
  }

  function handleEmployeeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEmployeeInput();
    if (e.key === 'Escape') setIsEditingEmployees(false);
  }

  // ── 업종 토글 ─────────────────────────────────────────────────
  function toggleType(id: string) {
    setSelectedTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // 최소 1개 유지
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── 애드온 토글 (애니메이션 포함) ────────────────────────────
  function toggleAddon(id: string) {
    if (addons.has(id)) {
      setAddons(prev => { const n = new Set(prev); n.delete(id); return n; });
      setExitingIds(prev => new Set([...prev, id]));
      setTimeout(() => {
        setExitingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }, 220);
    } else {
      setAddons(prev => new Set([...prev, id]));
    }
  }

  // ── PDF 생성 ──────────────────────────────────────────────────
  async function generatePDF() {
    if (!printRef.current || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(printRef.current, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#18181B', removeContainer: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidthMm = 210;
      const pdfHeightMm = (canvas.height / canvas.width) * pdfWidthMm;
      const pdf = new jsPDF({
        orientation: 'portrait', unit: 'mm',
        format: [pdfWidthMm, pdfHeightMm], compress: true,
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
      const { no } = getDocMeta();
      pdf.save(`관리왕-견적서-${no}.pdf`);
    } catch {
      window.open(quoteUrl, '_blank');
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  return (
    <>
      {/* ── PDF 캡처용 오프스크린 미러 ── */}
      <PrintMirror
        printRef={printRef}
        typeLabels={typeLabels}
        planKey={planKey}
        planLabel={planLabel}
        employees={employees}
        comboResult={comboResult}
        selectedAddons={selectedAddons}
        extraLocations={extraLocations}
        locationTotal={locationTotal}
        monthlyTotal={monthlyTotal}
        perEmployee={perEmployee}
        yearlyTotal={yearlyTotal}
        docMeta={docMeta}
        isCombo={isCombo}
      />

      {/* ── Split-Screen 레이아웃 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden border border-border shadow-card">

        {/* ═══════════════════════════════════════════════════
            왼쪽 패널 — 빌더 컨트롤
        ════════════════════════════════════════════════════ */}
        <div className="bg-white p-8 lg:p-10 space-y-10 border-b lg:border-b-0 lg:border-r border-border">

          {/* 01 업종 (복수 선택) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">
                01 — 업종 선택
              </p>
              <span className="text-[10px] text-text-muted bg-zinc-100 rounded-full px-2 py-0.5">
                복수 선택 가능
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((t) => {
                const active = selectedTypeIds.has(t.id);
                // 이미 선택된 업종과의 기능 중복 수 계산 (이 업종 제외)
                const othersModules = new Set(
                  selectedTypes
                    .filter(s => s.id !== t.id)
                    .flatMap(s => s.featureModules),
                );
                const overlapCount = t.featureModules.filter(f => othersModules.has(f)).length;
                const newCount = t.featureModules.filter(f => !othersModules.has(f)).length;
                const showInfo = !active && selectedTypes.length > 0;

                return (
                  <button
                    key={t.id}
                    onClick={() => toggleType(t.id)}
                    className={`relative flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left
                      transition-all duration-150
                      ${active
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-border bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
                  >
                    {/* 선택 체크 */}
                    <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center
                      transition-all duration-150 ${active ? 'bg-primary-500 opacity-100' : 'opacity-0'}`}>
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    <span className="text-2xl flex-shrink-0">{t.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-snug ${active ? 'text-primary-700' : 'text-text-primary'}`}>
                        {t.label}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">{t.sub}</p>
                      {/* 추가 시 기능 변화 힌트 */}
                      {showInfo && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {newCount > 0 && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                              +{newCount}개 추가
                            </span>
                          )}
                          {overlapCount > 0 && (
                            <span className="text-[9px] text-zinc-400 bg-zinc-50 px-1 py-0.5 rounded">
                              {overlapCount}개 공통
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 선택 결과 팁 */}
            <div className="mt-3">
              {isCombo ? (
                <div className="flex items-start gap-2 text-xs bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
                  <span className="text-primary-500 text-sm flex-shrink-0">🔗</span>
                  <div>
                    <span className="font-semibold text-primary-700">
                      복합 업종 {selectedTypes.length}개 선택됨
                    </span>
                    <span className="text-primary-600 ml-1.5">
                      — 중복 기능 제외, 추가 기능만 할인가로 합산됩니다
                    </span>
                  </div>
                </div>
              ) : (
                <p key={primaryType.id} className="text-xs text-primary-600 font-medium animate-fade-in">
                  💡 {primaryType.tip}
                </p>
              )}
            </div>
          </section>

          {/* 02 직원 수 */}
          <section>
            <div className="flex items-end justify-between mb-3">
              <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">
                02 — 직원 수
              </p>
              <div className="flex items-baseline gap-1">
                {isEditingEmployees ? (
                  <input
                    type="number"
                    value={employeeInput}
                    onChange={(e) => setEmployeeInput(e.target.value)}
                    onBlur={commitEmployeeInput}
                    onKeyDown={handleEmployeeKeyDown}
                    autoFocus
                    min={1}
                    max={100}
                    className="w-28 text-5xl font-black text-primary-600 tabular-nums leading-none
                               bg-transparent border-b-2 border-primary-500 outline-none text-right
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                               [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    onClick={startEditingEmployees}
                    title="클릭해서 직접 입력"
                    className="text-5xl font-black text-text-primary tabular-nums leading-none
                               hover:text-primary-600 transition-colors border-b-2 border-dashed
                               border-transparent hover:border-primary-400 cursor-text"
                  >
                    {employees >= 100 ? '100+' : employees}
                  </button>
                )}
                <span className="text-xl font-semibold text-text-muted">명</span>
              </div>
            </div>
            <input
              type="range" min={1} max={100} value={employees}
              onChange={(e) => { setEmployees(Number(e.target.value)); setIsEditingEmployees(false); }}
              className="w-full h-2 rounded-full accent-primary-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-text-muted mt-2">
              <span>1명</span><span>30명</span><span>100명+</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary bg-zinc-50
                            rounded-lg px-3 py-2 border border-zinc-100">
              <span>📌</span>
              {employees === 1 &&
                <span>1명 → <strong>Free 플랜</strong> (무료)</span>}
              {employees > 1 && employees <= 30 && planKey === 'basic' &&
                <span>Basic 기본료 {fmt(PLANS.basic.price)} + 추가 {employees - 1}명 × {employees <= 10 ? '₩2,000' : '₩1,500~₩2,000'}</span>}
              {employees > 1 && employees <= 30 && planKey === 'pro' &&
                <span>Pro 기본료 {fmt(PLANS.pro.price)} + 추가 {employees - 1}명 · 선택 업종 요건</span>}
              {employees > 30 && employees < 100 &&
                <span>Pro 기본료 {fmt(PLANS.pro.price)} + 추가 {employees - 1}명 × ₩1,000~₩2,000</span>}
              {employees >= 100 &&
                <span>100명 이상 → <strong>Enterprise</strong> · 별도 문의</span>}
            </div>

            {/* 인당 과금 구조 안내 */}
            {planKey !== 'enterprise' && planKey !== 'free' && (
              <div className="mt-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  {plan?.label} 인당 과금 구조
                </p>
                <div className="space-y-1">
                  {SEAT_TIERS[planKey as 'basic' | 'pro'].map((tier, i, arr) => {
                    const from = i === 0 ? 2 : arr[i - 1].upTo + 1;
                    return (
                      <div key={tier.upTo} className="flex justify-between text-[11px]">
                        <span className="text-text-muted">{from}~{tier.upTo}명</span>
                        <span className="font-medium text-text-secondary">+{fmt(tier.pricePerSeat)}/명</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

              {/* 추가 지점 — 수량 선택 */}
              <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150
                ${extraLocations > 0 ? 'border-primary-400 bg-primary-50' : 'border-border bg-white'}`}>
                <span className="text-xl flex-shrink-0">🏢</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">추가 지점</p>
                  <p className="text-xs text-text-muted">사업장(지점) 추가 관리 · {fmt(EXTRA_LOCATION_PRICE)}/지점/월</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setExtraLocations(l => Math.max(0, l - 1))}
                    className="w-7 h-7 rounded-lg border border-border bg-white text-text-secondary
                               hover:bg-zinc-50 hover:border-zinc-300 transition-colors flex items-center justify-center
                               text-base font-bold disabled:opacity-30"
                    disabled={extraLocations === 0}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-text-primary tabular-nums">
                    {extraLocations}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExtraLocations(l => Math.min(20, l + 1))}
                    className="w-7 h-7 rounded-lg border border-border bg-white text-text-secondary
                               hover:bg-zinc-50 hover:border-zinc-300 transition-colors flex items-center justify-center
                               text-base font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
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
                {isCombo
                  ? selectedTypes.map(t => `${t.icon} ${t.label}`).join(' + ')
                  : `${primaryType.icon} ${primaryType.label}`
                }{' '}
                · 직원 {employees >= 100 ? '100명+' : `${employees}명`}
              </p>
              <p key={`plan-${planKey}-${selectedTypeIds.size}`}
                className={`text-2xl font-black animate-fade-in ${planColorClass}`}>
                {planKey === 'enterprise' ? 'Enterprise' : plan?.label} 플랜
                {isCombo && (
                  <span className="text-sm font-semibold text-zinc-500 ml-2">복합 업종</span>
                )}
              </p>
            </div>
            {planKey !== 'enterprise' && (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10
                               border border-emerald-400/20 px-2 py-1 rounded-full flex-shrink-0">
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
              <a href="mailto:contact@gwanliwang.com"
                className="bg-amber-500 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-amber-400 transition-colors">
                영업팀에 문의하기 →
              </a>
            </div>
          ) : (
            <>
              {/* ── 서비스 구성 명세 ── */}
              <div className="flex flex-col">
                {/* 플랜 기본료 */}
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-zinc-400 text-sm">{plan?.label} 플랜 기본료</span>
                  <span key={`base-${planKey}`}
                    className="text-white text-base font-semibold tabular-nums animate-fade-in">
                    {comboResult.baseFee === 0 ? '무료' : fmt(comboResult.baseFee)}
                  </span>
                </div>

                {/* 인원 추가 과금 */}
                {comboResult.seatFee > 0 && (
                  <div className="py-3 border-b border-white/10 animate-addon-enter">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-zinc-400 text-sm">직원 {employees - 1}명 추가</span>
                        <div className="mt-1 space-y-0.5">
                          {seatBreakdown.map((b, i) => (
                            <p key={i} className="text-zinc-600 text-[11px] tabular-nums">
                              {b.count}명 × {fmt(b.pricePerSeat)}
                            </p>
                          ))}
                        </div>
                      </div>
                      <span className="text-white text-base font-semibold tabular-nums">
                        +{fmt(comboResult.seatFee)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 복합 업종 추가 비용 (할인 적용) */}
                {comboResult.comboAddOns.map((a) => (
                  <div key={a.type.id}
                    className="grid animate-addon-enter">
                    <div className="overflow-hidden min-h-0">
                      <div className="flex items-center justify-between py-3 border-b border-white/10">
                        <div>
                          <span className="text-zinc-400 text-sm">
                            {a.type.icon} {a.type.label} 추가
                          </span>
                          <span className="ml-2 text-[10px] font-bold text-emerald-400 bg-emerald-400/10
                                           border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                            {Math.round(a.discountPct * 100)}% 할인
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500 text-xs line-through mr-1.5">
                            {fmt(a.originalPrice)}
                          </span>
                          <span className="text-white text-base font-semibold tabular-nums">
                            +{fmt(a.finalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 선택된 애드온 */}
                {displayAddons.map((addon) => {
                  const isExiting = exitingIds.has(addon.id);
                  return (
                    <div key={addon.id}
                      className={`grid ${isExiting ? 'animate-addon-exit' : 'animate-addon-enter'}`}>
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

                {/* 추가 지점 */}
                {extraLocations > 0 && (
                  <div className="grid animate-addon-enter">
                    <div className="overflow-hidden min-h-0">
                      <div className="flex items-center justify-between py-3 border-b border-white/10">
                        <span className="text-zinc-400 text-sm flex items-center gap-1.5">
                          🏢 추가 지점 {extraLocations}개
                        </span>
                        <span className="text-white text-base font-semibold tabular-nums">
                          +{fmt(locationTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {comboResult.comboAddOns.length === 0 && displayAddons.length === 0 && extraLocations === 0 && (
                  <p className="text-zinc-600 text-xs py-3 animate-fade-in">
                    ← 업종 추가 또는 기능을 선택하면 표시됩니다
                  </p>
                )}
              </div>

              {/* ── 총액 ── */}
              <div className="border-t border-white/20 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs mb-1.5">월 합계 (VAT 별도)</p>
                    <p key={`total-${monthlyTotal}`}
                      className="text-4xl font-black text-white tabular-nums animate-fade-in leading-none">
                      {monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                    </p>
                  </div>
                  {monthlyTotal > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-zinc-600 text-[11px] mb-1">인당 월 비용</p>
                      <p className="text-2xl font-bold text-zinc-300 tabular-nums leading-none">{fmt(perEmployee)}</p>
                      <p className="text-zinc-600 text-[10px] mt-0.5">{employees}명 기준</p>
                    </div>
                  )}
                </div>

                {/* 연간 할인 + 복합 업종 절약 */}
                {monthlyTotal > 0 && (
                  <div className="mt-3.5 space-y-2">
                    <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-xl px-3.5 py-2.5">
                      <p className="text-emerald-400 text-xs font-semibold">
                        💰 연간 결제 시 17% 할인 —{' '}
                        <span key={`yearly-${yearlyTotal}`} className="tabular-nums animate-fade-in">
                          {fmt(yearlyTotal)}/년
                        </span>
                      </p>
                    </div>

                    {/* 복합 업종 절약 메시지 */}
                    {isCombo && comboResult.savings > 0 && (
                      <div key={`savings-${comboResult.savings}`}
                        className="bg-violet-950/80 border border-violet-700/50 rounded-xl px-3.5 py-2.5 animate-fade-in">
                        <p className="text-violet-300 text-xs font-semibold">
                          🎉 각각 구독 시{' '}
                          <span className="line-through text-zinc-500 font-normal">
                            {fmt(comboResult.standaloneTotal)}
                          </span>
                          {' '}→ 복합 할인가{' '}
                          <span className="text-white">{fmt(comboResult.totalMonthly)}</span>
                        </p>
                        <p className="text-violet-400 text-[11px] mt-1">
                          ✂ {fmt(comboResult.savings)} 절약 ({comboResult.savingsPct}% 저렴)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── 포함 기능 — 단일/복합 분기 ── */}
              {isCombo ? (
                <div className="space-y-3">
                  {/* 공통 기능 */}
                  {comboResult.sharedFeatures.length > 0 && (
                    <div>
                      <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-bold mb-2">
                        공통 포함 기능 {comboResult.sharedFeatures.length}개
                      </p>
                      <div className="space-y-1.5">
                        {comboResult.sharedFeatures.map(f => (
                          <p key={f} className="text-zinc-500 text-xs flex items-center gap-2">
                            <span className="text-zinc-600 flex-shrink-0">✓</span>
                            {FEATURE_MODULE_LABELS[f] ?? f}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 추가 기능 */}
                  {comboResult.addedFeatures.length > 0 && (
                    <div>
                      <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold mb-2">
                        ✨ 추가 포함 기능 {comboResult.addedFeatures.length}개
                      </p>
                      <div className="space-y-1.5">
                        {comboResult.addedFeatures.map(f => (
                          <p key={f} className="text-zinc-300 text-xs flex items-center gap-2">
                            <span className="text-emerald-500 flex-shrink-0">+</span>
                            {FEATURE_MODULE_LABELS[f] ?? f}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-bold mb-2.5">
                    {primaryType.label} 기본 포함 기능
                  </p>
                  <div className="space-y-2">
                    {primaryType.included.slice(0, 4).map(feat => (
                      <p key={feat} className="text-zinc-400 text-xs flex items-center gap-2">
                        <span className="text-emerald-500 flex-shrink-0">✓</span>{feat}
                      </p>
                    ))}
                    {primaryType.included.length > 4 && (
                      <p className="text-zinc-600 text-xs pl-4">+ {primaryType.included.length - 4}개 기능 더 포함</p>
                    )}
                  </div>
                </div>
              )}

              {/* 포함 모듈 */}
              {plan && plan.moduleIds.length > 0 && (
                <div>
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-bold mb-2.5">
                    포함 모듈 {plan.moduleIds.length}개
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.moduleIds.map(id => (
                      <span key={id}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/10">
                        {MODULE_LABELS[id] ?? id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const intent = {
                      planKey,
                      employees,
                      billingCycle: 'monthly' as const,
                      typeIds: [...selectedTypeIds],
                      addonIds: [...addons],
                      extraLocations,
                    };
                    saveLandingIntent(intent);
                    const qs = intentToQueryString(intent);
                    window.location.href = `/register?${qs}`;
                  }}
                  className="flex items-center justify-center w-full py-3.5 rounded-xl
                             bg-white text-zinc-900 text-base font-black hover:bg-zinc-100 transition-colors"
                >
                  {monthlyTotal === 0 ? '무료로 시작하기' : '14일 무료 체험 시작'} →
                </button>

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
