'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Feature {
  id: string;
  key: string;
  name: string;
  category: string;
  feature_type: 'boolean' | 'limit' | 'config';
  default_enabled: boolean;
  default_config: Record<string, unknown>;
  is_active: boolean;
}

interface PlanFeature {
  feature_id: string;
  feature_key: string;
  feature_name: string;
  feature_type: string;
  is_enabled: boolean;
  limit_value: number | null;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  core: '핵심', collaboration: '협업', ai: 'AI', analytics: '분석', admin: '관리', integration: '연동',
};

export default function FeaturesPage() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [tab, setTab] = useState<'global' | 'plan'>('plan');

  const { data: features } = useQuery({
    queryKey: ['admin-features'],
    queryFn: async () => {
      const res = await api.get('/features');
      return res.data.data as Feature[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data.data as Plan[];
    },
  });

  useEffect(() => {
    if (plans && plans.length > 0 && !selectedPlan) setSelectedPlan(plans[0].id);
  }, [plans, selectedPlan]);

  const { data: planFeatures, isLoading: pfLoading } = useQuery({
    queryKey: ['plan-features', selectedPlan],
    queryFn: async () => {
      if (!selectedPlan) return [];
      const res = await api.get(`/features/plans/${selectedPlan}`);
      return res.data.data as PlanFeature[];
    },
    enabled: !!selectedPlan,
  });

  const updatePlanFeatureMutation = useMutation({
    mutationFn: (updates: PlanFeature[]) =>
      api.put(`/features/plans/${selectedPlan}`, { features: updates }),
    onSuccess: () => {
      toast.success('플랜 기능 설정이 저장되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '저장에 실패했습니다.'),
  });

  const [localFeatures, setLocalFeatures] = useState<Record<string, { enabled: boolean; limit: string }>>({});

  const getEnabled = (pf: PlanFeature) =>
    localFeatures[pf.feature_id]?.enabled ?? pf.is_enabled;

  const getLimit = (pf: PlanFeature) =>
    localFeatures[pf.feature_id]?.limit ?? String(pf.limit_value ?? '');

  const handleToggle = (pf: PlanFeature, enabled: boolean) => {
    setLocalFeatures((prev) => ({
      ...prev,
      [pf.feature_id]: { enabled, limit: prev[pf.feature_id]?.limit ?? String(pf.limit_value ?? '') },
    }));
  };

  const handleLimit = (pf: PlanFeature, limit: string) => {
    setLocalFeatures((prev) => ({
      ...prev,
      [pf.feature_id]: { enabled: prev[pf.feature_id]?.enabled ?? pf.is_enabled, limit },
    }));
  };

  const handleSave = () => {
    if (!planFeatures) return;
    const updates = planFeatures.map((pf) => ({
      ...pf,
      is_enabled: getEnabled(pf),
      limit_value: pf.feature_type === 'limit' ? Number(getLimit(pf)) || null : pf.limit_value,
    }));
    updatePlanFeatureMutation.mutate(updates);
  };

  const grouped = (planFeatures ?? []).reduce((acc, pf) => {
    const feature = (features ?? []).find((f) => f.id === pf.feature_id);
    const cat = feature?.category ?? 'core';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(pf);
    return acc;
  }, {} as Record<string, PlanFeature[]>);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Feature Flags</h1>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['plan', 'global'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'plan' ? '플랜별 설정' : '전역 기본값'}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          {/* 플랜 선택 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">플랜 선택:</span>
            <div className="flex gap-1">
              {(plans ?? []).map((p) => (
                <button key={p.id} onClick={() => { setSelectedPlan(p.id); setLocalFeatures({}); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedPlan === p.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {p.display_name}
                </button>
              ))}
            </div>
            <button onClick={handleSave} disabled={updatePlanFeatureMutation.isPending}
              className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {updatePlanFeatureMutation.isPending ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>

          {pfLoading ? (
            <p className="text-center text-gray-400 py-8">불러오는 중...</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map((pf) => (
                      <div key={pf.feature_id} className="flex items-center px-4 py-3 gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{pf.feature_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{pf.feature_key}</p>
                        </div>
                        {pf.feature_type === 'boolean' && (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={getEnabled(pf)}
                              onChange={(e) => handleToggle(pf, e.target.checked)}
                              className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                          </label>
                        )}
                        {pf.feature_type === 'limit' && (
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={getEnabled(pf)}
                                onChange={(e) => handleToggle(pf, e.target.checked)}
                                className="sr-only peer" />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                            </label>
                            <input type="number" value={getLimit(pf)}
                              onChange={(e) => handleLimit(pf, e.target.value)}
                              disabled={!getEnabled(pf)}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                              placeholder="한도" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'global' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">기능 키</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">이름</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">카테고리</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">유형</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">기본값</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">활성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(features ?? []).map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.key}</td>
                  <td className="px-4 py-3 text-gray-800">{f.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{CATEGORY_LABEL[f.category] ?? f.category}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{f.feature_type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      f.default_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {f.default_enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      f.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {f.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
