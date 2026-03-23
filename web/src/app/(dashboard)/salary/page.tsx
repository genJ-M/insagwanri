'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, X, Printer,
  CheckCircle2, Clock, Banknote, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ── 유틸 ──────────────────────────────────────────────
const KRW = (v: number) => v.toLocaleString('ko-KR') + '원';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:     { label: '초안',     color: 'bg-gray-100 text-gray-500' },
  confirmed: { label: '확정',     color: 'bg-blue-100 text-blue-600' },
  paid:      { label: '지급완료', color: 'bg-emerald-100 text-emerald-700' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', s.color)}>
      {s.label}
    </span>
  );
}

// ── 숫자 입력 필드 ────────────────────────────────────
function AmountInput({
  label, name, value, onChange, disabled,
}: {
  label: string; name: string; value: number; onChange: (name: string, val: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={1000}
          value={value || ''}
          onChange={(e) => onChange(name, parseInt(e.target.value) || 0)}
          disabled={disabled}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
          placeholder="0"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">원</span>
      </div>
    </div>
  );
}

// ── 급여 명세서 모달 ──────────────────────────────────
function SlipModal({ salary, onClose }: { salary: any; onClose: () => void }) {
  const user = salary.user ?? {};
  const year = salary.year;
  const month = salary.month;

  const earnings = [
    { label: '기본급',     value: salary.baseSalary },
    { label: '연장근무수당', value: salary.overtimePay },
    { label: '휴일수당',   value: salary.holidayPay },
    { label: '상여금',     value: salary.bonus },
    { label: '식비 (비과세)', value: salary.mealAllowance },
    { label: '교통비 (비과세)', value: salary.transportAllowance },
    { label: '기타수당',   value: salary.otherAllowance },
  ].filter((e) => e.value > 0);

  const deductions = [
    { label: '소득세',       value: salary.incomeTax },
    { label: '지방소득세',   value: salary.localTax },
    { label: '국민연금',     value: salary.nationalPension },
    { label: '건강보험',     value: salary.healthInsurance },
    { label: '장기요양보험', value: salary.careInsurance },
    { label: '고용보험',     value: salary.employmentInsurance },
    { label: '기타공제',     value: salary.otherDeduction },
  ].filter((d) => d.value > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text-primary">급여 명세서</h2>
            <p className="text-sm text-text-muted">{year}년 {month}월</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg px-3 py-2 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              인쇄
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* 수신인 */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-gray-50/50">
          <Avatar name={user.name ?? '?'} size="lg" />
          <div>
            <p className="font-semibold text-text-primary">{user.name}</p>
            <p className="text-sm text-text-muted">{user.department} · {user.position}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={salary.status} />
          </div>
        </div>

        {/* 차인지급액 */}
        <div className="px-6 py-5 text-center border-b border-border">
          <p className="text-xs text-text-muted mb-1">차인지급액</p>
          <p className="text-3xl font-bold text-primary-600 tabular-nums">
            {KRW(salary.netPay)}
          </p>
        </div>

        {/* 지급/공제 2단 */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {/* 지급 */}
          <div className="bg-white p-5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">지급 항목</p>
            <div className="space-y-2">
              {earnings.map((e) => (
                <div key={e.label} className="flex justify-between text-sm">
                  <span className="text-text-secondary">{e.label}</span>
                  <span className="tabular-nums font-medium text-text-primary">{KRW(e.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span>지급 합계</span>
              <span className="text-emerald-600 tabular-nums">{KRW(salary.grossPay)}</span>
            </div>
          </div>

          {/* 공제 */}
          <div className="bg-white p-5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">공제 항목</p>
            <div className="space-y-2">
              {deductions.map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span className="text-text-secondary">{d.label}</span>
                  <span className="tabular-nums font-medium text-text-primary">{KRW(d.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span>공제 합계</span>
              <span className="text-red-500 tabular-nums">{KRW(salary.totalDeduction)}</span>
            </div>
          </div>
        </div>

        {/* 근무 통계 */}
        {(salary.workDays != null || salary.workMinutes != null) && (
          <div className="px-6 py-4 bg-gray-50 border-t border-border flex gap-6 text-sm">
            {salary.workDays != null && (
              <span className="text-text-secondary">근무일수 <b className="text-text-primary">{salary.workDays}일</b></span>
            )}
            {salary.workMinutes != null && (
              <span className="text-text-secondary">총 근무 <b className="text-text-primary">{Math.floor(salary.workMinutes / 60)}h {salary.workMinutes % 60}m</b></span>
            )}
          </div>
        )}

        {salary.note && (
          <div className="px-6 py-3 border-t border-border">
            <p className="text-xs text-text-muted">비고: {salary.note}</p>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border">
          <p className="text-[11px] text-text-muted">
            ※ 본 급여명세서는 관리왕 시스템에서 자동 생성되었습니다. 4대보험료는 2024년 기준 근사값이며 실제 고지서를 기준으로 조정하시기 바랍니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 급여 생성/수정 폼 ────────────────────────────────
const EMPTY_FORM = {
  user_id: '',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  base_salary: 0,
  overtime_pay: 0, holiday_pay: 0, bonus: 0,
  meal_allowance: 0, transport_allowance: 0, other_allowance: 0,
  income_tax: 0, local_tax: 0, national_pension: 0,
  health_insurance: 0, care_insurance: 0, employment_insurance: 0,
  other_deduction: 0,
  note: '',
};

type FormData = typeof EMPTY_FORM;

function SalaryForm({
  members, onClose, editTarget, filterYear, filterMonth,
}: {
  members: any[];
  onClose: () => void;
  editTarget?: any;
  filterYear: number;
  filterMonth: number;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>(
    editTarget
      ? {
          user_id:              editTarget.user?.id ?? '',
          year:                 editTarget.year,
          month:                editTarget.month,
          base_salary:          editTarget.baseSalary,
          overtime_pay:         editTarget.overtimePay,
          holiday_pay:          editTarget.holidayPay,
          bonus:                editTarget.bonus,
          meal_allowance:       editTarget.mealAllowance,
          transport_allowance:  editTarget.transportAllowance,
          other_allowance:      editTarget.otherAllowance,
          income_tax:           editTarget.incomeTax,
          local_tax:            editTarget.localTax,
          national_pension:     editTarget.nationalPension,
          health_insurance:     editTarget.healthInsurance,
          care_insurance:       editTarget.careInsurance,
          employment_insurance: editTarget.employmentInsurance,
          other_deduction:      editTarget.otherDeduction,
          note:                 editTarget.note ?? '',
        }
      : { ...EMPTY_FORM, year: filterYear, month: filterMonth },
  );
  const [autoCalcDone, setAutoCalcDone] = useState(false);

  const set = (name: string, val: number) => setForm((f) => ({ ...f, [name]: val }));

  // 4대보험 자동 계산
  const autoCalc = useMutation({
    mutationFn: () =>
      api.post('/salary/calculate', {
        year: form.year, month: form.month,
        base_salary: form.base_salary,
        meal_allowance: form.meal_allowance,
        transport_allowance: form.transport_allowance,
      }),
    onSuccess: ({ data }) => {
      const d = data.data;
      setForm((f) => ({
        ...f,
        national_pension:     d.nationalPension,
        health_insurance:     d.healthInsurance,
        care_insurance:       d.careInsurance,
        employment_insurance: d.employmentInsurance,
        income_tax:           d.incomeTax,
        local_tax:            d.localTax,
      }));
      setAutoCalcDone(true);
      toast.success('4대보험 자동 계산 완료');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editTarget
        ? api.patch(`/salary/${editTarget.id}`, payload)
        : api.post('/salary', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary'] });
      toast.success(editTarget ? '급여가 수정되었습니다.' : '급여가 등록되었습니다.');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '저장 실패'),
  });

  const grossPay = form.base_salary + form.overtime_pay + form.holiday_pay + form.bonus
    + form.meal_allowance + form.transport_allowance + form.other_allowance;
  const totalDeduction = form.income_tax + form.local_tax + form.national_pension
    + form.health_insurance + form.care_insurance + form.employment_insurance + form.other_deduction;
  const netPay = grossPay - totalDeduction;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) { toast.error('직원을 선택하세요.'); return; }
    if (form.base_salary <= 0) { toast.error('기본급을 입력하세요.'); return; }
    saveMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-text-primary">
            {editTarget ? '급여 수정' : '급여 등록'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">직원 *</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                disabled={!!editTarget}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
              >
                <option value="">선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.department ?? '-'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">연도 *</label>
              <input
                type="number" min={2020} max={2099}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))}
                disabled={!!editTarget}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">월 *</label>
              <select
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: parseInt(e.target.value) }))}
                disabled={!!editTarget}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {/* 지급 항목 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">지급 항목</h3>
              <button
                type="button"
                onClick={() => autoCalc.mutate()}
                disabled={form.base_salary <= 0 || autoCalc.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 border border-primary-200 bg-primary-50 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                4대보험 자동 계산
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AmountInput label="기본급 *" name="base_salary" value={form.base_salary} onChange={set} />
              <AmountInput label="연장근무수당" name="overtime_pay" value={form.overtime_pay} onChange={set} />
              <AmountInput label="휴일수당" name="holiday_pay" value={form.holiday_pay} onChange={set} />
              <AmountInput label="상여금" name="bonus" value={form.bonus} onChange={set} />
              <AmountInput label="식비 (비과세)" name="meal_allowance" value={form.meal_allowance} onChange={set} />
              <AmountInput label="교통비 (비과세)" name="transport_allowance" value={form.transport_allowance} onChange={set} />
              <AmountInput label="기타수당" name="other_allowance" value={form.other_allowance} onChange={set} />
            </div>
          </div>

          {/* 공제 항목 */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              공제 항목
              {autoCalcDone && (
                <span className="ml-2 text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">자동계산됨</span>
              )}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <AmountInput label="소득세" name="income_tax" value={form.income_tax} onChange={set} />
              <AmountInput label="지방소득세" name="local_tax" value={form.local_tax} onChange={set} />
              <AmountInput label="국민연금" name="national_pension" value={form.national_pension} onChange={set} />
              <AmountInput label="건강보험" name="health_insurance" value={form.health_insurance} onChange={set} />
              <AmountInput label="장기요양보험" name="care_insurance" value={form.care_insurance} onChange={set} />
              <AmountInput label="고용보험" name="employment_insurance" value={form.employment_insurance} onChange={set} />
              <AmountInput label="기타공제" name="other_deduction" value={form.other_deduction} onChange={set} />
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">비고</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="메모 (선택)"
            />
          </div>

          {/* 합계 미리보기 */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] text-text-muted mb-1">지급 합계</p>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">{KRW(grossPay)}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted mb-1">공제 합계</p>
              <p className="text-sm font-bold text-red-500 tabular-nums">{KRW(totalDeduction)}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted mb-1">차인지급액</p>
              <p className="text-sm font-bold text-primary-600 tabular-nums">{KRW(netPay)}</p>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-5 py-2 text-sm font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? '저장 중…' : (editTarget ? '수정' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────
export default function SalaryPage() {
  usePageTitle('급여 관리');
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role !== 'employee';
  const qc = useQueryClient();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [slipTarget, setSlipTarget] = useState<any>(null);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  // 급여 목록
  const { data: salaryList = [], isLoading } = useQuery<any[]>({
    queryKey: ['salary', year, month],
    queryFn: async () => {
      const endpoint = isManager ? '/salary' : '/salary/me';
      const { data } = await api.get(endpoint, { params: { year, month } });
      return data.data ?? [];
    },
  });

  // 월별 요약 (관리자)
  const { data: summary } = useQuery({
    queryKey: ['salary-summary', year, month],
    queryFn: async () => {
      const { data } = await api.get('/salary/summary', { params: { year, month } });
      return data.data ?? {};
    },
    enabled: isManager,
  });

  // 직원 목록 (관리자용 폼)
  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['users-active'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { status: 'active', limit: 200 } });
      return data.data?.users ?? data.data ?? [];
    },
    enabled: isManager,
  });

  // 상태 변경 뮤테이션
  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/salary/${id}/confirm`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary'] }); toast.success('급여 확정'); },
  });
  const payMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/salary/${id}/pay`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary'] }); toast.success('지급 완료 처리'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/salary/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary'] }); toast.success('삭제되었습니다.'); },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="급여 관리" />

      <main className="page-container space-y-6">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-border hover:bg-gray-50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-text-muted" />
            </button>
            <h2 className="text-xl font-bold text-text-primary tabular-nums min-w-[120px] text-center">
              {year}년 {month}월
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-border hover:bg-gray-50 transition-colors">
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </button>
          </div>
          {isManager && (
            <button
              onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              급여 등록
            </button>
          )}
        </div>

        {/* 요약 카드 (관리자) */}
        {isManager && summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '총 인원',      value: `${summary.count ?? 0}명`,   icon: '👤', color: 'bg-primary-500' },
              { label: '총 지급 합계', value: KRW(summary.grossPay ?? 0),  icon: '💰', color: 'bg-emerald-500' },
              { label: '총 공제 합계', value: KRW(summary.deduction ?? 0), icon: '📊', color: 'bg-amber-500' },
              { label: '지급 완료',    value: `${summary.paidCount ?? 0}명`, icon: '✅', color: 'bg-gray-500' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border shadow-card p-5">
                <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-base mb-3`}>
                  {icon}
                </div>
                <p className="text-lg font-bold text-text-primary tabular-nums">{value}</p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 급여 테이블 */}
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                {['직원', '기본급', '수당 합계', '공제 합계', '차인지급액', '상태', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : salaryList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <Banknote className="h-10 w-10 text-gray-200" />
                      <p className="text-sm">{year}년 {month}월 급여 데이터가 없습니다.</p>
                      {isManager && (
                        <button
                          onClick={() => setShowForm(true)}
                          className="mt-2 text-xs font-medium text-primary-500 hover:text-primary-600"
                        >
                          + 급여 등록하기
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                salaryList.map((s) => {
                  const allowances = s.overtimePay + s.holidayPay + s.bonus
                    + s.mealAllowance + s.transportAllowance + s.otherAllowance;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.user?.name ?? '?'} size="sm" />
                          <div>
                            <p className="font-medium text-text-primary">{s.user?.name ?? '—'}</p>
                            <p className="text-xs text-text-muted">{s.user?.department ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">{KRW(s.baseSalary)}</td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">{KRW(allowances)}</td>
                      <td className="px-4 py-3 tabular-nums text-red-500">{KRW(s.totalDeduction)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-text-primary">{KRW(s.netPay)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* 명세서 보기 */}
                          <button
                            onClick={() => setSlipTarget(s)}
                            className="px-2.5 py-1 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            명세서
                          </button>
                          {/* 관리자 액션 */}
                          {isManager && (
                            <>
                              {s.status === 'draft' && (
                                <button
                                  onClick={() => { setEditTarget(s); setShowForm(true); }}
                                  className="px-2.5 py-1 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  수정
                                </button>
                              )}
                              {s.status === 'draft' && (
                                <button
                                  onClick={() => confirmMutation.mutate(s.id)}
                                  className="px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  확정
                                </button>
                              )}
                              {s.status === 'confirmed' && (
                                <button
                                  onClick={() => payMutation.mutate(s.id)}
                                  className="px-2.5 py-1 text-xs font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                  지급
                                </button>
                              )}
                              {s.status === 'draft' && user?.role === 'owner' && (
                                <button
                                  onClick={() => {
                                    if (confirm(`${s.user?.name}의 ${year}년 ${month}월 급여를 삭제하시겠습니까?`)) {
                                      deleteMutation.mutate(s.id);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs font-medium text-red-500 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  삭제
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-text-muted text-center pb-2">
          ※ 4대보험료 자동 계산은 2024년 기준 근사값입니다. 실제 고지서를 기준으로 조정하시기 바랍니다.
        </p>
      </main>

      {/* 폼 모달 */}
      {showForm && (
        <SalaryForm
          members={members}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          editTarget={editTarget}
          filterYear={year}
          filterMonth={month}
        />
      )}

      {/* 명세서 모달 */}
      {slipTarget && (
        <SlipModal salary={slipTarget} onClose={() => setSlipTarget(null)} />
      )}
    </div>
  );
}
