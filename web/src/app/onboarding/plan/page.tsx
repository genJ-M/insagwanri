'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import { Check, ChevronRight, FileText, Printer, ChevronDown, X } from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly_krw: number;
  price_yearly_krw: number;
  yearly_discount_rate: number;
  max_employees: number;
  ai_requests_per_day: number;
  storage_limit_gb: number;
  features: string[];
}

interface PaymentMethod {
  id: string;
  card_number_masked: string;
  card_issuer: string;
  card_brand: string;
  card_expiry_year: string;
  card_expiry_month: string;
  is_default: boolean;
}

interface IndustryPreset {
  code: string;
  label: string;
  emoji: string;
  description: string;
  defaultPages: string[];
  recommendedAttendanceMethods: string[];
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'onboarding_plan_state_v2';

const ALL_PAGES: { key: string; label: string; desc: string }[] = [
  { key: 'attendance',     label: '출퇴근 관리',   desc: '출퇴근 기록, GPS·QR·WiFi 연동' },
  { key: 'shift-schedule', label: '근무표',         desc: '주간 근무 배정 및 팀 근무표' },
  { key: 'vacations',      label: '휴가 관리',       desc: '연차·반차 신청 및 승인' },
  { key: 'payroll',        label: '급여',            desc: '급여명세서 및 원천징수' },
  { key: 'tasks',          label: '업무 관리',       desc: '업무지시·진행 현황' },
  { key: 'approvals',      label: '전자결재',         desc: '결재 기안·승인 워크플로우' },
  { key: 'calendar',       label: '캘린더',           desc: '팀 일정 및 반복 이벤트' },
  { key: 'team',           label: '팀 관리',          desc: '팀 구성 및 팀장 권한' },
  { key: 'hr-notes',       label: '인사 노트',        desc: '직원별 인사 기록 관리' },
  { key: 'contracts',      label: '계약서',           desc: '근로계약서 디지털 관리' },
  { key: 'training',       label: '교육·훈련',        desc: '사내 교육 이력 및 수료증' },
];

const TERMS_TEXT = `제1조 (목적)
이 약관은 관리왕(이하 "회사")이 제공하는 B2B SaaS 인사·근태 관리 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 온라인 인사·근태 관리 플랫폼을 말합니다.
2. "이용자"란 이 약관에 동의하고 서비스를 이용하는 사업자 또는 개인을 말합니다.
3. "구독"이란 유료 플랜에 따라 서비스를 이용하는 계약 관계를 말합니다.

제3조 (약관의 효력 및 변경)
1. 이 약관은 서비스 화면에 게시하거나 이용자에게 통지함으로써 효력이 발생합니다.
2. 회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있으며, 변경된 약관은 사전 공지 후 효력이 발생합니다.

제4조 (서비스의 제공)
1. 회사는 연중무휴 24시간 서비스를 제공하는 것을 원칙으로 합니다.
2. 정기점검, 서버 장애 등 불가피한 사유로 서비스를 일시 중단할 수 있습니다.

제5조 (구독 및 결제)
1. 유료 구독은 선택한 플랜과 결제 주기에 따라 자동으로 갱신됩니다.
2. 결제일 전 해지 요청 시 현재 기간 종료 후 구독이 종료됩니다.
3. 환불은 결제일로부터 7일 이내 미사용 시에만 가능합니다.

제6조 (데이터 보호)
회사는 이용자의 데이터를 개인정보 처리방침에 따라 안전하게 관리하며, 이용자의 동의 없이 제3자에게 제공하지 않습니다.

제7조 (책임의 한계)
천재지변, 전쟁, 해킹 등 불가항력적 사유로 발생한 손해에 대해서는 책임을 지지 않습니다.`;

const PRIVACY_TEXT = `1. 수집하는 개인정보 항목
회사는 서비스 제공을 위해 다음 정보를 수집합니다.
- 필수: 이름, 이메일, 전화번호, 소속 회사명, 사업자등록번호
- 선택: 부서, 직책, 프로필 사진, GPS 위치(출퇴근 시)

2. 개인정보 수집 및 이용 목적
- 서비스 회원가입 및 관리
- 근태·인사 관리 서비스 제공
- 결제 처리 및 세금계산서 발행
- 서비스 개선 및 고객 지원

3. 개인정보 보유 및 이용 기간
- 회원 탈퇴 시 즉시 삭제 (단, 관계 법령에 따라 일정 기간 보존)
- 근로기준법에 따른 근로 기록: 3년 보존
- 전자상거래법에 따른 결제 기록: 5년 보존

4. 개인정보 제3자 제공
이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
단, 법령에 의하거나 수사기관의 요청이 있는 경우는 예외로 합니다.

5. 개인정보 보호 조치
- AES-256 암호화 저장 (이메일, 이름)
- HTTPS 통신 암호화
- 접근 권한 최소화 및 접근 로그 기록

6. 이용자의 권리
이용자는 언제든지 개인정보 열람, 수정, 삭제를 요청할 수 있습니다.
문의: privacy@gwanri.co.kr`;

// ── 단계 표시기 ───────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['플랜 선택', '업종·기능', '약관 동의', '검토 보고서', '결제'];
  return (
    <div className="flex items-center gap-0 mb-10">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                done   && 'bg-blue-600 text-white',
                active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                !done && !active && 'bg-gray-100 text-gray-400',
              )}>
                {done ? <Check size={14} /> : step}
              </div>
              <span className={clsx(
                'text-[11px] font-medium whitespace-nowrap hidden sm:block',
                active ? 'text-blue-600' : done ? 'text-gray-400' : 'text-gray-300',
              )}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={clsx(
                'w-8 sm:w-16 h-0.5 mx-1 transition-all',
                done ? 'bg-blue-600' : 'bg-gray-200',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: 플랜 선택 ─────────────────────────────────────────────────────────

function Step1Plans({
  plans,
  billingCycle,
  setBillingCycle,
  selectedPlanId,
  setSelectedPlanId,
  currentPlanName,
  onNext,
}: {
  plans: Plan[];
  billingCycle: 'monthly' | 'yearly';
  setBillingCycle: (v: 'monthly' | 'yearly') => void;
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string) => void;
  currentPlanName?: string;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">플랜을 선택하세요</h2>
      <p className="text-gray-500 text-sm mb-8">비즈니스 규모에 맞는 플랜을 선택하세요.</p>

      {/* 결제 주기 토글 */}
      <div className="flex items-center gap-3 mb-8">
        {(['monthly', 'yearly'] as const).map((cycle) => (
          <button
            key={cycle}
            onClick={() => setBillingCycle(cycle)}
            className={clsx(
              'px-5 py-2 rounded-full text-sm font-medium transition-colors',
              billingCycle === cycle
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            )}
          >
            {cycle === 'monthly' ? '월간 결제' : '연간 결제'}
            {cycle === 'yearly' && (
              <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                최대 20% 할인
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.price_yearly_krw : plan.price_monthly_krw;
          const isSelected = selectedPlanId === plan.id;
          const isCurrent = currentPlanName === plan.name;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={clsx(
                'relative text-left rounded-xl border-2 p-5 transition-all',
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200',
              )}
            >
              {isCurrent && (
                <span className="absolute top-3 right-3 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">현재</span>
              )}
              <h3 className="font-bold text-gray-900 text-base">{plan.display_name}</h3>
              <div className="mt-3 mb-4">
                {price === 0 ? (
                  <span className="text-2xl font-bold text-gray-900">무료</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">{Number(price).toLocaleString()}</span>
                    <span className="text-sm text-gray-500">원/{billingCycle === 'yearly' ? '년' : '월'}</span>
                  </>
                )}
                {billingCycle === 'yearly' && plan.yearly_discount_rate > 0 && (
                  <p className="text-xs text-green-600 mt-0.5">{plan.yearly_discount_rate}% 할인 적용</p>
                )}
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>• 직원 최대 {plan.max_employees === 9999 ? '무제한' : `${plan.max_employees}명`}</li>
                <li>• AI {plan.ai_requests_per_day === 0 ? '미제공' : `일 ${plan.ai_requests_per_day}회`}</li>
                <li>• 저장공간 {plan.storage_limit_gb}GB</li>
                {Array.isArray(plan.features) && plan.features.slice(0, 3).map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!selectedPlanId}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: 업종 & 기능 설정 ──────────────────────────────────────────────────

function Step2Industry({
  presets,
  selectedIndustry,
  setSelectedIndustry,
  selectedPages,
  setSelectedPages,
  onNext,
  onBack,
}: {
  presets: IndustryPreset[];
  selectedIndustry: string;
  setSelectedIndustry: (v: string) => void;
  selectedPages: string[];
  setSelectedPages: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const [customIndustry, setCustomIndustry] = useState('');

  const preset = presets.find((p) => p.code === selectedIndustry);

  const handleSelectPreset = (code: string) => {
    setSelectedIndustry(code);
    const p = presets.find((x) => x.code === code);
    if (p) setSelectedPages(p.defaultPages);
    setShowIndustryPicker(false);
  };

  const handleCustomIndustry = () => {
    if (!customIndustry.trim()) return;
    setSelectedIndustry(customIndustry.trim());
    setShowIndustryPicker(false);
    setCustomIndustry('');
  };

  const togglePage = (key: string) => {
    setSelectedPages(
      selectedPages.includes(key)
        ? selectedPages.filter((k) => k !== key)
        : [...selectedPages, key],
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">업종 & 기능 설정</h2>
      <p className="text-gray-500 text-sm mb-8">업종을 선택하면 맞춤 기능이 자동으로 설정됩니다.</p>

      {/* 업종 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">업종</label>
        <button
          type="button"
          onClick={() => setShowIndustryPicker(!showIndustryPicker)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm hover:border-blue-300 transition-colors"
        >
          <span className={selectedIndustry ? 'text-gray-900' : 'text-gray-400'}>
            {preset ? `${preset.emoji} ${preset.label}` : selectedIndustry || '업종을 선택하세요'}
          </span>
          <ChevronDown size={16} className="text-gray-400" />
        </button>

        {showIndustryPicker && (
          <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {presets.map((p) => (
                <button
                  key={p.code}
                  onClick={() => handleSelectPreset(p.code)}
                  className={clsx(
                    'flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all',
                    selectedIndustry === p.code
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300',
                  )}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className="text-sm font-medium text-gray-900">{p.label}</span>
                  <span className="text-[11px] text-gray-400 leading-tight">{p.description}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-2">목록에 없으면 직접 입력</p>
              <div className="flex gap-2">
                <input
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  placeholder="예: 펫샵, 세탁소..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCustomIndustry}
                  disabled={!customIndustry.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 기능 체크리스트 */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-1">사용할 기능</label>
        <p className="text-xs text-gray-400 mb-3">
          {preset ? `${preset.label} 업종 기본값이 자동 체크되었습니다. 필요에 따라 수정하세요.` : '사용할 기능을 선택하세요.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_PAGES.map(({ key, label, desc }) => {
            const checked = selectedPages.includes(key);
            return (
              <label
                key={key}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                  checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePage(key)}
                  className="mt-0.5 h-4 w-4 text-blue-600 rounded"
                />
                <div>
                  <p className={clsx('text-sm font-medium', checked ? 'text-blue-800' : 'text-gray-700')}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
          이전
        </button>
        <button
          onClick={onNext}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: 약관 동의 ─────────────────────────────────────────────────────────

function Step3Terms({
  agreedTerms,
  setAgreedTerms,
  agreedPrivacy,
  setAgreedPrivacy,
  onNext,
  onBack,
}: {
  agreedTerms: boolean;
  setAgreedTerms: (v: boolean) => void;
  agreedPrivacy: boolean;
  setAgreedPrivacy: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">약관 동의</h2>
      <p className="text-gray-500 text-sm mb-8">서비스 이용을 위해 약관을 확인하고 동의해 주세요.</p>

      {/* 서비스 이용약관 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">서비스 이용약관 (필수)</span>
        </div>
        <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-3">
          {TERMS_TEXT}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">서비스 이용약관에 동의합니다.</span>
        </label>
      </div>

      {/* 개인정보 처리방침 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">개인정보 처리방침 (필수)</span>
        </div>
        <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 h-48 overflow-y-auto text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-3">
          {PRIVACY_TEXT}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">개인정보 처리방침에 동의합니다.</span>
        </label>
      </div>

      {/* 전체 동의 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedTerms && agreedPrivacy}
            onChange={(e) => { setAgreedTerms(e.target.checked); setAgreedPrivacy(e.target.checked); }}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span className="text-sm font-semibold text-blue-800">이용약관 및 개인정보 처리방침 전체 동의</span>
        </label>
      </div>

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
          이전
        </button>
        <button
          onClick={onNext}
          disabled={!agreedTerms || !agreedPrivacy}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: 검토 보고서 ───────────────────────────────────────────────────────

function Step4Report({
  plan,
  billingCycle,
  industry,
  industryLabel,
  selectedPages,
  companyName,
  onNext,
  onBack,
}: {
  plan: Plan | undefined;
  billingCycle: 'monthly' | 'yearly';
  industry: string;
  industryLabel: string;
  selectedPages: string[];
  companyName: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const price = plan
    ? billingCycle === 'yearly' ? plan.price_yearly_krw : plan.price_monthly_krw
    : 0;

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const pageLabels: Record<string, string> = {};
  ALL_PAGES.forEach(({ key, label }) => { pageLabels[key] = label; });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">플랜 도입 검토 보고서</h2>
      <p className="text-gray-500 text-sm mb-8">도입 전 검토·보고용 문서입니다. PDF로 저장할 수 있습니다.</p>

      {/* 보고서 본문 */}
      <div
        ref={reportRef}
        id="plan-report"
        className="border border-gray-200 rounded-xl bg-white p-8 mb-6 text-sm leading-relaxed print:border-none print:p-0"
      >
        {/* 상단 헤더 */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">플랜 도입 검토 보고서</h1>
          <p className="text-gray-500 text-xs mt-1">관리왕 (Insagwanri) — SaaS 인사·근태 관리 플랫폼</p>
        </div>

        {/* 기본 정보 */}
        <table className="w-full text-sm mb-6 border-collapse">
          <tbody>
            {[
              { label: '작성일', value: today },
              { label: '회사명', value: companyName || '—' },
              { label: '업종', value: industryLabel || '—' },
              { label: '선택 플랜', value: plan?.display_name ?? '—' },
              { label: '결제 주기', value: billingCycle === 'yearly' ? '연간 결제' : '월간 결제' },
              {
                label: '요금',
                value: price === 0 ? '무료' : `${Number(price).toLocaleString()}원/${billingCycle === 'yearly' ? '년' : '월'} (VAT 별도)`,
              },
            ].map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-500 font-medium w-28">{label}</td>
                <td className="py-2 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 도입 기능 목록 */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">도입 기능 목록 ({selectedPages.length}개)</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_PAGES.map(({ key, label }) => {
              const active = selectedPages.includes(key);
              return (
                <div key={key} className={clsx('flex items-center gap-2 text-sm', active ? 'text-gray-800' : 'text-gray-300 line-through')}>
                  <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0', active ? 'bg-blue-600' : 'bg-gray-100')}>
                    {active && <Check size={9} className="text-white" />}
                  </div>
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* 플랜 상세 */}
        {plan && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">플랜 상세</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• 최대 직원 수: {plan.max_employees === 9999 ? '무제한' : `${plan.max_employees}명`}</li>
              <li>• AI 기능: {plan.ai_requests_per_day === 0 ? '미포함' : `일 ${plan.ai_requests_per_day}회`}</li>
              <li>• 저장공간: {plan.storage_limit_gb}GB</li>
              {Array.isArray(plan.features) && plan.features.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 약관 동의 확인 */}
        <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
          <p>✓ 서비스 이용약관 동의 완료</p>
          <p className="mt-0.5">✓ 개인정보 처리방침 동의 완료</p>
          <p className="mt-2 text-gray-300">
            본 보고서는 도입 검토·보고 목적으로 작성된 참고 문서이며 법적 효력이 없습니다.
          </p>
        </div>
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Printer size={15} /> PDF 저장 (인쇄)
        </button>
        <p className="text-xs text-gray-400">인쇄 창에서 "PDF로 저장"을 선택하세요.</p>
      </div>

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
          이전
        </button>
        <button
          onClick={onNext}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          결제로 이동 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 5: 결제 ──────────────────────────────────────────────────────────────

function Step5Payment({
  plan,
  billingCycle,
  paymentMethods,
  selectedPaymentMethodId,
  setSelectedPaymentMethodId,
  couponCode,
  setCouponCode,
  onSubmit,
  onBack,
  isLoading,
}: {
  plan: Plan | undefined;
  billingCycle: 'monthly' | 'yearly';
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  setSelectedPaymentMethodId: (id: string) => void;
  couponCode: string;
  setCouponCode: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const router = useRouter();
  const price = plan
    ? (billingCycle === 'yearly' ? plan.price_yearly_krw : plan.price_monthly_krw)
    : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">결제</h2>
      <p className="text-gray-500 text-sm mb-8">결제 수단을 선택하고 구독을 시작하세요.</p>

      {/* 주문 요약 */}
      {plan && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">주문 요약</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">플랜</span>
              <span className="font-medium text-gray-900">{plan.display_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">결제 주기</span>
              <span className="font-medium text-gray-900">{billingCycle === 'yearly' ? '연간' : '월간'}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-semibold text-gray-800">합계 (VAT 포함)</span>
              <span className="font-bold text-blue-600 text-base">
                {price === 0 ? '무료' : `${Math.round(Number(price) * 1.1).toLocaleString()}원`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 결제 수단 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">결제 수단</h3>
          <button
            onClick={() => router.push('/onboarding/payment')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 카드 추가
          </button>
        </div>
        {paymentMethods.length > 0 ? (
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <label
                key={pm.id}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                  selectedPaymentMethodId === pm.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50',
                )}
              >
                <input
                  type="radio"
                  name="pm"
                  checked={selectedPaymentMethodId === pm.id}
                  onChange={() => setSelectedPaymentMethodId(pm.id)}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{pm.card_issuer} {pm.card_number_masked}</p>
                  <p className="text-xs text-gray-500">{pm.card_expiry_year}/{pm.card_expiry_month}</p>
                </div>
                {pm.is_default && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">기본</span>
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-sm text-gray-400 mb-3">등록된 결제 수단이 없습니다.</p>
            <button
              onClick={() => router.push('/onboarding/payment')}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              카드 등록하기
            </button>
          </div>
        )}
      </div>

      {/* 쿠폰 */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">쿠폰 코드 (선택)</h3>
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="쿠폰 코드 입력"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50">
          이전
        </button>
        <button
          onClick={onSubmit}
          disabled={!plan || !selectedPaymentMethodId || isLoading}
          className="flex-1 bg-blue-600 text-white py-3 px-8 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? '결제 처리 중...' : '결제하고 시작하기'}
        </button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function PlanSelectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // sessionStorage 복원
  const restoreState = () => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };
  const saved = restoreState();

  const [step, setStep] = useState<number>(saved?.step ?? 1);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(saved?.billingCycle ?? 'monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(saved?.selectedPlanId ?? null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(saved?.selectedPaymentMethodId ?? null);
  const [couponCode, setCouponCode] = useState<string>(saved?.couponCode ?? '');
  const [selectedIndustry, setSelectedIndustry] = useState<string>(saved?.selectedIndustry ?? '');
  const [selectedPages, setSelectedPages] = useState<string[]>(saved?.selectedPages ?? []);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(saved?.agreedTerms ?? false);
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(saved?.agreedPrivacy ?? false);

  // 상태 동기화
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        step, billingCycle, selectedPlanId, selectedPaymentMethodId,
        couponCode, selectedIndustry, selectedPages, agreedTerms, agreedPrivacy,
      }));
    } catch {}
  }, [step, billingCycle, selectedPlanId, selectedPaymentMethodId, couponCode, selectedIndustry, selectedPages, agreedTerms, agreedPrivacy]);

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans');
      return res.data.data as { currentSubscription: any; plans: Plan[] };
    },
  });

  const { data: presets = [] } = useQuery<IndustryPreset[]>({
    queryKey: ['industry-presets'],
    queryFn: () => api.get('/workspace/industry-presets').then((r) => r.data.data),
    staleTime: Infinity,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/payment-methods');
      return res.data.data;
    },
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: async () => { const { data } = await api.get('/workspace/settings'); return data.data ?? data; },
  });

  // 기본 결제수단 자동 선택
  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
      const def = paymentMethods.find((m) => m.is_default);
      if (def) setSelectedPaymentMethodId(def.id);
    }
  }, [paymentMethods, selectedPaymentMethodId]);

  // 업종 저장 (Step2 → Step3 진행 시)
  const saveIndustryMutation = useMutation({
    mutationFn: (industry: string) => api.patch('/workspace/settings', { industry }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });

  const upgradeMutation = useMutation({
    mutationFn: (vars: { planId: string; paymentMethodId: string; couponCode?: string }) =>
      api.post('/subscriptions/upgrade', {
        planId: vars.planId,
        paymentMethodId: vars.paymentMethodId,
        billingCycle,
        couponCode: vars.couponCode || undefined,
      }),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(`${d.plan} 플랜으로 전환되었습니다! (${Number(d.amount).toLocaleString()}원)`);
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      router.push('/subscription');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '결제 중 오류가 발생했습니다.'),
  });

  const plans = plansData?.plans ?? [];
  const currentSub = plansData?.currentSubscription;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const industryPreset = presets.find((p) => p.code === selectedIndustry);
  const industryLabel = industryPreset ? `${industryPreset.emoji} ${industryPreset.label}` : selectedIndustry;

  const handleStep2Next = async () => {
    if (selectedIndustry) {
      try { await saveIndustryMutation.mutateAsync(selectedIndustry); } catch {}
    }
    setStep(3);
  };

  const handleUpgrade = () => {
    if (!selectedPlanId) return toast.error('플랜을 선택해 주세요.');
    if (!selectedPaymentMethodId) return toast.error('결제 수단을 선택해 주세요.');
    upgradeMutation.mutate({ planId: selectedPlanId, paymentMethodId: selectedPaymentMethodId, couponCode });
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body > *:not(#plan-report-wrapper) { display: none !important; }
          #plan-report-wrapper { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900">구독 시작하기</h1>
            {currentSub && (
              <p className="text-gray-500 mt-2 text-sm">현재 {currentSub.plan_display_name} 플랜 이용 중</p>
            )}
          </div>

          <StepIndicator current={step} total={5} />

          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            {step === 1 && (
              <Step1Plans
                plans={plans}
                billingCycle={billingCycle}
                setBillingCycle={setBillingCycle}
                selectedPlanId={selectedPlanId}
                setSelectedPlanId={setSelectedPlanId}
                currentPlanName={currentSub?.plan_name}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <Step2Industry
                presets={presets}
                selectedIndustry={selectedIndustry}
                setSelectedIndustry={setSelectedIndustry}
                selectedPages={selectedPages}
                setSelectedPages={setSelectedPages}
                onNext={handleStep2Next}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <Step3Terms
                agreedTerms={agreedTerms}
                setAgreedTerms={setAgreedTerms}
                agreedPrivacy={agreedPrivacy}
                setAgreedPrivacy={setAgreedPrivacy}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <Step4Report
                plan={selectedPlan}
                billingCycle={billingCycle}
                industry={selectedIndustry}
                industryLabel={industryLabel}
                selectedPages={selectedPages}
                companyName={workspace?.name ?? ''}
                onNext={() => setStep(5)}
                onBack={() => setStep(3)}
              />
            )}
            {step === 5 && (
              <Step5Payment
                plan={selectedPlan}
                billingCycle={billingCycle}
                paymentMethods={paymentMethods}
                selectedPaymentMethodId={selectedPaymentMethodId}
                setSelectedPaymentMethodId={setSelectedPaymentMethodId}
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                onSubmit={handleUpgrade}
                onBack={() => setStep(4)}
                isLoading={upgradeMutation.isPending}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
