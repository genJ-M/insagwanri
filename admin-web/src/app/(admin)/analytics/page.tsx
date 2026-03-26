'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/admin/StatCard';

// ── 타입 ──────────────────────────────────────────────
interface UsageStats {
  active_tenants: number;
  total_employees: number;
  ai_requests_today: number;
  plan_distribution: Array<{ plan_name: string; plan_display_name: string; count: number; percentage: number }>;
  near_limit_companies: Array<{
    id: string; name: string; plan_name: string;
    employee_count: number; max_employees: number; employee_usage_pct: number;
    ai_usage_today: number; ai_limit: number; ai_usage_pct: number;
  }>;
}
interface RealtimeStats {
  as_of: string; dau: number; active_companies_today: number;
  currently_working: number; new_companies_today: number; api_calls_last_hour: number;
  subscriptions: { active: number; past_due: number; trialing: number };
}
interface FunnelStage { stage: string; label: string; count: number; rate: number }

// ── 공통 UI ───────────────────────────────────────────
function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium w-9 text-right ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-orange-500' : 'text-gray-600'}`}>
        {pct}%
      </span>
    </div>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
type Tab = 'usage' | 'realtime' | 'funnel';

// ── 탭: 사용량 ────────────────────────────────────────
function UsageTab() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { data, isLoading } = useQuery({
    queryKey: ['usage-analytics', year, month],
    queryFn: async () => (await api.get(`/analytics/usage?year=${year}&month=${month}`)).data.data as UsageStats,
  });

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[CURRENT_YEAR, CURRENT_YEAR - 1].map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-center text-gray-400 py-12">불러오는 중...</p> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="활성 테넌트" value={data.active_tenants.toLocaleString()} color="blue" />
            <StatCard label="전체 직원 수" value={data.total_employees.toLocaleString()} color="green" />
            <StatCard label="오늘 AI 요청" value={data.ai_requests_today.toLocaleString()} color="purple" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">플랜 분포</h2>
            <div className="space-y-3">
              {data.plan_distribution.map((p) => (
                <div key={p.plan_name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{p.plan_display_name}</span>
                    <span className="text-gray-500">{p.count.toLocaleString()}개 ({p.percentage}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {data.near_limit_companies.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <h2 className="font-semibold text-gray-800">한도 70% 이상 도달 회사</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">회사</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">플랜</th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 min-w-[160px]">직원 사용률</th>
                    <th className="px-4 py-2.5 font-medium text-gray-500 min-w-[160px]">AI 사용률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.near_limit_companies.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.plan_name}</td>
                      <td className="px-4 py-3"><div className="space-y-0.5"><p className="text-xs text-gray-500">{c.employee_count} / {c.max_employees}명</p><UsageBar pct={c.employee_usage_pct} /></div></td>
                      <td className="px-4 py-3"><div className="space-y-0.5"><p className="text-xs text-gray-500">{c.ai_usage_today} / {c.ai_limit}회</p><UsageBar pct={c.ai_usage_pct} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── 탭: 실시간 ────────────────────────────────────────
function RealtimeTab() {
  const { data, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['analytics-realtime'],
    queryFn: async () => (await api.get('/analytics/realtime')).data.data as RealtimeStats,
    refetchInterval: 30_000, // 30초 자동 갱신
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {dataUpdatedAt ? `마지막 업데이트: ${new Date(dataUpdatedAt).toLocaleTimeString('ko-KR')}` : ''}
        </p>
        <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">새로고침</button>
      </div>
      {isLoading ? <p className="text-center text-gray-400 py-12">불러오는 중...</p> : data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="오늘 DAU" value={data.dau.toLocaleString()} color="blue" />
            <StatCard label="현재 출근 중" value={data.currently_working.toLocaleString()} color="green" />
            <StatCard label="오늘 신규 가입" value={data.new_companies_today.toLocaleString()} color="purple" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">구독 현황</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-gray-600">활성</span><span className="font-semibold text-green-600">{data.subscriptions.active.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">체험 중</span><span className="font-semibold text-blue-600">{data.subscriptions.trialing.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">연체</span><span className="font-semibold text-red-600">{data.subscriptions.past_due.toLocaleString()}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">API 부하</h2>
              <div className="text-3xl font-bold text-gray-900">{data.api_calls_last_hour.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">AI 요청 (최근 1시간)</div>
              <div className="mt-3 text-sm text-gray-600">오늘 활성 회사: <span className="font-semibold text-blue-600">{data.active_companies_today.toLocaleString()}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 탭: 온보딩 퍼널 ───────────────────────────────────
function FunnelTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: async () => (await api.get('/analytics/funnel')).data.data as { stages: FunnelStage[] },
  });

  return (
    <div className="space-y-6">
      {isLoading ? <p className="text-center text-gray-400 py-12">불러오는 중...</p> : data && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-6">가입 → 결제 전환 퍼널</h2>
          <div className="space-y-4">
            {data.stages.map((stage, i) => (
              <div key={stage.stage} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{stage.count.toLocaleString()}개사</span>
                    <span className="text-xs text-gray-400 ml-2">({stage.rate}%)</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stage.rate}%`,
                      backgroundColor: `hsl(${220 - i * 20}, 70%, ${50 + i * 5}%)`,
                    }}
                  />
                </div>
                {i < data.stages.length - 1 && (
                  <div className="text-xs text-gray-400 text-right mt-0.5">
                    다음 단계 이탈: {data.stages[i].count - data.stages[i + 1].count}개사
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('usage');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'usage', label: '사용량' },
    { key: 'realtime', label: '실시간' },
    { key: 'funnel', label: '온보딩 퍼널' },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">서비스 분석</h1>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usage' && <UsageTab />}
      {tab === 'realtime' && <RealtimeTab />}
      {tab === 'funnel' && <FunnelTab />}
    </div>
  );
}
