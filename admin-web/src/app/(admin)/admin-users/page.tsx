'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatusBadge from '@/components/admin/StatusBadge';
import { toast } from 'react-hot-toast';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_OPTS = [
  { value: 'super_admin', label: 'SUPER_ADMIN' },
  { value: 'operations', label: 'OPERATIONS' },
  { value: 'billing', label: 'BILLING' },
  { value: 'support', label: 'SUPPORT' },
  { value: 'readonly', label: 'READONLY' },
];

const ROLE_COLOR: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  operations:  'bg-orange-100 text-orange-700',
  billing:     'bg-blue-100 text-blue-700',
  support:     'bg-teal-100 text-teal-700',
  readonly:    'bg-gray-100 text-gray-600',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'readonly', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin-users');
      return res.data.data as AdminUser[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/admin-users', body),
    onSuccess: () => {
      toast.success('운영자 계정이 생성되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowModal(false);
      setForm({ email: '', name: '', role: 'readonly', password: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '생성에 실패했습니다.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin-users/${id}`, { isActive: false }),
    onSuccess: () => {
      toast.success('계정이 비활성화되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '처리에 실패했습니다.'),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">운영자 관리</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 운영자 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">이메일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">역할</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">MFA</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">최근 로그인</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : (data ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.totp_enabled
                    ? <span className="text-xs text-green-600 font-medium">✓ 설정됨</span>
                    : <span className="text-xs text-red-500">미설정</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.is_active ? 'active' : 'suspended'} label={u.is_active ? '활성' : '비활성'} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ko-KR') : '없음'}
                </td>
                <td className="px-4 py-3">
                  {u.is_active && (
                    <button onClick={() => {
                      if (confirm(`${u.name} 계정을 비활성화하시겠습니까?`)) deactivateMutation.mutate(u.id);
                    }} className="text-xs text-red-600 hover:text-red-700 font-medium">비활성화</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 운영자 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">운영자 계정 생성</h3>
            <div className="space-y-3">
              {[
                { label: '이름 *', key: 'name', type: 'text', placeholder: '홍길동' },
                { label: '이메일 *', key: 'email', type: 'email', placeholder: 'admin@example.com' },
                { label: '초기 비밀번호 *', key: 'password', type: 'password', placeholder: '8자 이상' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  <input type={field.type} placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">역할 *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-700">
              ⚠️ 생성 후 초대 이메일이 발송됩니다. SUPER_ADMIN은 MFA 설정 후 로그인 가능합니다.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}
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
