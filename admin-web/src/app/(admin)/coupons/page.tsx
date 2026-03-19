'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatusBadge from '@/components/admin/StatusBadge';
import { toast } from 'react-hot-toast';

interface Coupon {
  id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount_krw: number | null;
  current_total_uses: number;
  max_total_uses: number | null;
  is_active: boolean;
  is_public: boolean;
  valid_until: string | null;
  created_at: string;
}

interface CreateCouponForm {
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  max_discount_amount_krw: string;
  max_total_uses: string;
  valid_until: string;
}

const EMPTY_FORM: CreateCouponForm = {
  code: '', name: '', discount_type: 'percentage',
  discount_value: '', max_discount_amount_krw: '', max_total_uses: '', valid_until: '',
};

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateCouponForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coupons', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?isActive=${filter === 'active'}` : '';
      const res = await api.get(`/coupons${params}`);
      return res.data.data as Coupon[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/coupons', body),
    onSuccess: () => {
      toast.success('쿠폰이 생성되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '생성에 실패했습니다.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      toast.success('쿠폰이 비활성화되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '처리에 실패했습니다.'),
  });

  const handleCreate = () => {
    if (!form.code || !form.name || !form.discount_value) {
      return toast.error('필수 항목을 입력해 주세요.');
    }
    createMutation.mutate({
      code: form.code.toUpperCase(),
      name: form.name,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      ...(form.max_discount_amount_krw && { max_discount_amount_krw: Number(form.max_discount_amount_krw) }),
      ...(form.max_total_uses && { max_total_uses: Number(form.max_total_uses) }),
      ...(form.valid_until && { valid_until: form.valid_until }),
    });
  };

  const usagePercent = (c: Coupon) =>
    c.max_total_uses ? Math.min(100, Math.round((c.current_total_uses / c.max_total_uses) * 100)) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">쿠폰 관리</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 쿠폰 생성
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {f === 'all' ? '전체' : f === 'active' ? '활성' : '비활성'}
          </button>
        ))}
      </div>

      {/* 쿠폰 카드 그리드 */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-12">불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(data ?? []).map((c) => {
            const pct = usagePercent(c);
            return (
              <div key={c.id} className={`bg-white rounded-xl border p-5 space-y-3 ${!c.is_active ? 'opacity-60' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 font-mono text-base">{c.code}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{c.name}</p>
                  </div>
                  <StatusBadge status={c.is_active ? 'active' : 'canceled'} label={c.is_active ? '활성' : '비활성'} />
                </div>

                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-blue-700">
                    {c.discount_type === 'percentage'
                      ? `${c.discount_value}% 할인`
                      : `${Number(c.discount_value).toLocaleString()}원 할인`}
                  </p>
                  {c.max_discount_amount_krw && (
                    <p className="text-xs text-blue-600">최대 {Number(c.max_discount_amount_krw).toLocaleString()}원</p>
                  )}
                </div>

                {/* 사용량 */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>사용 횟수</span>
                    <span>{c.current_total_uses}{c.max_total_uses ? ` / ${c.max_total_uses}` : ''}회</span>
                  </div>
                  {pct !== null && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{c.valid_until ? `~${new Date(c.valid_until).toLocaleDateString('ko-KR')}` : '기간 무제한'}</span>
                  {c.is_active && (
                    <button onClick={() => {
                      if (confirm('쿠폰을 비활성화하시겠습니까?')) deactivateMutation.mutate(c.id);
                    }} className="text-red-500 hover:text-red-600 font-medium">비활성화</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 쿠폰 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">쿠폰 생성</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">쿠폰 코드 *</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2026"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">쿠폰 이름 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="여름 특별 할인"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">할인 유형</label>
                <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="percentage">퍼센트</option>
                  <option value="fixed">정액</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  할인 값 ({form.discount_type === 'percentage' ? '%' : '원'}) *
                </label>
                <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'percentage' ? '20' : '10000'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {form.discount_type === 'percentage' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">최대 할인액 (원)</label>
                  <input type="number" value={form.max_discount_amount_krw}
                    onChange={(e) => setForm({ ...form, max_discount_amount_krw: e.target.value })}
                    placeholder="50000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">최대 사용 횟수</label>
                <input type="number" value={form.max_total_uses} onChange={(e) => setForm({ ...form, max_total_uses: e.target.value })}
                  placeholder="100 (빈칸=무제한)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className={form.discount_type === 'percentage' ? '' : 'col-span-2'}>
                <label className="block text-xs font-medium text-gray-500 mb-1">유효 기간</label>
                <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} disabled={createMutation.isPending}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
