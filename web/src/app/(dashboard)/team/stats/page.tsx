'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, TrendingUp, Building2, UserCheck } from 'lucide-react';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface OrgStats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { name: string; count: number }[];
  byRole: { role: string; count: number }[];
  byPosition: { name: string; count: number }[];
  monthlyJoin: { month: string; count: number }[];
}

// ─── 색상 팔레트 ─────────────────────────────────────────────────────────────

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const ROLE_LABEL: Record<string, string> = {
  owner: '오너', manager: '매니저', employee: '직원',
};

// ─── 카드 컴포넌트 ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}명</p>
      ))}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function OrgStatsPage() {
  const { data, isLoading, error } = useQuery<OrgStats>({
    queryKey: ['org-stats'],
    queryFn: () => api.get('/users/org-stats').then(r => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>통계 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-blue-600" />
          조직 통계
        </h1>
        <p className="text-sm text-gray-500 mt-1">조직 현황과 인원 분포를 한눈에 파악합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="전체 직원"
          value={data.total}
          sub="등록 인원"
          color="bg-blue-500"
        />
        <StatCard
          icon={UserCheck}
          label="재직 중"
          value={data.active}
          sub={`활성 ${Math.round((data.active / data.total) * 100)}%`}
          color="bg-green-500"
        />
        <StatCard
          icon={Building2}
          label="부서 수"
          value={data.byDepartment.length}
          sub="운영 부서"
          color="bg-purple-500"
        />
        <StatCard
          icon={TrendingUp}
          label="이번 달 입사"
          value={data.monthlyJoin[data.monthlyJoin.length - 1]?.count ?? 0}
          sub="신규 입사자"
          color="bg-amber-500"
        />
      </div>

      {/* 부서별 + 역할별 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 부서별 인원 — 가로 막대 차트 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">부서별 인원</h2>
          {data.byDepartment.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, data.byDepartment.length * 44)}>
              <BarChart
                data={data.byDepartment}
                layout="vertical"
                margin={{ left: 16, right: 32, top: 4, bottom: 4 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="인원" radius={[0, 4, 4, 0]}>
                  {data.byDepartment.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 역할별 인원 — 파이 차트 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">역할별 인원</h2>
          {data.byRole.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={data.byRole.map(r => ({ ...r, name: ROLE_LABEL[r.role] ?? r.role }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    {data.byRole.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v}명`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data.byRole.map((r, i) => (
                  <div key={r.role} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600">{ROLE_LABEL[r.role] ?? r.role}</span>
                    <span className="font-semibold text-gray-900">{r.count}명</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 월별 입사자 추이 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">월별 입사자 추이 (최근 12개월)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.monthlyJoin} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="bg-white border border-gray-100 rounded-lg shadow-md px-3 py-2 text-sm">
                    <p className="font-medium text-gray-700">{label}</p>
                    <p className="text-blue-600">{payload[0].value}명 입사</p>
                  </div>
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              name="입사자"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 직급별 인원 (상위 10) */}
      {data.byPosition.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">직급별 인원 (상위 10)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byPosition} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="인원" radius={[4, 4, 0, 0]}>
                {data.byPosition.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
