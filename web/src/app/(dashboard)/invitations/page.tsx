'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Plus, Copy, Trash2, X, Link2, Users, UserCheck,
  CheckCircle2, Clock, Ban, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { clsx } from 'clsx';

// ─── 타입 ───────────────────────────────────────────────────────────────────
interface InviteLink {
  id: string;
  linkKind: 'personal' | 'group';
  role: string;
  email: string | null;
  department: string | null;
  position: string | null;
  maxUses: number | null;
  usedCount: number;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  expiresAt: string;
  note: string | null;
  joinUrl: string;
  isExpired: boolean;
  isFull: boolean;
  createdAt: string;
  inviter?: { id: string; name: string };
}

interface CreateLinkForm {
  link_kind: 'personal' | 'group';
  role: 'employee' | 'manager';
  target_email: string;
  department: string;
  position: string;
  max_uses: string;
  expires_at: string;
  note: string;
}

const DEFAULT_FORM: CreateLinkForm = {
  link_kind: 'group',
  role: 'employee',
  target_email: '',
  department: '',
  position: '',
  max_uses: '',
  expires_at: '',
  note: '',
};

// ─── 상태 뱃지 ─────────────────────────────────────────────────────────────
function StatusBadge({ link }: { link: InviteLink }) {
  if (link.status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
        <Ban className="w-3 h-3" /> 취소됨
      </span>
    );
  }
  if (link.isExpired || link.status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-600">
        <Clock className="w-3 h-3" /> 만료됨
      </span>
    );
  }
  if (link.isFull || link.status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-600">
        <CheckCircle2 className="w-3 h-3" /> 완료
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">
      <AlertCircle className="w-3 h-3" /> 활성
    </span>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────
export default function InvitationsPage() {
  usePageTitle('초대 링크 관리');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateLinkForm>(DEFAULT_FORM);

  // ── 목록 조회 ──
  const { data, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const res = await api.get('/invitations/links');
      return res.data.data as InviteLink[];
    },
  });

  // ── 생성 ──
  const createMut = useMutation({
    mutationFn: async (payload: object) => {
      const res = await api.post('/invitations/links', payload);
      return res.data.data;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      setShowCreate(false);
      setForm(DEFAULT_FORM);
      // 생성 직후 URL 복사
      navigator.clipboard.writeText(created.joinUrl).catch(() => {});
      toast.success('초대 링크가 생성되어 클립보드에 복사됐습니다');
    },
    onError: () => toast.error('링크 생성에 실패했습니다'),
  });

  // ── 취소 ──
  const cancelMut = useMutation({
    mutationFn: (id: string) => api.patch(`/invitations/links/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('링크가 취소됐습니다');
    },
  });

  // ── 삭제 ──
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/links/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('링크가 삭제됐습니다');
    },
  });

  const handleCreate = () => {
    const payload: Record<string, unknown> = {
      link_kind: form.link_kind,
      role: form.role,
    };
    if (form.target_email) payload.target_email = form.target_email;
    if (form.department) payload.department = form.department;
    if (form.position) payload.position = form.position;
    if (form.max_uses) payload.max_uses = Number(form.max_uses);
    if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
    if (form.note) payload.note = form.note;
    createMut.mutate(payload);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(
      () => toast.success('링크가 복사됐습니다'),
      () => toast.error('복사에 실패했습니다'),
    );
  };

  const activeLinks = data?.filter((l) => !l.isExpired && l.status === 'pending') ?? [];
  const otherLinks  = data?.filter((l) =>  l.isExpired || l.status !== 'pending') ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">초대 링크 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            직원에게 초대 링크를 공유하면 별도 가입 절차 없이 회사 계정이 생성됩니다.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> 초대 링크 생성
        </Button>
      </div>

      {/* 안내 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 flex gap-3">
          <UserCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">개인 링크</p>
            <p className="text-xs text-blue-600 mt-1">
              특정 이메일 주소 1명만 사용 가능. 가입 완료 후 자동 소멸.
              이메일 인증까지 완료해야 직원 계정이 활성화됩니다.
            </p>
          </div>
        </div>
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 flex gap-3">
          <Users className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-purple-800">그룹 링크</p>
            <p className="text-xs text-purple-600 mt-1">
              여러 명이 같은 링크로 가입 가능. 최대 사용 횟수 및 만료 일시 설정 가능.
              채용 공고나 팀 공유에 적합합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 활성 링크 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          활성 링크 ({activeLinks.length})
        </h2>
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">불러오는 중...</div>
        ) : activeLinks.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            아직 활성 초대 링크가 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {activeLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onCopy={copyUrl}
                onCancel={(id) => cancelMut.mutate(id)}
                onDelete={(id) => deleteMut.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 만료/완료 링크 */}
      {otherLinks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            만료 / 완료 ({otherLinks.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {otherLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onCopy={copyUrl}
                onCancel={(id) => cancelMut.mutate(id)}
                onDelete={(id) => deleteMut.mutate(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 생성 모달 */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(DEFAULT_FORM); }} title="초대 링크 생성">
        <div className="space-y-4">
          {/* 링크 종류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">링크 종류</label>
            <div className="grid grid-cols-2 gap-3">
              {(['personal', 'group'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setForm((f) => ({ ...f, link_kind: kind, target_email: '' }))}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-colors',
                    form.link_kind === kind
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  )}
                >
                  {kind === 'personal' ? '👤 개인 링크 (1인용)' : '👥 그룹 링크 (다수)'}
                </button>
              ))}
            </div>
          </div>

          {/* 역할 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">부여할 역할</label>
            <div className="grid grid-cols-2 gap-3">
              {(['employee', 'manager'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setForm((f) => ({ ...f, role: r }))}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-colors',
                    form.role === r
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  )}
                >
                  {r === 'employee' ? '직원' : '관리자'}
                </button>
              ))}
            </div>
          </div>

          {/* 개인 링크: 이메일 지정 */}
          {form.link_kind === 'personal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지정 이메일 <span className="text-gray-400 text-xs">(비워두면 선착순 1명)</span>
              </label>
              <input
                type="email"
                value={form.target_email}
                onChange={(e) => setForm((f) => ({ ...f, target_email: e.target.value }))}
                placeholder="recruit@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 그룹 링크: 최대 사용 횟수 */}
          {form.link_kind === 'group' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 사용 횟수 <span className="text-gray-400 text-xs">(비워두면 무제한)</span>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                placeholder="예: 10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 부서 / 직책 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사전 지정 부서</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="개발팀"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사전 지정 직책</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="시니어 개발자"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 만료 일시 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              만료 일시 <span className="text-gray-400 text-xs">(기본: 7일 후)</span>
            </label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 내부 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관리자 메모 (선택)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="채용 공고 3월 배치 등 내부 메모"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setForm(DEFAULT_FORM); }}>
              취소
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? '생성 중...' : '링크 생성'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── 링크 카드 컴포넌트 ──────────────────────────────────────────────────
function LinkCard({
  link, onCopy, onCancel, onDelete,
}: {
  link: InviteLink;
  onCopy: (url: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = !link.isExpired && link.status === 'pending';

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 종류 + 상태 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              link.linkKind === 'personal' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
            )}>
              {link.linkKind === 'personal' ? <UserCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {link.linkKind === 'personal' ? '개인 링크' : '그룹 링크'}
            </span>
            <StatusBadge link={link} />
            <span className="text-xs text-gray-500">
              {link.role === 'manager' ? '관리자' : '직원'}
            </span>
            {link.department && (
              <span className="text-xs text-gray-500">· {link.department}</span>
            )}
            {link.position && (
              <span className="text-xs text-gray-500">{link.position}</span>
            )}
          </div>

          {/* URL */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 max-w-lg">
            <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate font-mono">{link.joinUrl}</span>
          </div>

          {/* 메타 */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
            {link.linkKind === 'group' && (
              <span>사용 {link.usedCount}{link.maxUses ? ` / ${link.maxUses}` : ''}회</span>
            )}
            <span>
              만료: {format(new Date(link.expiresAt), 'M/d HH:mm', { locale: ko })}
            </span>
            {link.email && (
              <span className="text-blue-500">지정: {link.email}</span>
            )}
            {link.note && (
              <span className="italic">"{link.note}"</span>
            )}
            {link.inviter && (
              <span>생성: {link.inviter.name}</span>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isActive && (
            <button
              onClick={() => onCopy(link.joinUrl)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
              title="링크 복사"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onCancel(link.id)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-orange-600 transition-colors"
              title="링크 취소"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(link.id)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
