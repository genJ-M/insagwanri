'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/admin/StatCard';
import { toast } from 'react-hot-toast';

interface VatPeriod {
  label: string;
  start: string;
  end: string;
}

interface TaxSummary {
  supply_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  refund_amount: number;
  refund_tax_amount: number;
  net_supply_amount: number;
  net_tax_amount: number;
  by_method: {
    card_corporate: { supply: number; tax: number; count: number };
    card_business: { supply: number; tax: number; count: number };
    card_personal: { supply: number; tax: number; count: number };
    bank_transfer: { supply: number; tax: number; count: number };
    tax_invoice: { supply: number; tax: number; count: number };
  };
}

interface MonthlyRow {
  year: number;
  month: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  refund_amount: number;
  count: number;
}

const VAT_PERIODS: VatPeriod[] = [
  { label: '2026 1기 예정 (1~3월)', start: '2026-01-01', end: '2026-03-31' },
  { label: '2026 1기 확정 (1~6월)', start: '2026-01-01', end: '2026-06-30' },
  { label: '2025 2기 확정 (7~12월)', start: '2025-07-01', end: '2025-12-31' },
];

function W(n: number) { return Math.round(n / 10000).toLocaleString() + '만'; }

export default function TaxPage() {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-03-31');

  const applyVatPeriod = (p: VatPeriod) => {
    setDateFrom(p.start);
    setDateTo(p.end);
  };

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['tax-summary', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/tax/summary?from=${dateFrom}&to=${dateTo}`);
      return res.data.data as TaxSummary;
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ['tax-monthly', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/tax/monthly?from=${dateFrom}&to=${dateTo}`);
      return res.data.data as MonthlyRow[];
    },
  });

  const handleExport = async (format: 'csv' | 'excel' | 'json') => {
    try {
      const res = await api.get(`/tax/export/${format}?from=${dateFrom}&to=${dateTo}`, {
        responseType: 'blob',
      });
      const ext = format === 'excel' ? 'xlsx' : format;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax_${dateFrom}_${dateTo}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  const bm = summary?.by_method;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">세무 데이터 관리</h1>

      {/* 기간 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {VAT_PERIODS.map((p) => (
            <button key={p.label} onClick={() => applyVatPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                dateFrom === p.start && dateTo === p.end
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400">~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleExport('csv')}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">CSV</button>
            <button onClick={() => handleExport('excel')}
              className="px-3 py-1.5 text-sm border border-green-300 rounded-lg hover:bg-green-50 text-green-700">Excel</button>
            <button onClick={() => handleExport('json')}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">JSON</button>
          </div>
        </div>
      </div>

      {/* 부가세 요약 */}
      {sumLoading ? (
        <p className="text-center text-gray-400 py-8">불러오는 중...</p>
      ) : summary && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="공급가액 합계" value={`${W(summary.supply_amount)}원`} color="blue" />
            <StatCard label="매출세액" value={`${W(summary.tax_amount)}원`} color="purple" />
            <StatCard label="환입 공급가액" value={`${W(summary.refund_amount)}원`} color="orange" />
            <StatCard label="순 납부세액" value={`${W(summary.net_tax_amount)}원`} color="green" />
          </div>

          {/* 유형별 분류표 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">과세 유형별 분류</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">구분</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">건수</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">공급가액</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">세액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bm && [
                  { label: '세금계산서', data: bm.tax_invoice },
                  { label: '법인카드', data: bm.card_corporate },
                  { label: '사업자카드', data: bm.card_business },
                  { label: '개인카드', data: bm.card_personal },
                  { label: '계좌이체', data: bm.bank_transfer },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{row.label}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.data.count.toLocaleString()}건</td>
                    <td className="px-4 py-3 text-right text-gray-900">{Number(row.data.supply).toLocaleString()}원</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Number(row.data.tax).toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-gray-900">합계</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">—</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {Number(summary.supply_amount).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {Number(summary.tax_amount).toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* 월별 집계 */}
      {monthly && monthly.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">월별 매출 집계</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">연월</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">건수</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">공급가액</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">세액</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">합계</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">환불</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthly.map((m) => (
                <tr key={`${m.year}-${m.month}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.year}년 {m.month}월</td>
                  <td className="px-4 py-3 text-right text-gray-600">{m.count.toLocaleString()}건</td>
                  <td className="px-4 py-3 text-right text-gray-700">{Number(m.supply_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(m.tax_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(m.total_amount).toLocaleString()}원</td>
                  <td className="px-4 py-3 text-right text-orange-600">{Number(m.refund_amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
