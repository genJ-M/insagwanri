'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  FileText, ShieldCheck, TriangleAlert, Calendar,
  Printer, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const TABS = ['할 일 목록', '원천징수', '4대보험', '연말정산', '퇴직금', '연간 캘린더'] as const;
type Tab = typeof TABS[number];

// ── 긴급도 스타일 ──────────────────────────────────────
const urgencyStyle = {
  urgent:  { bar: 'bg-red-400',   badge: 'bg-red-100 text-red-700',   row: 'border-red-200 bg-red-50' },
  warning: { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', row: 'border-amber-200 bg-amber-50' },
  normal:  { bar: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-600',  row: 'border-gray-100 bg-white' },
};

const categoryIcon = {
  tax:      FileText,
  insurance: ShieldCheck,
  labor:    TriangleAlert,
  contract: AlertCircle,
};

// ── 세무 서류 출력 헬퍼 ────────────────────────────────
function openPrintWindow(url: string) {
  window.open(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${url}`,
    '_blank',
    'width=900,height=700',
  );
}

// ── 할 일 목록 탭 ─────────────────────────────────────
function TodoTab() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['tax-todo'],
    queryFn: async () => {
      const { data } = await api.get('/tax-documents/todo');
      return (data?.data ?? data ?? []) as any[];
    },
    staleTime: 1000 * 60 * 15,
  });

  if (isLoading) return <div className="py-16 text-center text-sm text-text-muted animate-pulse">불러오는 중...</div>;
  if (items.length === 0) return (
    <div className="py-16 text-center">
      <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
      <p className="text-sm font-medium text-text-primary">35일 이내 마감 항목이 없습니다.</p>
      <p className="text-xs text-text-muted mt-1">연간 세무 캘린더에서 전체 일정을 확인하세요.</p>
    </div>
  );

  const urgent  = items.filter((i: any) => i.urgency === 'urgent');
  const warning = items.filter((i: any) => i.urgency === 'warning');
  const normal  = items.filter((i: any) => i.urgency === 'normal');

  const Section = ({ title, items: list }: { title: string; items: any[] }) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{title}</h3>
        <div className="space-y-2">
          {list.map((item: any) => {
            const st = urgencyStyle[item.urgency as keyof typeof urgencyStyle];
            const Icon = categoryIcon[item.category as keyof typeof categoryIcon] ?? FileText;
            return (
              <Link key={item.id} href={item.actionUrl ?? '/tax-documents'}>
                <div className={clsx('flex items-center gap-3 p-4 rounded-xl border cursor-pointer hover:opacity-80 transition-opacity', st.row)}>
                  <div className={clsx('w-1 h-10 rounded-full flex-shrink-0', st.bar)} />
                  <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                    <p className="text-[11px] text-text-muted mt-1">마감: {item.dueDate}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-full', st.badge)}>
                      {item.daysLeft <= 0 ? '오늘' : `D-${item.daysLeft}`}
                    </span>
                    {item.actionLabel && (
                      <span className="text-[11px] text-primary-500 flex items-center gap-0.5">
                        {item.actionLabel} <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Section title="긴급 (D-3 이내)" items={urgent} />
      <Section title="주의 (D-7 이내)" items={warning} />
      <Section title="예정" items={normal} />
    </div>
  );
}

// ── 원천징수 탭 ───────────────────────────────────────
function WithholdingTab() {
  const now = new Date();
  const [year, setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const handlePrint = () => {
    const token = localStorage.getItem('accessToken') ?? '';
    const url = `/tax-documents/withholding-tax?year=${year}&month=${month}`;
    // 토큰을 쿼리스트링 대신 fetch로 HTML 받아서 새 창에 출력
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.text())
      .then((html) => {
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
      });
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-text-muted mb-4">
        급여 데이터를 기반으로 원천징수이행상황신고서를 자동 생성합니다.
        신고납부 기한은 <strong>매월 10일</strong>입니다.
      </p>
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-muted mb-1">연도</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          >
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-muted mb-1">월</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors"
      >
        <Printer className="h-4 w-4" />
        {year}년 {month}월 원천징수 서류 출력
      </button>
      <p className="text-[11px] text-text-muted mt-3">
        ※ 실제 신고는 홈택스(hometax.go.kr)에서 진행하세요.
      </p>
    </div>
  );
}

// ── 4대보험 탭 ────────────────────────────────────────
function InsuranceTab() {
  const [userId, setUserId] = useState('');
  const [formType, setFormType] = useState<'acquisition' | 'loss'>('acquisition');

  const { data: users = [] } = useQuery({
    queryKey: ['users-simple'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { limit: 100 } });
      return (data?.data?.users ?? data?.data ?? []) as any[];
    },
  });

  const handlePrint = () => {
    if (!userId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    const url = `/tax-documents/insurance-form/${userId}?type=${formType}`;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.text())
      .then((html) => {
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
      });
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-text-muted mb-4">
        직원 입·퇴사 시 4대보험 신고서 초안을 자동 생성합니다.
        <br />
        <span className="text-amber-600 font-medium">취득신고: 입사 14일 이내 / 상실신고: 퇴사 다음달 15일 이내</span>
      </p>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">신고 유형</label>
          <div className="flex gap-2">
            {(['acquisition', 'loss'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFormType(t)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  formType === t
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-text-muted border-border hover:border-primary-300',
                )}
              >
                {t === 'acquisition' ? '취득신고 (입사)' : '상실신고 (퇴사)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">직원 선택</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">직원을 선택하세요</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.department ? `(${u.department})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handlePrint}
        disabled={!userId}
        className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Printer className="h-4 w-4" />
        {formType === 'acquisition' ? '취득신고서' : '상실신고서'} 출력
      </button>
      <p className="text-[11px] text-text-muted mt-3">
        ※ 실제 신고는 4대사회보험 정보연계센터(4insure.or.kr)에서 진행하세요.
      </p>
    </div>
  );
}

// ── 연말정산 탭 ───────────────────────────────────────
function YearEndTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear() - 1);

  const handlePrint = () => {
    const token = localStorage.getItem('accessToken') ?? '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/tax-documents/year-end-summary?year=${year}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.text())
      .then((html) => {
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
      });
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-text-muted mb-4">
        직원별 연간 급여 합계 및 원천징수 내역을 자동 집계합니다.
        세무사에게 전달하거나 홈택스 신고 시 참고 자료로 활용하세요.
        <br />
        <span className="text-amber-600 font-medium">제출 기한: 다음해 3월 10일</span>
      </p>
      <div className="mb-6">
        <label className="block text-xs font-medium text-text-muted mb-1">귀속 연도</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
        >
          {[now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
            <option key={y} value={y}>{y}년 귀속</option>
          ))}
        </select>
      </div>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors"
      >
        <Printer className="h-4 w-4" />
        {year}년 연말정산 자료 출력
      </button>
      <p className="text-[11px] text-text-muted mt-3">
        ※ 의료비·교육비 등 추가 공제 항목은 직원 개인이 홈택스에서 별도 제출해야 합니다.
      </p>
    </div>
  );
}

