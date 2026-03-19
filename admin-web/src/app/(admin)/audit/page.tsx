'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AuditLog {
  id: string;
  admin_user_name: string;
  admin_user_email: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  ip_address: string;
  created_at: string;
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', action, targetType, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(action && { action }),
        ...(targetType && { targetType }),
        page: String(page),
        limit: '30',
      });
      const res = await api.get(`/audit-logs?${params}`);
      return res.data as { data: AuditLog[]; meta: { total: number; totalPages: number } };
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">감사 로그</h1>

      {/* 필터 */}
      <div className="flex gap-3">
        <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
          placeholder="액션 검색 (예: company.suspend)"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">대상 전체</option>
          <option value="company">회사</option>
          <option value="subscription">구독</option>
          <option value="payment">결제</option>
          <option value="coupon">쿠폰</option>
          <option value="plan">플랜</option>
          <option value="admin_user">운영자</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">시각</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">운영자</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">대상</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">사유</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">로그가 없습니다.</td></tr>
            ) : (
              (data?.data ?? []).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{log.admin_user_name}</p>
                    <p className="text-xs text-gray-400">{log.admin_user_email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 bg-blue-50 rounded px-2">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <span className="font-medium">{log.target_type}</span>
                    <span className="text-gray-400 ml-1">#{log.target_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                    {log.reason ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{log.ip_address}</td>
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
    </div>
  );
}
