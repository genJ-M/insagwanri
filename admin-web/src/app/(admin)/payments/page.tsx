'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/admin/StatCard';
import StatusBadge from '@/components/admin/StatusBadge';
import { toast } from 'react-hot-toast';

interface Payment {
  id: string;
  invoice_number: string;
  company_name: string;
  status: string;
  supply_amount_krw: number;
  tax_amount_krw: number;
  total_amount_krw: number;
  method_type: string;
  card_type: string | null;
  tax_invoice_issued: boolean;
  billing_period_start: string;
  billing_period_end: string;
  paid_at: string | null;
}

interface PaymentStats {
  collected_krw: number;
  tax_invoice_count: number;
  failed_count: number;
  refunded_krw: number;
  success_rate: number;
}

const DATE_SHORTCUTS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
];

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [methodType, setMethodType] = useState('');
  const [cardType, setCardType] = useState('');
  const [taxInvoice, setTaxInvoice] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(dateStr(30));
  const [dateTo, setDateTo] = useState(dateStr(0));
  const [page, setPage] = useState(1);
  const [refundModal, setRefundModal] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['payment-stats', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/payments/stats?from=${dateFrom}&to=${dateTo}`);
      return res.data.data as PaymentStats;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', methodType, cardType, taxInvoice, status, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(methodType && { methodType }),
        ...(cardType && { cardType }),
        ...(taxInvoice && { taxInvoice }),
        ...(status && { status }),
        from: dateFrom,
        to: dateTo,
        page: String(page),
        limit: '20',
      });
      const res = await api.get(`/payments?${params}`);
      return res.data as { data: Payment[]; meta: { total: number; totalPages: number } };
    },
    placeholderData: (prev) => prev,
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason: string }) =>
      api.post(`/payments/${id}/refund`, { amount, reason }),
    onSuccess: () => {
      toast.success('환불이 처리되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      setRefundModal(null);
      setRefundAmount('');
      setRefundReason('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '환불 처리에 실패했습니다.'),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/reissue-tax-invoice`),
    onSuccess: () => {
      toast.success('세금계산서가 재발행되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '재발행에 실패했습니다.'),
  });

  const applyDateShortcut = (days: number) => {
    setDateTo(dateStr(0));
    setDateFrom(days === 0 ? dateStr(0) : dateStr(days));
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">결제 관리</h1>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="수납액" value={`${Math.round(stats.collected_krw / 10000).toLocaleString()}만원`} color="green" />
          <StatCard label="세금계산서 발행" value={`${stats.tax_invoice_count.toLocaleString()}건`} color="blue" />
          <StatCard label="결제 실패" value={`${stats.failed_count.toLocaleString()}건`} color="red" />
          <StatCard label="환불액" value={`${Math.round(stats.refunded_krw / 10000).toLocaleString()}만원`} color="orange" />
          <StatCard label="성공률" value={`${stats.success_rate.toFixed(1)}%`} color="purple" />
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          {/* 결제 방식 토글 */}
          <div className="flex gap-1">
            {[{ v: '', l: '전체' }, { v: 'card', l: '카드' }, { v: 'bank_transfer', l: '계좌이체' }].map((o) => (
              <button key={o.v}
                onClick={() => { setMethodType(o.v); setCardType(''); setPage(1); }}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  methodType === o.v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{o.l}</button>
            ))}
          </div>

          {/* 카드 유형 (카드 선택 시만) */}
          {methodType === 'card' && (
            <div className="flex gap-1">
              {[{ v: '', l: '유형전체' }, { v: 'corporate', l: '법인' }, { v: 'business', l: '사업자' }, { v: 'personal', l: '개인' }].map((o) => (
                <button key={o.v}
                  onClick={() => { setCardType(o.v); setPage(1); }}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    cardType === o.v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >{o.l}</button>
              ))}
            </div>
          )}

          {/* 세금계산서 토글 */}
          <div className="flex gap-1">
            {[{ v: '', l: '전체' }, { v: 'issued', l: '발행' }, { v: 'not_issued', l: '미발행' }, { v: 'na', l: '해당없음' }].map((o) => (
              <button key={o.v}
                onClick={() => { setTaxInvoice(o.v); setPage(1); }}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  taxInvoice === o.v ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{o.l}</button>
            ))}
          </div>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">결제상태 전체</option>
            <option value="completed">완료</option>
            <option value="failed">실패</option>
            <option value="refunded">환불</option>
            <option value="partial_refunded">부분환불</option>
            <option value="pending">대기</option>
          </select>
        </div>

        {/* 기간 */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1">
            {DATE_SHORTCUTS.map((s) => (
              <button key={s.label} onClick={() => applyDateShortcut(s.days)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">
                {s.label}
              </button>
            ))}
          </div>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">인보이스</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">회사</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">공급가액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">세액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">합계</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">수단</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">세금계산서</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">결제일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">데이터가 없습니다.</td></tr>
            ) : (
              (data?.data ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.invoice_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.company_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {Number(p.supply_amount_krw).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {Number(p.tax_amount_krw).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(p.total_amount_krw).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.method_type} />
                    {p.card_type && <StatusBadge status={p.card_type} />}
                  </td>
                  <td className="px-4 py-3">
                    {p.tax_invoice_issued
                      ? <span className="text-xs text-green-600 font-medium">✓ 발행</span>
                      : <span className="text-xs text-gray-400">미발행</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {p.status === 'completed' && (
                        <button onClick={() => { setRefundModal(p); setRefundAmount(String(p.total_amount_krw)); }}
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium">환불</button>
                      )}
                      {p.status === 'completed' && !p.tax_invoice_issued && (
                        <button onClick={() => reissueMutation.mutate(p.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium">세금계산서</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">총 {data.meta.total.toLocaleString()}건</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">이전</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 환불 모달 */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">환불 처리</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{refundModal.company_name}</strong> / {refundModal.invoice_number}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              최대 환불 가능: {Number(refundModal.total_amount_krw).toLocaleString()}원
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">환불 금액 (원)</label>
                <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  max={refundModal.total_amount_krw}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">환불 사유</label>
                <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                  rows={2} placeholder="환불 사유를 입력해 주세요"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRefundModal(null); setRefundReason(''); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button
                onClick={() => refundMutation.mutate({ id: refundModal.id, amount: Number(refundAmount), reason: refundReason })}
                disabled={!refundAmount || !refundReason || refundMutation.isPending}
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {refundMutation.isPending ? '처리 중...' : '환불 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
