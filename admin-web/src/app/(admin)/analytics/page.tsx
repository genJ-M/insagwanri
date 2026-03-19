'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/admin/StatCard';

interface UsageStats {
  active_tenants: number;
  total_employees: number;
  ai_requests_today: number;
  plan_distribution: Array<{ plan_name: string; plan_display_name: string; count: number; percentage: number }>;
  near_limit_companies: Array<{
    id: string;
    name: string;
    plan_name: string;
    employee_count: number;
    max_employees: number;
    employee_usage_pct: number;
    ai_usage_today: number;
    ai_limit: number;
    ai_usage_pct: number;
  }>;
}

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

export default function AnalyticsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['usage-analytics', year, month],
    queryFn: async () => {
      const res = await api.get(`/analytics/usage?year=${year}&month=${month}`);
      return res.data.data as UsageStats;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">서비스 사용량 분석</h1>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[CURRENT_YEAR, CURRENT_YEAR - 1].map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : data && (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="활성 테넌트" value={data.active_tenants.toLocaleString()} color="blue" />
            <StatCard label="전체 직원 수" value={data.total_employees.toLocaleString()} color="green" />
            <StatCard label="오늘 AI 요청" value={data.ai_requests_today.toLocaleString()} color="purple" />
          </div>

          {/* 플랜 분포 */}
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

          {/* 한도 임박 회사 목록 */}
          {data.near_limit_companies.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <h2 className="font-semibold text-gray-800">한도 80% 이상 도달 회사</h2>
                <span className="text-xs text-orange-600 ml-1">업그레이드 안내 검토 필요</span>
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
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-500">{c.employee_count} / {c.max_employees}명</p>
                          <UsageBar pct={c.employee_usage_pct} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-500">{c.ai_usage_today} / {c.ai_limit}회</p>
                          <UsageBar pct={c.ai_usage_pct} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
