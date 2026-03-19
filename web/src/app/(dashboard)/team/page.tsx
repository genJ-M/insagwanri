'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, MoreVertical, Mail, Clock, Shield, User, RefreshCw, X, Check } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type TabType = 'all' | 'manager' | 'employee' | 'invites';

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-in slide-in-from-bottom-4">
      <Check className="h-4 w-4 text-green-400" />
      {message}
    </div>
  );
}

const ROLE_KO: Record<string, string> = {
  owner: '대표', manager: '관리자', employee: '직원',
};
const ROLE_COLOR: Record<string, string> = {
  owner:    'bg-purple-100 text-purple-700',
  manager:  'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-600',
};
const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-700',
  pending:  'bg-yellow-100 text-yellow-700',
};

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', role: 'employee' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: any) => api.post('/users/invite', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      onClose();
      setForm({ email: '', role: 'employee' });
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '초대에 실패했습니다.'),
  });

  return (
    <Modal open={open} onClose={onClose} title="직원 초대">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
          <input
            type="email"
            placeholder="employee@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">역할</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="employee">직원</option>
            <option value="manager">관리자</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            loading={mutation.isPending}
            disabled={!form.email || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            초대 발송
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type ConfirmState = { open: boolean; title: string; desc: string; onConfirm: () => void };
const CONFIRM_INIT: ConfirmState = { open: false, title: '', desc: '', onConfirm: () => {} };

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  if (!state.open) return null;
  return (
    <Modal open={state.open} onClose={onClose} title={state.title}>
      <p className="text-sm text-gray-600 mb-5">{state.desc}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button onClick={() => { state.onConfirm(); onClose(); }}>확인</Button>
      </div>
    </Modal>
  );
}

function UserActionMenu({
  userId, role, currentUserRole, currentUserId, onClose, onToast, onConfirm,
}: {
  userId: string; role: string; currentUserRole: string;
  currentUserId: string; onClose: () => void; onToast: (msg: string) => void;
  onConfirm: (s: ConfirmState) => void;
}) {
  const queryClient = useQueryClient();

  const roleChangeMutation = useMutation({
    mutationFn: (newRole: string) => api.patch(`/users/${userId}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      onClose();
      onToast('역할이 변경되었습니다.');
    },
    onError: () => onToast('역할 변경에 실패했습니다.'),
  });
  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      onClose();
      onToast('직원이 비활성화되었습니다.');
    },
    onError: () => onToast('비활성화에 실패했습니다.'),
  });

  if (currentUserRole !== 'owner' || userId === currentUserId || role === 'owner') return null;

  const handleRoleChange = (newRole: string) => {
    const label = newRole === 'manager' ? '관리자' : '직원';
    onConfirm({
      open: true,
      title: '역할 변경',
      desc: `이 직원을 ${label}(으)로 변경하시겠습니까?`,
      onConfirm: () => roleChangeMutation.mutate(newRole),
    });
    onClose();
  };

  return (
    <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40">
      {role === 'employee' && (
        <button
          onClick={() => handleRoleChange('manager')}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <Shield className="h-4 w-4 text-blue-500" /> 관리자로 변경
        </button>
      )}
      {role === 'manager' && (
        <button
          onClick={() => handleRoleChange('employee')}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <User className="h-4 w-4 text-gray-500" /> 직원으로 변경
        </button>
      )}
      <hr className="my-1" />
      <button
        onClick={() => {
          onConfirm({
            open: true,
            title: '직원 비활성화',
            desc: '이 직원을 비활성화하시겠습니까? 비활성화된 직원은 로그인할 수 없습니다.',
            onConfirm: () => deactivateMutation.mutate(),
          });
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        비활성화
      </button>
    </div>
  );
}

export default function TeamPage() {
  usePageTitle('팀 관리');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_INIT);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.data ?? data;
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: async () => {
      const { data } = await api.get('/users/invites');
      return data.data ?? data;
    },
    enabled: user?.role !== 'employee',
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/invites/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invites'] }); showToast('초대가 취소되었습니다.'); },
    onError: () => showToast('초대 취소에 실패했습니다.'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/invites/${id}/resend`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invites'] }); showToast('초대 이메일을 재발송했습니다.'); },
    onError: () => showToast('재발송에 실패했습니다.'),
  });

  const searchLower = search.toLowerCase();
  const filtered = members.filter((m: any) => {
    if (tab === 'manager'  && m.role !== 'manager')  return false;
    if (tab === 'employee' && m.role !== 'employee') return false;
    if (searchLower && !m.name.toLowerCase().includes(searchLower) && !m.email.toLowerCase().includes(searchLower)) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'all',      label: '전체',         count: members.length },
    { key: 'manager',  label: '관리자',        count: members.filter((m: any) => m.role === 'manager').length },
    { key: 'employee', label: '직원',          count: members.filter((m: any) => m.role === 'employee').length },
    { key: 'invites',  label: '초대 대기 중',   count: invites.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto" onClick={() => setOpenMenu(null)}>
      <Header title="팀 관리" />

      <main className="p-6 space-y-4">
        {/* 상단 액션 */}
        <div className="flex items-center justify-between">
          <input
            type="text"
            placeholder="이름, 이메일 검색"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          {user?.role !== 'employee' && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              직원 초대
            </Button>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
              {t.count != null && (
                <span className={clsx(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500',
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 직원 테이블 */}
        {tab !== 'invites' && (
          <Card>
            {isLoading ? (
              <SkeletonTableRows count={5} />
            ) : paginated.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">직원이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['이름', '부서 / 직책', '역할', '상태', '마지막 로그인', ''].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((m: any) => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{m.name}</p>
                              <p className="text-xs text-gray-400">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {[m.department, m.position].filter(Boolean).join(' · ') || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', ROLE_COLOR[m.role])}>
                            {ROLE_KO[m.role]}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLOR[m.status])}>
                            {m.status === 'active' ? '재직' : m.status === 'inactive' ? '비활성' : '대기'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {m.lastLoginAt
                            ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true, locale: ko })
                            : '없음'}
                        </td>
                        <td className="py-3 px-4 relative" onClick={(e) => e.stopPropagation()}>
                          {user?.role === 'owner' && m.role !== 'owner' && (
                            <button
                              onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          {openMenu === m.id && (
                            <UserActionMenu
                              userId={m.id}
                              role={m.role}
                              currentUserRole={user?.role ?? ''}
                              currentUserId={user?.id ?? ''}
                              onClose={() => setOpenMenu(null)}
                              onToast={showToast}
                              onConfirm={setConfirm}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* 페이지네이션 */}
        {tab !== 'invites' && totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {filtered.length}명 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}명 표시
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-sm',
                    p === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* 초대 대기 목록 */}
        {tab === 'invites' && (
          <Card>
            {invites.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">대기 중인 초대가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {invites.map((inv: any) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  return (
                  <div key={inv.id} className={clsx('flex items-center gap-4 py-3.5 px-4', expired && 'opacity-60')}>
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                        {expired && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                            만료됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className={clsx('mr-2 font-medium', ROLE_COLOR[inv.role] + ' px-1.5 py-0.5 rounded-full')}>
                          {ROLE_KO[inv.role]}
                        </span>
                        {expired ? '만료: ' : '만료 예정: '}{format(new Date(inv.expiresAt), 'M월 d일 HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => resendInviteMutation.mutate(inv.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        title="재발송"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => cancelInviteMutation.mutate(inv.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"
                        title="취소"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </main>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_INIT)} />
      <Toast message={toastMsg} />
    </div>
  );
}