// ── 퇴직금 탭 ─────────────────────────────────────────
function RetirementTab() {
  const [userId, setUserId] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users-simple'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { limit: 100 } });
      return (data?.data?.users ?? data?.data ?? []) as any[];
    },
  });

  const handlePrint = () => {
    if (!userId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/tax-documents/retirement-pay/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.text())
      .then((html) => {
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
      });
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-text-muted mb-4">
        입사일 및 최근 3개월 급여를 기준으로 퇴직금을 자동 계산합니다.
        <br />
        <span className="text-amber-600 font-medium">지급 기한: 퇴직일로부터 14일 이내</span>
      </p>
      <div className="mb-6">
        <label className="block text-xs font-medium text-text-muted mb-1">직원 선택</label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">직원을 선택하세요</option>
          {users.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.department ? `(${u.department})` : ''}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handlePrint}
        disabled={!userId}
        className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Printer className="h-4 w-4" />
        퇴직금 계산서 출력
      </button>
      <p className="text-[11px] text-text-muted mt-3">
        ※ 실제 퇴직금은 퇴직소득세가 별도 공제됩니다. 세무사 확인을 권장합니다.
      </p>
    </div>
  );
}

// ── 연간 캘린더 탭 ────────────────────────────────────
function AnnualCalendarTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const { data: schedules = [] } = useQuery({
    queryKey: ['tax-annual-calendar', year],
    queryFn: async () => {
      const { data } = await api.get(`/tax-documents/annual-calendar?year=${year}`);
      return (data?.data ?? data ?? []) as any[];
    },
  });

  const categoryColor: Record<string, string> = {
    tax:      'bg-blue-100 text-blue-700',
    insurance: 'bg-green-100 text-green-700',
    labor:    'bg-amber-100 text-amber-700',
  };
  const categoryLabel: Record<string, string> = {
    tax: '세금', insurance: '보험', labor: '노무',
  };

  const today = format(now, 'yyyy-MM-dd');

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-border rounded-lg px-3 py-1.5 text-sm"
        >
          {[now.getFullYear(), now.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <span className="text-xs text-text-muted">{schedules.length}개 일정</span>
      </div>
      <div className="space-y-2">
        {schedules.map((s: any) => {
          const isPast = s.date < today;
          const isThisMonth = s.date.startsWith(format(now, 'yyyy-MM'));
          return (
            <div
              key={s.id}
              className={clsx(
                'flex items-center gap-4 p-3.5 rounded-xl border transition-all',
                isPast ? 'opacity-40 bg-gray-50 border-gray-100' : isThisMonth ? 'border-amber-200 bg-amber-50' : 'border-border bg-white',
              )}
            >
              <div className="text-center w-12 flex-shrink-0">
                <p className="text-[11px] text-text-muted">{s.month}월</p>
                <p className="text-lg font-bold text-text-primary leading-none">{s.day}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{s.title}</p>
                <p className="text-[11px] text-text-muted truncate">{s.description}</p>
              </div>
              <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', categoryColor[s.category] ?? 'bg-gray-100 text-gray-600')}>
                {categoryLabel[s.category] ?? s.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────
export default function TaxDocumentsPage() {
  usePageTitle('세무·노무 서류');
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('할 일 목록');

  if (user?.role === 'employee') {
    return (
      <div className="page-container py-16 text-center">
        <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-text-muted">관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">세무·노무 서류</h1>
          <p className="text-sm text-text-muted mt-1">세무 마감 알림, 신고 서류 자동 생성, 연간 세무 캘린더</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="bg-white rounded-xl border border-border shadow-card p-4 md:p-6">
          {activeTab === '할 일 목록'  && <TodoTab />}
          {activeTab === '원천징수'    && <WithholdingTab />}
          {activeTab === '4대보험'     && <InsuranceTab />}
          {activeTab === '연말정산'    && <YearEndTab />}
          {activeTab === '퇴직금'      && <RetirementTab />}
          {activeTab === '연간 캘린더' && <AnnualCalendarTab />}
        </div>

        <p className="text-[11px] text-text-muted mt-4 text-center">
          ※ 이 서류들은 참고용 자료입니다. 실제 신고·납부는 홈택스 또는 담당 세무사를 통해 진행하세요.
        </p>
      </div>
    </div>
  );
}
