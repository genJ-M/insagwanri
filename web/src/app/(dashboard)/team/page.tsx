'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { UserPlus, MoreVertical, Mail, Shield, User, RefreshCw, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import Badge, { ROLE_BADGE, ROLE_LABEL } from '@/components/ui/Badge';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

type TabType = 'all' | 'manager' | 'employee' | 'invites';

const STATUS_BADGE: Record<string, 'green' | 'red' | 'yellow'> = {
  active: 'green', inactive: 'red', pending: 'yellow',
};
const STATUS_LABEL: Record<string, string> = {
  active: '재직', inactive: '비활성', pending: '대기',
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
          <label className="label">이메일</label>
          <input
            type="email"
            placeholder="employee@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">역할</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input"
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
      <p className="text-sm text-text-secondary mb-5">{state.desc}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button onClick={() => { state.onConfirm(); onClose(); }}>확인</Button>
      </div>
    </Modal>
  );
}

function UserActionMenu({
  userId, role, currentUserRole, currentUserId, onClose, onConfirm,
}: {
  userId: string; role: string; currentUserRole: string;
  currentUserId: string; onClose: () => void;
  onConfirm: (s: ConfirmState) => void;
}) {
  const queryClient = useQueryClient();

  const roleChangeMutation = useMutation({
    mutationFn: (newRole: string) => api.patch(`/users/${userId}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      onClose();
      toast.success('역할이 변경되었습니다.');
    },
    onError: () => toast.error('역할 변경에 실패했습니다.'),
  });
  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      onClose();
      toast.success('직원이 비활성화되었습니다.');
    },
    onError: () => toast.error('비활성화에 실패했습니다.'),
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
    <div className="absolute right-0 top-8 z-10 bg-white border border-border rounded-xl shadow-lg py-1 w-40">
      {role === 'employee' && (
        <button
          onClick={() => handleRoleChange('manager')}
          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background flex items-center gap-2 transition-colors"
        >
          <Shield className="h-4 w-4 text-primary-500" /> 관리자로 변경
        </button>
      )}
      {role === 'manager' && (
        <button
          onClick={() => handleRoleChange('employee')}
          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background flex items-center gap-2 transition-colors"
        >
          <User className="h-4 w-4 text-text-muted" /> 직원으로 변경
        </button>
      )}
      <hr className="my-1 border-border" />
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
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        비활성화
      </button>
    </div>
  );
}

export default function TeamPage() {
  usePageTitle('팀 관리');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_INIT);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invites'] }); toast.success('초대가 취소되었습니다.'); },
    onError: () => toast.error('초대 취소에 실패했습니다.'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/invites/${id}/resend`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invites'] }); toast.success('초대 이메일을 재발송했습니다.'); },
    onError: () => toast.error('재발송에 실패했습니다.'),
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
    { key: 'all',      label: '전체',        count: members.length },
    { key: 'manager',  label: '관리자',       count: members.filter((m: any) => m.role === 'manager').length },
    { key: 'employee', label: '직원',         count: members.filter((m: any) => m.role === 'employee').length },
    { key: 'invites',  label: '초대 대기 중', count: invites.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto" onClick={() => setOpenMenu(null)}>
      <Header title="팀 관리" />

      <main className="p-8 space-y-4 max-w-[1200px]">
        {/* 상단 액션 */}
        <div className="flex items-center justify-between">
          <input
            type="text"
            placeholder="이름, 이메일 검색"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input w-56"
          />
          {user?.role !== 'employee' && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" />
              직원 초대
            </Button>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-background border border-border rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
              {t.count != null && (
                <span className={clsx(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  tab === t.key ? 'bg-primary-100 text-primary-600' : 'bg-background border border-border text-text-muted',
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 직원 테이블 */}
        {tab !== 'invites' && (
          <Card padding="none">
            {isLoading ? (
              <div className="px-4"><SkeletonTableRows count={5} /></div>
            ) : paginated.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">직원이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['이름', '부서 / 직책', '역할', '상태', '마지막 로그인', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-background">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((m: any) => (
                      <tr
                        key={m.id}
                        className="border-b border-border/60 hover:bg-background transition-colors cursor-pointer"
                        onClick={() => router.push(`/team/${m.id}`)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} size="md" />
                            <div>
                              <p className="text-sm font-medium text-text-primary">{m.name}</p>
                              <p className="text-xs text-text-muted">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-text-secondary">
                          {[m.department, m.position].filter(Boolean).join(' · ') || '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge value={m.role} colorMap={ROLE_BADGE} label={ROLE_LABEL[m.role]} />
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge value={m.status} colorMap={STATUS_BADGE} label={STATUS_LABEL[m.status]} />
                        </td>
                        <td className="px-4 py-3.5 text-text-muted text-xs">
                          {m.lastLoginAt
                            ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true, locale: ko })
                            : '없음'}
                        </td>
                        <td className="px-4 py-3.5 relative" onClick={(e) => e.stopPropagation()}>
                          {user?.role === 'owner' && m.role !== 'owner' && (
                            <button
                              onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                              className="p-1.5 rounded-lg hover:bg-background text-text-muted transition-colors"
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
            <span className="text-text-muted">
              {filtered.length}명 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}명 표시
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                    p === page
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'border-border text-text-secondary hover:bg-background',
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* 초대 대기 목록 */}
        {tab === 'invites' && (
          <Card padding="none">
            {invites.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">대기 중인 초대가 없습니다.</p>
            ) : (
              <div className="divide-y divide-border">
                {invites.map((inv: any) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  return (
                    <div key={inv.id} className={clsx('flex items-center gap-4 py-3.5 px-4', expired && 'opacity-60')}>
                      <div className="h-8 w-8 rounded-full bg-gray-50 border border-border flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary truncate">{inv.email}</p>
                          {expired && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                              만료됨
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          <Badge value={inv.role} colorMap={ROLE_BADGE} label={ROLE_LABEL[inv.role]} className="mr-1" />
                          {expired ? '만료: ' : '만료 예정: '}{format(new Date(inv.expiresAt), 'M월 d일 HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => resendInviteMutation.mutate(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-background text-text-muted hover:text-primary-500 transition-colors"
                          title="재발송"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => cancelInviteMutation.mutate(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-background text-text-muted hover:text-red-500 transition-colors"
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
    </div>
  );
}
