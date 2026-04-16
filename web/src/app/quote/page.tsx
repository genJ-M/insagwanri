import type { Metadata } from 'next';
import Link from 'next/link';
import QuotePrintButton from '@/components/landing/QuotePrintButton';
import {
  BUSINESS_TYPES,
  PLANS,
  ADDONS,
  type PlanKey,
  fmt,
} from '@/lib/landing-pricing';

export const metadata: Metadata = {
  title: '관리왕 — 맞춤형 서비스 제안서',
  description: '관리왕 맞춤 플랜 견적서',
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const plan = (searchParams.plan as string) ?? 'basic';
  const employees = Math.max(1, Math.min(100, Number(searchParams.employees) || 10));
  const typeId = (searchParams.type as string) ?? 'office';
  const addons = searchParams.addons
    ? String(searchParams.addons)
        .split(',')
        .filter((s) => s.trim())
    : [];
  return { plan: plan as PlanKey | 'enterprise', employees, typeId, addons };
}

/** 문서 번호: 날짜 + param 기반 고정값 (새로고침해도 동일) */
function docNumber(plan: string, employees: number, addons: string[]): string {
  const date = new Date();
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  // 파라미터 기반 짧은 해시 (표시용)
  const seed = `${plan}-${employees}-${addons.sort().join('')}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const suffix = String(Math.abs(h) % 9000 + 1000);
  return `GW-${yy}${mm}${dd}-${suffix}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function validUntilStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── 서브컴포넌트 ─────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── 페이지 ──────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QuotePage({ searchParams }: PageProps) {
  const params = parseParams(await searchParams);
  const { plan: planKey, employees, typeId, addons } = params;

  const businessType = BUSINESS_TYPES.find((t) => t.id === typeId) ?? BUSINESS_TYPES[0];
  const plan = planKey !== 'enterprise' ? PLANS[planKey as PlanKey] : null;

  const selectedAddons = ADDONS.filter((a) => addons.includes(a.id));
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const monthlyTotal = (plan?.price ?? 0) + addonTotal;
  const yearlyTotal = Math.floor(monthlyTotal * 0.83 * 12);
  const perEmployee = employees > 0 ? Math.ceil(monthlyTotal / employees) : 0;

  const docNo = docNumber(planKey, employees, addons);
  const isEnterprise = planKey === 'enterprise';

  return (
    <>
      {/* ── 인쇄 시 A4 여백 설정 ──────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── 컨트롤 바 (인쇄 시 숨김) ───────────────────────── */}
      <div className="print:hidden sticky top-0 z-40 bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary
                         hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              견적 다시 계산
            </Link>
            <span className="text-border">|</span>
            <span className="text-sm font-semibold text-text-primary hidden sm:block">
              {businessType.label} 맞춤 견적서
            </span>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-text-muted hidden sm:block">
              브라우저 인쇄 대화상자에서 <strong>PDF로 저장</strong>을 선택하세요
            </p>
            <QuotePrintButton />
          </div>
        </div>
      </div>

      {/* ── 문서 래퍼 ──────────────────────────────────────── */}
      <div className="min-h-screen bg-zinc-100 print:bg-white py-8 print:py-0">
        <div
          id="quote-document"
          className="max-w-[794px] mx-auto bg-white shadow-xl print:shadow-none
                     print:max-w-full"
        >

          {/* ═══ 헤더 ═══════════════════════════════════════ */}
          <div className="px-10 pt-10 pb-6 border-b-2 border-text-primary flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl font-black text-primary-600 tracking-tight mb-1">관리왕</p>
              <p className="text-xs text-text-muted">중소사업장 직원 관리 플랫폼</p>
              <p className="text-xs text-text-muted mt-0.5">contact@gwanliwang.com</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-text-primary mb-1">서 비 스 제 안 서</p>
              <table className="text-xs text-text-secondary ml-auto">
                <tbody>
                  <tr>
                    <td className="pr-3 py-0.5 text-text-muted">문서 번호</td>
                    <td className="font-semibold text-text-primary tabular-nums">{docNo}</td>
                  </tr>
                  <tr>
                    <td className="pr-3 py-0.5 text-text-muted">발행일</td>
                    <td className="font-semibold text-text-primary">{todayStr()}</td>
                  </tr>
                  <tr>
                    <td className="pr-3 py-0.5 text-text-muted">유효기간</td>
                    <td className="font-semibold text-text-primary">{validUntilStr()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ 수신처 & 업종 ═══════════════════════════════ */}
          <div className="px-10 py-6 border-b border-zinc-200">
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">수신</p>
                <div className="border-b-2 border-text-primary pb-1 min-w-[200px] inline-block">
                  <span className="text-text-muted text-sm">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                </div>
                <span className="ml-1 text-sm font-bold text-text-primary">귀중</span>
                <p className="text-xs text-text-muted mt-1">* 서명 전 귀사명을 기입해 주세요</p>
              </div>

              <div className="flex-1">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">제안 개요</p>
                <table className="text-sm w-full">
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="py-1 text-text-muted w-20">업종</td>
                      <td className="py-1 font-medium text-text-primary">
                        {businessType.icon} {businessType.label}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">직원 수</td>
                      <td className="py-1 font-medium text-text-primary tabular-nums">
                        {employees >= 100 ? '100명 이상' : `${employees}명`}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">플랜</td>
                      <td className="py-1 font-bold text-primary-700">
                        {isEnterprise ? 'Enterprise' : plan?.label} 플랜
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ═══ 제안 내용 ══════════════════════════════════ */}
          <div className="px-10 py-7">

            {/* 1. 서비스 구성 */}
            <h2 className="text-sm font-black text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              서비스 구성
            </h2>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="bg-zinc-800 text-white">
                  <th className="text-left px-3 py-2 font-semibold rounded-tl-lg">서비스 항목</th>
                  <th className="text-left px-3 py-2 font-semibold">내용</th>
                  <th className="text-center px-3 py-2 font-semibold">과금 방식</th>
                  <th className="text-right px-3 py-2 font-semibold rounded-tr-lg">월 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {/* 기본 플랜 */}
                {plan ? (
                  <tr className="hover:bg-zinc-50">
                    <td className="px-3 py-2.5 font-semibold text-text-primary">
                      {plan.label} 플랜
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary text-xs">
                      최대 {plan.maxEmployees}명 · 기본 기능 포함
                    </td>
                    <td className="px-3 py-2.5 text-center text-text-muted text-xs">월 정기결제</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {plan.price === 0 ? '무료' : fmt(plan.price)}
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-text-primary" colSpan={3}>
                      Enterprise 플랜
                    </td>
                    <td className="px-3 py-2.5 text-right text-text-muted text-xs">별도 협의</td>
                  </tr>
                )}

                {/* 추가 모듈 */}
                {selectedAddons.map((addon) => (
                  <tr key={addon.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2.5 font-medium text-text-primary flex items-center gap-1.5">
                      {addon.emoji} {addon.name}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary text-xs">{addon.desc}</td>
                    <td className="px-3 py-2.5 text-center text-text-muted text-xs">월 정기결제</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                      {fmt(addon.price)}
                    </td>
                  </tr>
                ))}

                {/* 합계 행 */}
                <tr className="bg-primary-600 text-white">
                  <td className="px-3 py-3 font-bold rounded-bl-lg" colSpan={3}>
                    월 합계 (VAT 별도)
                  </td>
                  <td className="px-3 py-3 text-right font-black text-lg tabular-nums rounded-br-lg">
                    {isEnterprise ? '별도 협의' : monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 2. 요금 요약 */}
            {!isEnterprise && (
              <>
                <h2 className="text-sm font-black text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  요금 요약
                </h2>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-center">
                    <p className="text-[11px] text-primary-600 font-bold uppercase tracking-wider mb-1">월 납부액</p>
                    <p className="text-xl font-black text-primary-700 tabular-nums">
                      {monthlyTotal === 0 ? '무료' : fmt(monthlyTotal)}
                    </p>
                    <p className="text-[10px] text-primary-500 mt-0.5">VAT 별도</p>
                  </div>

                  {monthlyTotal > 0 && (
                    <>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                        <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider mb-1">연 납부액</p>
                        <p className="text-xl font-black text-emerald-700 tabular-nums">
                          {fmt(yearlyTotal)}
                        </p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">연간 결제 시 약 17% 할인</p>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">인당 월 비용</p>
                        <p className="text-xl font-black text-text-primary tabular-nums">
                          {fmt(perEmployee)}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">직원 {employees}명 기준</p>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* 3. 기본 포함 기능 */}
            <h2 className="text-sm font-black text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                {isEnterprise ? '2' : '3'}
              </span>
              {businessType.label} 기본 포함 기능
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {/* 업종별 기능 */}
              {businessType.included.map((feat) => (
                <div key={feat} className="flex items-center gap-2 py-1">
                  <CheckIcon />
                  <span className="text-sm text-text-primary">{feat}</span>
                </div>
              ))}
              {/* 플랜 기본 기능 */}
              {plan?.features.map((feat) => (
                <div key={feat} className="flex items-center gap-2 py-1">
                  <CheckIcon />
                  <span className="text-sm text-text-secondary">{feat}</span>
                </div>
              ))}
            </div>

            {/* 4. 이용 조건 */}
            <h2 className="text-sm font-black text-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                {isEnterprise ? '3' : '4'}
              </span>
              이용 조건
            </h2>

            <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 mb-6">
              <ul className="space-y-1.5 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>14일 무료 체험 제공 — 신용카드 등록 없이 즉시 시작 가능합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>체험 종료 후 자동으로 유료 플랜으로 전환됩니다. 원치 않으시면 14일 이내에 취소하시면 됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>월간 결제: 매 결제일에 자동 갱신됩니다. 해지 시 당월 말까지 서비스가 유지됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>연간 결제: 선납 방식이며, 남은 기간에 대한 환불 정책은 서비스 이용약관을 따릅니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>본 제안서의 금액은 VAT(부가세 10%)가 별도 적용됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 font-bold mt-px">·</span>
                  <span>본 제안서의 유효기간은 발행일로부터 30일입니다.</span>
                </li>
              </ul>
            </div>

          </div>{/* /px-10 */}

          {/* ═══ 서명 & 인감란 ════════════════════════════════ */}
          <div className="mx-10 mb-8 border-t-2 border-zinc-800 pt-6">
            <div className="flex items-end justify-between gap-8">
              {/* 왼쪽: 제안사 정보 */}
              <div className="flex-1">
                <p className="text-xs text-text-muted mb-3">위 내용과 같이 서비스를 제안합니다.</p>
                <table className="text-xs text-text-secondary">
                  <tbody className="space-y-1">
                    <tr>
                      <td className="pr-4 py-0.5 text-text-muted w-16">상호명</td>
                      <td className="font-semibold text-text-primary">관리왕 (GwanriWang)</td>
                    </tr>
                    <tr>
                      <td className="pr-4 py-0.5 text-text-muted">담당자</td>
                      <td className="font-semibold text-text-primary">관리왕 영업팀</td>
                    </tr>
                    <tr>
                      <td className="pr-4 py-0.5 text-text-muted">연락처</td>
                      <td className="font-semibold text-text-primary">contact@gwanliwang.com</td>
                    </tr>
                    <tr>
                      <td className="pr-4 py-0.5 text-text-muted">사이트</td>
                      <td className="font-semibold text-primary-600">insagwanri-nine.vercel.app</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 오른쪽: 인감 자리 */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-24 h-24 rounded-full border-2 border-primary-400 flex items-center
                               justify-center text-primary-500"
                  style={{ borderStyle: 'double', borderWidth: '4px' }}
                >
                  <div className="text-center leading-tight">
                    <p className="text-[11px] font-black text-primary-600">관</p>
                    <p className="text-[11px] font-black text-primary-600">리</p>
                    <p className="text-[11px] font-black text-primary-600">왕</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted">(인)</p>
              </div>
            </div>
          </div>

          {/* ═══ 문서 하단 ════════════════════════════════════ */}
          <div className="bg-zinc-800 px-10 py-4 flex items-center justify-between text-xs text-zinc-400">
            <p>문서번호: {docNo}</p>
            <p>관리왕 — 중소사업장 직원 관리 플랫폼</p>
            <p>1 / 1</p>
          </div>

        </div>{/* /quote-document */}

        {/* ── 하단 액션 버튼 (인쇄 시 숨김) ─────────────────── */}
        <div className="print:hidden max-w-[794px] mx-auto mt-6 px-4 pb-10">
          <div className="bg-white rounded-2xl border border-border p-5 flex flex-col sm:flex-row
                          items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary mb-0.5">이 견적으로 시작하시겠어요?</p>
              <p className="text-xs text-text-muted">14일 무료 체험 · 언제든 취소 · 신용카드 불필요</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <QuotePrintButton />
              <a
                href="/auth/register"
                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900
                           text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                무료 체험 시작 →
              </a>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-4">
            인쇄 · PDF 저장 팁: 브라우저 인쇄(Ctrl+P) → 대상: PDF로 저장 →{' '}
            <strong>배경 그래픽</strong> 옵션 체크 권장
          </p>
        </div>

      </div>{/* /bg-zinc-100 */}
    </>
  );
}
