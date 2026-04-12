'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { UserPlus, MoreVertical, Mail, Shield, User, RefreshCw, X, Smartphone, Link2, Copy, Check, QrCode, ChevronRight, Building2, Cake, Gift, Users, Plus, Pencil, Trash2, Crown } from 'lucide-react';
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

type TabType = 'all' | 'manager' | 'employee' | 'invites' | 'teams';

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

// ─── 팀 생성/수정 모달 (3단계 위저드) ───────────────────────────────────────
const TEAM_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const STEP_LABELS = ['기본 정보', '팀원 구성', '팀장 확인'];

function CreateTeamModal({
  open, onClose, members, editTeam,
}: {
  open: boolean;
  onClose: () => void;
  members: any[];
  editTeam?: any;
}) {
  const queryClient = useQueryClient();

  // 공통 상태
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState('');

  // 생성 전용 상태
  const [step, setStep] = useState(1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [aiDisclaimer, setAiDisclaimer] = useState('');
  const [leaderId, setLeaderId] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1); setError(''); setAiReasons({}); setAiDisclaimer('');
    if (editTeam) {
      setName(editTeam.name ?? '');
      setDescription(editTeam.description ?? '');
      setColor(editTeam.color ?? TEAM_COLORS[0]);
      setSelectedMemberIds([]); setLeaderId(editTeam.leaderId ?? '');
    } else {
      setName(''); setDescription(''); setColor(TEAM_COLORS[0]);
      setSelectedMemberIds([]); setLeaderId('');
    }
  }, [open, editTeam]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/teams', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('팀이 생성되었습니다.');
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '팀 생성에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/teams/${editTeam?.id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('팀 정보가 수정되었습니다.');
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.message ?? '팀 수정에 실패했습니다.'),
  });

  const aiRecommendMutation = useMutation({
    mutationFn: () =>
      api.post('/ai/team-scope-recommend', {
        teamName: name.trim(),
        description: description.trim() || undefined,
        employees: members
          .filter((m) => m.role !== 'owner')
          .map((m) => ({ userId: m.id, name: m.name, department: m.department, position: m.position })),
      }).then((r) => r.data.data),
    onSuccess: (data: any) => {
      setSelectedMemberIds(data.recommendedUserIds ?? []);
      const reasonMap: Record<string, string> = {};
      (data.reasons ?? []).forEach((r: any) => { reasonMap[r.userId] = r.reason; });
      setAiReasons(reasonMap);
      setAiDisclaimer(data.disclaimer ?? '');
      toast.success(`AI가 ${(data.recommendedUserIds ?? []).length}명을 추천했습니다.`);
    },
    onError: () => toast.error('AI 추천 요청에 실패했습니다.'),
  });

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) { setError('팀 이름을 입력해주세요.'); return; }
    setError('');
    setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    if (editTeam) {
      updateMutation.mutate({ name: name.trim(), description: description.trim() || undefined, color });
    } else {
      createMutation.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        memberIds: selectedMemberIds,
        leaderId: leaderId || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const candidateMembers = members.filter((m) => m.role !== 'owner');

  // 수정 모드: 단계 없이 기본 정보만
  if (editTeam) {
    return (
      <Modal open={open} onClose={onClose} title="팀 정보 수정">
        <div className="space-y-4">
          <div>
            <label className="label">팀 이름 *</label>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
          </div>
          <div>
            <label className="label">설명 (선택)</label>
            <textarea className="input resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">팀 색상</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-gray-700 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button loading={isPending} disabled={!name.trim() || isPending} onClick={handleSubmit}>저장</Button>
          </div>
        </div>
      </Modal>
    );
  }

  // 생성 모드: 3단계 위저드
  return (
    <Modal open={open} onClose={onClose} title="새 팀 만들기">
      {/* 단계 표시 */}
      <div className="flex items-center gap-2 mb-5">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step === s ? 'bg-primary-500 text-white' : step > s ? 'bg-primary-200 text-primary-700' : 'bg-gray-100 text-text-muted',
              )}>
                {step > s ? '✓' : s}
              </div>
              <span className={clsx('text-xs', step === s ? 'text-text-primary font-medium' : 'text-text-muted')}>{label}</span>
              {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: 기본 정보 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">팀 이름 *</label>
            <input
              className="input"
              placeholder="예: 개발팀, 마케팅팀, 영업1팀"
              value={name}
              autoFocus
              onChange={(e) => { setName(e.target.value); setError(''); }}
            />
          </div>
          <div>
            <label className="label">팀 소개 (선택)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="이 팀의 역할이나 담당 업무를 입력하면 AI가 구성원을 더 잘 추천합니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">팀 색상</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button disabled={!name.trim()} onClick={handleNext}>다음 →</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: 팀원 구성 ── */}
      {step === 2 && (
        <div className="space-y-3">
          {/* AI 추천 버튼 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">팀원을 선택하세요 <span className="text-text-muted">({selectedMemberIds.length}명 선택)</span></p>
            <Button
              size="sm"
              variant="secondary"
              loading={aiRecommendMutation.isPending}
              disabled={aiRecommendMutation.isPending || candidateMembers.length === 0}
              onClick={() => aiRecommendMutation.mutate()}
            >
              ✨ AI 추천
            </Button>
          </div>

          {/* AI 면책 문구 */}
          {aiDisclaimer && (
            <p className="text-[11px] text-text-muted bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">{aiDisclaimer}</p>
          )}

          {/* 팀원 체크리스트 */}
          <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border/50">
            {candidateMembers.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">초대된 직원이 없습니다.</p>
            ) : (
              candidateMembers.map((m) => {
                const isAiPick = !!aiReasons[m.id];
                return (
                  <label key={m.id} className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                    isAiPick && selectedMemberIds.includes(m.id) ? 'bg-indigo-50' : 'hover:bg-background',
                  )}>
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="rounded"
                    />
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-text-primary">{m.name}</span>
                        {isAiPick && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">AI추천</span>
                        )}
                      </div>
                      {aiReasons[m.id] ? (
                        <span className="text-xs text-indigo-500">{aiReasons[m.id]}</span>
                      ) : (
                        <span className="text-xs text-text-muted">{[m.department, m.position].filter(Boolean).join(' · ') || '-'}</span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex justify-between pt-1">
            <Button variant="secondary" onClick={() => setStep(1)}>← 이전</Button>
            <Button onClick={handleNext}>다음 →</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: 팀장 지정 + 최종 확인 ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* 팀 요약 */}
          <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{name}</p>
              <p className="text-xs text-text-muted">
                팀원 {selectedMemberIds.length}명
                {description ? ` · ${description.slice(0, 30)}${description.length > 30 ? '…' : ''}` : ''}
              </p>
            </div>
          </div>

          {/* 팀장 선택 */}
          <div>
            <label className="label">팀장 지정 (선택)</label>
            <select className="input" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              <option value="">팀장 없음</option>
              {(selectedMemberIds.length > 0
                ? candidateMembers.filter((m) => selectedMemberIds.includes(m.id))
                : candidateMembers
              ).map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.department ? `(${m.department})` : ''}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-between pt-1">
            <Button variant="secondary" onClick={() => setStep(2)}>← 이전</Button>
            <Button loading={isPending} disabled={isPending} onClick={handleSubmit}>
              팀 만들기 완료
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── 팀 상세 모달 ────────────────────────────────────────────────────────────
function TeamDetailModal({
  open, onClose, team, currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  team: any;
  currentUserRole: string;
}) {
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState('');
  const [membershipType, setMembershipType] = useState<'primary' | 'secondary' | 'tf' | 'dispatch'>('primary');

  const { data: teamMembers = [], isLoading } = useQuery<any[]>({
    queryKey: ['team-members', team?.id],
    queryFn: async () => {
      const { data } = await api.get(`/teams/${team.id}/members`);
      return data.data ?? data;
    },
    enabled: open && !!team?.id,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.data ?? data;
    },
    enabled: open,
  });

  const memberUserIds = new Set((teamMembers as any[]).map((m: any) => m.userId));
  const addableCandidates = (allUsers as any[]).filter((u: any) => !memberUserIds.has(u.id));

  const addMutation = useMutation({
    mutationFn: () => api.post(`/teams/${team.id}/members`, { userId: addUserId, membershipType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setAddUserId('');
      toast.success('팀원이 추가되었습니다.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '팀원 추가에 실패했습니다.'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/teams/${team.id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('팀원이 제거되었습니다.');
    },
    onError: () => toast.error('팀원 제거에 실패했습니다.'),
  });

  const setLeaderMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/teams/${team.id}/leader`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      toast.success('팀장이 지정되었습니다.');
    },
    onError: () => toast.error('팀장 지정에 실패했습니다.'),
  });

  if (!team) return null;

  const MEMBERSHIP_LABELS: Record<string, string> = {
    primary: '소속', secondary: '겸직', tf: 'TF', dispatch: '파견',
  };

  return (
    <Modal open={open} onClose={onClose} title={`${team.name} 팀원 관리`}>
      <div className="space-y-4">
        {/* 팀원 목록 */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">팀원 목록</p>
          {isLoading ? (
            <p className="text-sm text-text-muted text-center py-4">불러오는 중...</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">팀원이 없습니다.</p>
          ) : (
            <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden">
              {teamMembers.map((m: any) => (
                <div key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={m.user?.name ?? ''} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text-primary">{m.user?.name}</span>
                      {team.leaderId === m.userId && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <Crown className="w-2.5 h-2.5" />팀장
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {MEMBERSHIP_LABELS[m.membershipType] ?? m.membershipType}
                      {m.user?.department ? ` · ${m.user.department}` : ''}
                    </span>
                  </div>
                  {currentUserRole !== 'employee' && (
                    <div className="flex items-center gap-1">
                      {team.leaderId !== m.userId && (
                        <button
                          onClick={() => setLeaderMutation.mutate(m.userId)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-text-muted hover:text-amber-600 transition-colors"
                          title="팀장 지정"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => removeMutation.mutate(m.userId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                        title="팀원 제거"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 팀원 추가 (owner/manager) */}
        {currentUserRole !== 'employee' && addableCandidates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">팀원 추가</p>
            <div className="flex gap-2">
              <select
                className="input flex-1 text-sm"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
              >
                <option value="">직원 선택...</option>
                {addableCandidates.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ''}</option>
                ))}
              </select>
              <select
                className="input w-24 text-sm"
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as any)}
              >
                <option value="primary">소속</option>
                <option value="secondary">겸직</option>
                <option value="tf">TF</option>
                <option value="dispatch">파견</option>
              </select>
              <Button
                size="sm"
                disabled={!addUserId || addMutation.isPending}
                loading={addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                추가
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
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
    <>
      {/* 모바일: 수평 스크롤 탭 */}
      <div className="md:hidden mb-3">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {[
            [null, '전체', members.length] as [string | null, string, number],
            ...depts.map(([dept, count]) => [dept, dept, count] as [string | null, string, number]),
            ...(unclassified > 0 ? [['__unclassified', '미배정', unclassified] as [string | null, string, number]] : []),
          ].map(([key, label, count]) => (
            <button
              key={key ?? '__all'}
              onClick={() => onSelect(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors',
                selected === key
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white border border-border text-text-secondary hover:bg-gray-50',
              )}
            >
              {label}
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', selected === key ? 'bg-white/30 text-white' : 'bg-gray-100 text-text-muted')}>
                {count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* PC: 좌측 세로 사이드바 */}
      <div className="hidden md:block w-40 flex-shrink-0">
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
    </>
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

  // Teams 탭 전용 상태
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [detailTeam, setDetailTeam] = useState<any>(null);

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

  // 이달 생일 (manager/owner 전용)
  const { data: birthdaysThisMonth = [] } = useQuery<any[]>({
    queryKey: ['birthdays-this-month'],
    queryFn: async () => {
      const { data } = await api.get('/users/birthdays/this-month');
      return data.data ?? data;
    },
    enabled: user?.role !== 'employee',
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<any[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data } = await api.get('/teams');
      return data.data ?? data;
    },
    enabled: tab === 'teams',
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('팀이 삭제되었습니다.');
    },
    onError: () => toast.error('팀 삭제에 실패했습니다.'),
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
    { key: 'teams',    label: '팀',           count: teams.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto" onClick={() => setOpenMenu(null)}>
      <main className="p-4 md:p-8 max-w-[1280px]">
        <div className="flex flex-col md:flex-row md:gap-5">
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
          {user?.role !== 'employee' && tab !== 'teams' && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" />
              직원 초대
            </Button>
          )}
          {user?.role !== 'employee' && tab === 'teams' && (
            <Button size="sm" onClick={() => setShowCreateTeam(true)}>
              <Plus className="h-4 w-4" />
              팀 만들기
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

        {/* 이달 생일 패널 (manager/owner) */}
        {tab !== 'invites' && tab !== 'teams' && user?.role !== 'employee' && birthdaysThisMonth.length > 0 && (
          <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Cake className="w-4 h-4 text-pink-500" />
              <span className="text-[13px] font-semibold text-pink-700">이달의 생일</span>
              <span className="ml-auto text-[11px] text-pink-400">{new Date().toLocaleDateString('ko-KR', { month: 'long' })}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {birthdaysThisMonth.map((b: any) => (
                <div
                  key={b.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                    b.isToday
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'bg-white border border-pink-200 text-pink-800',
                  )}
                >
                  {b.isToday && <Gift className="w-3.5 h-3.5" />}
                  <span>{b.name}</span>
                  <span className={clsx('font-mono text-[11px]', b.isToday ? 'text-pink-100' : 'text-pink-400')}>
                    {b.birthdayMmDd}
                  </span>
                  {b.department && (
                    <span className={clsx('text-[10px]', b.isToday ? 'text-pink-200' : 'text-pink-300')}>
                      {b.department}
                    </span>
                  )}
                  {b.isToday && <span className="text-[10px] text-pink-200">오늘!</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 직원 테이블 */}
        {tab !== 'invites' && tab !== 'teams' && (
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
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-text-primary">{m.name}</p>
                                {m.birthday && (() => {
                                  const [, mm, dd] = (m.birthday as string).split('-');
                                  const now = new Date();
                                  const isToday = Number(mm) === now.getMonth() + 1 && Number(dd) === now.getDate();
                                  const isThisMonth = Number(mm) === now.getMonth() + 1;
                                  if (isToday) return (
                                    <span title="오늘 생일!" className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-semibold">
                                      <Cake className="w-2.5 h-2.5" />생일
                                    </span>
                                  );
                                  if (isThisMonth) return (
                                    <span title={`생일: ${mm}/${dd}`} className="text-[10px] text-pink-400 font-medium">
                                      🎂 {mm}/{dd}
                                    </span>
                                  );
                                  return null;
                                })()}
                              </div>
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
        {tab !== 'invites' && tab !== 'teams' && totalPages > 1 && (
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

        {/* 팀 목록 */}
        {tab === 'teams' && (
          <div>
            {teamsLoading ? (
              <p className="text-sm text-text-muted text-center py-8">불러오는 중...</p>
            ) : teams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">아직 팀이 없습니다.</p>
                {user?.role !== 'employee' && (
                  <Button size="sm" className="mt-3" onClick={() => setShowCreateTeam(true)}>
                    <Plus className="h-4 w-4" />
                    첫 팀 만들기
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team: any) => (
                  <div key={team.id} className="cursor-pointer" onClick={() => setDetailTeam(team)}><Card className="group hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      {/* 색상 도트 */}
                      <div
                        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: team.color ?? '#6366f1' }}
                      >
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-text-primary truncate">{team.name}</p>
                          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-background border border-border text-text-muted">
                            {team.memberCount ?? 0}명
                          </span>
                        </div>
                        {team.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{team.description}</p>
                        )}
                        {team.leader && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Crown className="w-3 h-3 text-amber-500" />
                            <span className="text-xs text-text-secondary">{team.leader.name}</span>
                          </div>
                        )}
                      </div>
                      {user?.role !== 'employee' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditingTeam(team); setShowCreateTeam(true); }}
                            className="p-1.5 rounded-lg hover:bg-background text-text-muted hover:text-primary-600 transition-colors"
                            title="수정"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {user?.role === 'owner' && (
                            <button
                              onClick={() => setConfirm({
                                open: true,
                                title: '팀 삭제',
                                desc: `"${team.name}" 팀을 삭제하시겠습니까? 팀 채널도 함께 삭제됩니다.`,
                                onConfirm: () => deleteTeamMutation.mutate(team.id),
                              })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card></div>
                ))}
              </div>
            )}
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
      <CreateTeamModal
        open={showCreateTeam}
        onClose={() => { setShowCreateTeam(false); setEditingTeam(null); }}
        members={members}
        editTeam={editingTeam}
      />
      {detailTeam && (
        <TeamDetailModal
          open={!!detailTeam}
          onClose={() => setDetailTeam(null)}
          team={teams.find((t: any) => t.id === detailTeam.id) ?? detailTeam}
          currentUserRole={user?.role ?? 'employee'}
        />
      )}
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
