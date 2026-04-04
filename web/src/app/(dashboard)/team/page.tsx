'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { UserPlus, MoreVertical, Mail, Shield, User, RefreshCw, X, Smartphone, Link2, Copy, Check, QrCode, ChevronRight, Building2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
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

type InviteTab = 'phone' | 'email' | 'link';

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InviteTab>('phone');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 전화번호 초대
  const [phoneName, setPhoneName] = useState('');
  const [phoneNum, setPhoneNum] = useState('');

  // 이메일 초대
  const [email, setEmail] = useState('');

  // 링크 공유
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [validDays, setValidDays] = useState(7);

  const reset = () => {
    setError(''); setSuccess('');
    setPhoneName(''); setPhoneNum(''); setEmail('');
    setGeneratedLink(''); setCopied(false);
  };

  const phoneMutation = useMutation({
    mutationFn: (payload: any) => api.post('/users/invite/phone', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      setSuccess('SMS 초대를 발송했습니다.');
      setPhoneName(''); setPhoneNum('');
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '초대 발송에 실패했습니다.'),
  });

  const emailMutation = useMutation({
    mutationFn: (payload: any) => api.post('/users/invite', payload).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      setSuccess('이메일 초대를 발송했습니다.');
      setEmail('');
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '초대 발송에 실패했습니다.'),
  });

  const linkMutation = useMutation({
    mutationFn: (payload: any) => api.post('/users/invite/link', payload).then(r => r.data.data),
    onSuccess: (data: { inviteUrl: string }) => {
      setGeneratedLink(data.inviteUrl);
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '링크 생성에 실패했습니다.'),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: InviteTab; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { key: 'phone', icon: Smartphone, label: '전화번호' },
    { key: 'email', icon: Mail,       label: '이메일' },
    { key: 'link',  icon: Link2,      label: '링크 공유' },
  ];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="직원 초대">
      {/* 탭 */}
      <div className="flex gap-1 bg-zinc-50 rounded-xl p-1 mb-5">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); reset(); }}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
              tab === key ? 'bg-white text-primary-600 shadow-sm' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* 역할 (공통) */}
      {tab !== 'link' && (
        <div className="mb-4">
          <label className="label">역할</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="employee">직원</option>
            <option value="manager">관리자</option>
          </select>
        </div>
      )}

      {/* ── 전화번호 탭 ── */}
      {tab === 'phone' && (
        <div className="space-y-3">
          <div>
            <label className="label">이름</label>
            <input
              placeholder="홍길동"
              value={phoneName}
              onChange={(e) => { setPhoneName(e.target.value); setError(''); }}
              className="input"
            />
          </div>
          <div>
            <label className="label">전화번호</label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={phoneNum}
              onChange={(e) => { setPhoneNum(e.target.value); setError(''); }}
              className="input"
            />
          </div>
          <p className="text-xs text-text-muted">SMS로 초대 링크를 발송합니다 (48시간 유효).</p>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { reset(); onClose(); }}>취소</Button>
            <Button
              loading={phoneMutation.isPending}
              disabled={!phoneName.trim() || !phoneNum.trim() || phoneMutation.isPending}
              onClick={() => phoneMutation.mutate({ name: phoneName, phone: phoneNum, role })}
            >
              <Smartphone className="h-3.5 w-3.5" />
              SMS 초대
            </Button>
          </div>
        </div>
      )}

      {/* ── 이메일 탭 ── */}
      {tab === 'email' && (
        <div className="space-y-3">
          <div>
            <label className="label">이메일</label>
            <input
              type="email"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="input"
            />
          </div>
          <p className="text-xs text-text-muted">이메일로 초대 링크를 발송합니다 (48시간 유효).</p>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { reset(); onClose(); }}>취소</Button>
            <Button
              loading={emailMutation.isPending}
              disabled={!email.trim() || emailMutation.isPending}
              onClick={() => emailMutation.mutate({ email, role })}
            >
              <Mail className="h-3.5 w-3.5" />
              이메일 초대
            </Button>
          </div>
        </div>
      )}

      {/* ── 링크 공유 탭 ── */}
      {tab === 'link' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">역할</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
                <option value="employee">직원</option>
                <option value="manager">관리자</option>
              </select>
            </div>
            <div>
              <label className="label">유효 기간</label>
              <select value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} className="input">
                <option value={1}>1일</option>
                <option value={3}>3일</option>
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-text-muted">링크를 가진 누구나 가입할 수 있습니다. 카카오톡, 문자 등으로 공유하거나 사무실에 QR로 게시하세요.</p>

          {generatedLink ? (
            <div className="space-y-3">
              <div className="bg-zinc-50 rounded-xl border border-border px-3 py-2.5 flex items-center gap-2">
                <p className="flex-1 text-xs text-text-secondary truncate font-mono">{generatedLink}</p>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="text-xs text-text-muted text-center">위 링크를 직원들에게 공유하세요.</p>
            </div>
          ) : (
            <>
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { reset(); onClose(); }}>취소</Button>
                <Button
                  loading={linkMutation.isPending}
                  onClick={() => linkMutation.mutate({ role, validDays })}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  링크 생성
                </Button>
              </div>
            </>
          )}
        </div>
      )}
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
  userId, role, currentUserRole, currentUserId, onClose, onConfirm, onOpenPermissions,
}: {
  userId: string; role: string; currentUserRole: string;
  currentUserId: string; onClose: () => void;
  onConfirm: (s: ConfirmState) => void;
  onOpenPermissions: (id: string) => void;
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
    <div className="absolute right-0 top-8 z-10 bg-white border border-border rounded-xl shadow-lg py-1 w-44">
      {role === 'employee' && (
        <button
          onClick={() => handleRoleChange('manager')}
          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background flex items-center gap-2 transition-colors"
        >
          <Shield className="h-4 w-4 text-primary-500" /> 관리자로 변경
        </button>
      )}
      {role === 'manager' && (
        <>
          <button
            onClick={() => handleRoleChange('employee')}
            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background flex items-center gap-2 transition-colors"
          >
            <User className="h-4 w-4 text-text-muted" /> 직원으로 변경
          </button>
          <button
            onClick={() => { onOpenPermissions(userId); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background flex items-center gap-2 transition-colors"
          >
            <Shield className="h-4 w-4 text-amber-500" /> 권한 설정
          </button>
        </>
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

function PermissionsModal({
  open, onClose, userId, currentData,
}: {
  open: boolean; onClose: () => void; userId: string;
  currentData?: { managedDepartments?: string[] | null; permissions?: Record<string, boolean> | null };
}) {
  const queryClient = useQueryClient();
  const [allDepts, setAllDepts] = useState(true);
  const [deptInput, setDeptInput] = useState('');
  const [depts, setDepts] = useState<string[]>([]);
  const [perms, setPerms] = useState({
    canInvite: false, canManagePayroll: false,
    canManageContracts: false, canManageEvaluations: false,
  });

  useEffect(() => {
    if (!open) return;
    if (currentData?.managedDepartments === null || currentData?.managedDepartments === undefined) {
      setAllDepts(true); setDepts([]);
    } else {
      setAllDepts(false); setDepts(currentData.managedDepartments ?? []);
    }
    setPerms({
      canInvite: currentData?.permissions?.canInvite ?? false,
      canManagePayroll: currentData?.permissions?.canManagePayroll ?? false,
      canManageContracts: currentData?.permissions?.canManageContracts ?? false,
      canManageEvaluations: currentData?.permissions?.canManageEvaluations ?? false,
    });
  }, [open, currentData]);

  const mutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/users/${userId}/permissions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('권한이 저장되었습니다.');
      onClose();
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const addDept = () => {
    const v = deptInput.trim();
    if (v && !depts.includes(v)) setDepts([...depts, v]);
    setDeptInput('');
  };

  const PERM_LABELS: { key: keyof typeof perms; label: string }[] = [
    { key: 'canInvite', label: '직원 초대' },
    { key: 'canManagePayroll', label: '급여 관리' },
    { key: 'canManageContracts', label: '계약 관리' },
    { key: 'canManageEvaluations', label: '인사평가 관리' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="관리자 권한 설정">
      <div className="space-y-5">
        {/* 담당 부서 */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">담당 부서 범위</p>
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => setAllDepts(true)}
              className={clsx('flex-1 py-2 rounded-lg border text-sm font-medium transition-all', allDepts ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-text-secondary hover:border-gray-300')}
            >
              전체 부서
            </button>
            <button
              onClick={() => setAllDepts(false)}
              className={clsx('flex-1 py-2 rounded-lg border text-sm font-medium transition-all', !allDepts ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-text-secondary hover:border-gray-300')}
            >
              지정 부서만
            </button>
          </div>
          {!allDepts && (
            <div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text" placeholder="부서명 입력" value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDept())}
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary-500"
                />
                <Button size="sm" onClick={addDept}>추가</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {depts.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                    {d}
                    <button onClick={() => setDepts(depts.filter((x) => x !== d))} className="hover:text-blue-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {depts.length === 0 && <p className="text-xs text-text-muted">부서를 추가하세요.</p>}
              </div>
            </div>
          )}
        </div>

        {/* 세부 권한 */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">세부 권한</p>
          <div className="space-y-2">
            {PERM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox" checked={perms[key]}
                  onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-text-primary">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate({
            managedDepartments: allDepts ? null : depts,
            permissions: perms,
          })}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── 부서 트리 사이드바 ────────────────────────
function DeptTree({
  members,
  selected,
  onSelect,
}: {
  members: any[];
  selected: string | null;
  onSelect: (dept: string | null) => void;
}) {
  // 부서별 인원 수 집계
  const deptMap = new Map<string, number>();
  let unclassified = 0;
  for (const m of members) {
    if (!m.department) { unclassified++; continue; }
    deptMap.set(m.department, (deptMap.get(m.department) ?? 0) + 1);
  }
  const depts = Array.from(deptMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'));

  const item = (key: string | null, label: string, count: number) => (
    <button
      key={key ?? '__all'}
      onClick={() => onSelect(key)}
      className={clsx(
        'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
        selected === key
          ? 'bg-primary-50 text-primary-600 font-medium'
          : 'text-text-secondary hover:bg-background',
      )}
    >
      <span className="truncate">{label}</span>
      <span className={clsx('ml-1.5 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0',
        selected === key ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-text-muted'
      )}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="w-44 flex-shrink-0">
      <div className="flex items-center gap-1.5 px-1 mb-2">
        <Building2 className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">부서</span>
      </div>
      <nav className="space-y-0.5">
        {item(null, '전체', members.length)}
        {depts.map(([dept, count]) => item(dept, dept, count))}
        {unclassified > 0 && item('__unclassified', '미배정', unclassified)}
      </nav>
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
  const [permissionsUserId, setPermissionsUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterDept, setFilterDept] = useState<string | null>(null);
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
    if (filterDept === '__unclassified' && m.department) return false;
    if (filterDept && filterDept !== '__unclassified' && m.department !== filterDept) return false;
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
      <main className="p-8 max-w-[1280px]">
        <div className="flex gap-5">
          {/* 부서 트리 사이드바 */}
          <DeptTree
            members={members}
            selected={filterDept}
            onSelect={(d) => { setFilterDept(d); setPage(1); }}
          />

          {/* 오른쪽 콘텐츠 */}
          <div className="flex-1 min-w-0 space-y-4">
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
                              onOpenPermissions={(id) => setPermissionsUserId(id)}
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
          </div> {/* 오른쪽 콘텐츠 끝 */}
        </div> {/* flex gap-5 끝 */}
      </main>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_INIT)} />
      {permissionsUserId && (
        <PermissionsModal
          open={!!permissionsUserId}
          onClose={() => setPermissionsUserId(null)}
          userId={permissionsUserId}
          currentData={members.find((m: any) => m.id === permissionsUserId)}
        />
      )}
    </div>
  );
}
