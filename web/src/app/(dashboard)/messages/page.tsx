'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, Hash, Megaphone, MessageSquare, Plus, Pencil, Trash2, Check, X, ChevronLeft, CheckCheck, Users, Sparkles, Loader2, Calendar, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { Channel, Message, MessageRead } from '@/types';
import { clsx } from 'clsx';

// ─── 공지 템플릿 ──────────────────────────────────────────────────────────────
const ANNOUNCE_TEMPLATES = [
  { id: 'meeting',     icon: '📅', name: '회의/일정',   aiType: 'meeting',     placeholder: '예: 3월 16일 월요일 오전 10시, 2층 회의실, 전체 주간 회의' },
  { id: 'policy',      icon: '📋', name: '정책/지침',   aiType: 'policy',      placeholder: '예: 4월부터 재택근무 신청 방식 변경, 월 2회 → 주 1회 한도' },
  { id: 'event',       icon: '🎉', name: '행사/이벤트', aiType: 'event',       placeholder: '예: 4월 20일 창립기념일 행사, 점심 식사 제공, 오후 반차' },
  { id: 'urgent',      icon: '🚨', name: '긴급 공지',   aiType: 'urgent',      placeholder: '예: 오늘 오후 3시 이후 전기 공사, 사무실 전기 차단' },
  { id: 'maintenance', icon: '🔧', name: '시설/공사',   aiType: 'maintenance', placeholder: '예: 화요일 오전 9~11시 엘리베이터 점검, 계단 이용 요망' },
  { id: 'reminder',    icon: '🔔', name: '업무 리마인더', aiType: 'reminder',  placeholder: '예: 이번 주 금요일까지 경비처리 완료 요청' },
  { id: 'general',     icon: '✏️', name: '자유 작성',   aiType: 'general',     placeholder: '공지 내용을 직접 작성하거나, 핵심 내용을 입력하고 AI 초안을 받아보세요.' },
];

// ─── 공지 작성 모달 ───────────────────────────────────────────────────────────
function AnnouncementComposerModal({
  open, onClose, channelId,
}: {
  open: boolean; onClose: () => void; channelId: string;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'content' | 'target' | 'calendar'>('content');
  const [template, setTemplate]       = useState(ANNOUNCE_TEMPLATES[0]);
  const [keyPoints, setKeyPoints]     = useState('');
  const [content, setContent]         = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [targetType, setTargetType]   = useState<'all' | 'department' | 'custom'>('all');
  const [targetDept, setTargetDept]   = useState('');
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [isPrivate, setIsPrivate]     = useState(false);
  const [withCalendar, setWithCalendar] = useState(false);
  const [calTitle, setCalTitle]       = useState('');
  const [calStart, setCalStart]       = useState('');
  const [calEnd, setCalEnd]           = useState('');
  const [calAllDay, setCalAllDay]     = useState(false);

  // 직원 목록 (직접 선택용)
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-announce'],
    queryFn: () => api.get('/users').then(r => r.data.data as any[]),
    enabled: open,
  });

  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))] as string[];

  const sendMut = useMutation({
    mutationFn: () => {
      const body: any = {
        content,
        target_type: targetType,
        is_private_recipients: isPrivate && targetType !== 'all',
      };
      if (targetType === 'department') body.target_department = targetDept;
      if (targetType === 'custom') body.target_user_ids = targetUsers;
      if (withCalendar && calStart && calEnd) {
        body.schedule_event = {
          title: calTitle || content.substring(0, 50),
          start_at: calStart,
          end_at: calEnd,
          is_all_day: calAllDay,
        };
      }
      return api.post(`/channels/${channelId}/messages`, body);
    },
    onSuccess: () => {
      toast.success('공지가 발송되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      handleClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '발송에 실패했습니다.'),
  });

  const handleAiDraft = async () => {
    if (!keyPoints.trim()) { toast.error('핵심 내용을 먼저 입력해주세요.'); return; }
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/announcement', {
        input_text: keyPoints,
        tone: 'formal',
        announcement_type: template.aiType,
      });
      setContent(data.data.output_text);
      toast.success('AI 초안이 생성되었습니다.');
    } catch {
      toast.error('AI 초안 생성에 실패했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleClose = () => {
    setStep('content'); setKeyPoints(''); setContent('');
    setTargetType('all'); setTargetDept(''); setTargetUsers([]);
    setIsPrivate(false); setWithCalendar(false);
    setCalTitle(''); setCalStart(''); setCalEnd(''); setCalAllDay(false);
    onClose();
  };

  const toggleUser = (id: string) =>
    setTargetUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const canSend = content.trim().length > 0 &&
    (targetType !== 'department' || targetDept) &&
    (targetType !== 'custom' || targetUsers.length > 0);

  const STEPS = ['content', 'target', 'calendar'] as const;
  const stepIdx = STEPS.indexOf(step);

  return (
    <Modal open={open} onClose={handleClose} title="📢 공지 작성" size="lg">
      {/* 스텝 인디케이터 */}
      <div className="flex gap-1 mb-5">
        {(['내용 작성', '발송 대상', '캘린더 연동'] as const).map((label, i) => (
          <button
            key={i}
            onClick={() => setStep(STEPS[i])}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
              i === stepIdx
                ? 'bg-primary-500 text-white'
                : i < stepIdx
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-background text-text-muted',
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* ── STEP 1: 내용 ─────────────────────────────────────────────────── */}
      {step === 'content' && (
        <div className="space-y-4">
          {/* 템플릿 선택 */}
          <div>
            <label className="label mb-1.5">템플릿</label>
            <div className="flex gap-2 flex-wrap">
              {ANNOUNCE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    template.id === t.id
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white border-border text-text-secondary hover:border-primary-300',
                  )}
                >
                  <span>{t.icon}</span> {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* 핵심 내용 입력 + AI 초안 */}
          <div>
            <label className="label mb-1.5">핵심 내용 (AI 초안용)</label>
            <div className="flex gap-2">
              <textarea
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder={template.placeholder}
                rows={2}
                className="input flex-1 resize-none text-sm"
              />
              <button
                onClick={handleAiDraft}
                disabled={aiLoading || !keyPoints.trim()}
                className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl border border-primary-300 bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-40 transition-colors text-xs font-medium flex-shrink-0 w-20"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI 초안
              </button>
            </div>
          </div>

          {/* 공지 내용 */}
          <div>
            <label className="label mb-1.5">공지 내용 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지 내용을 직접 입력하거나 위의 AI 초안 기능을 사용하세요."
              rows={7}
              className="input w-full resize-none text-sm"
            />
            <p className="text-xs text-text-muted mt-1 text-right">{content.length}자</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep('target')} disabled={!content.trim()}>
              다음: 발송 대상 →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: 발송 대상 ──────────────────────────────────────────────── */}
      {step === 'target' && (
        <div className="space-y-4">
          <div>
            <label className="label mb-2">발송 대상</label>
            <div className="flex gap-3">
              {(['all', 'department', 'custom'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={targetType === t}
                    onChange={() => { setTargetType(t); setIsPrivate(false); }}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-text-primary">
                    {t === 'all' ? '전체 직원' : t === 'department' ? '부서별' : '직접 선택'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 부서 선택 */}
          {targetType === 'department' && (
            <div>
              <label className="label mb-1.5">부서 선택 *</label>
              <select value={targetDept} onChange={(e) => setTargetDept(e.target.value)} className="input">
                <option value="">부서 선택...</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* 직접 선택 */}
          {targetType === 'custom' && (
            <div>
              <label className="label mb-1.5">수신자 선택 * ({targetUsers.length}명 선택됨)</label>
              <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {users.map((u: any) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-background cursor-pointer border-b border-border last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={targetUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="accent-primary-500"
                    />
                    <div className="h-7 w-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {u.name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{u.name}</p>
                      <p className="text-xs text-text-muted">{u.department} · {u.position}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* BCC 모드 (전체 아닌 경우에만) */}
          {targetType !== 'all' && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-amber-800">비공개 발송 (BCC 모드)</p>
                <p className="text-xs text-amber-600">수신자가 다른 수신자를 볼 수 없습니다. 개별 발송처럼 보입니다.</p>
              </div>
            </label>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('content')}>← 이전</Button>
            <Button onClick={() => setStep('calendar')} disabled={
              (targetType === 'department' && !targetDept) ||
              (targetType === 'custom' && targetUsers.length === 0)
            }>
              다음: 캘린더 연동 →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 캘린더 연동 ────────────────────────────────────────────── */}
      {step === 'calendar' && (
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={withCalendar}
              onChange={(e) => setWithCalendar(e.target.checked)}
              className="accent-primary-500 h-4 w-4"
            />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-500" />
              <div>
                <p className="text-sm font-medium text-text-primary">캘린더에 일정 등록</p>
                <p className="text-xs text-text-muted">공지와 함께 팀 캘린더에 자동 추가됩니다.</p>
              </div>
            </div>
          </label>

          {withCalendar && (
            <div className="space-y-3 p-3 rounded-xl border border-border bg-background">
              <div>
                <label className="label mb-1">일정 제목</label>
                <input
                  value={calTitle}
                  onChange={(e) => setCalTitle(e.target.value)}
                  placeholder={content.substring(0, 40) || '일정 제목'}
                  className="input text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={calAllDay} onChange={(e) => setCalAllDay(e.target.checked)} className="accent-primary-500" />
                종일
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">시작 *</label>
                  <input
                    type={calAllDay ? 'date' : 'datetime-local'}
                    value={calStart}
                    onChange={(e) => setCalStart(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="label mb-1">종료 *</label>
                  <input
                    type={calAllDay ? 'date' : 'datetime-local'}
                    value={calEnd}
                    onChange={(e) => setCalEnd(e.target.value)}
                    className="input text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 발송 요약 */}
          <div className="p-3 rounded-xl bg-primary-50 border border-primary-100 text-xs text-primary-700 space-y-1">
            <p className="font-semibold text-primary-800">발송 요약</p>
            <p>대상: {targetType === 'all' ? '전체 직원' : targetType === 'department' ? `${targetDept} 부서` : `${targetUsers.length}명`}
              {isPrivate && targetType !== 'all' && ' · 비공개 발송'}
            </p>
            {withCalendar && calStart && <p>캘린더: {calTitle || content.substring(0, 30)} ({calStart})</p>}
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('target')}>← 이전</Button>
            <Button
              loading={sendMut.isPending}
              disabled={!canSend || (withCalendar && (!calStart || !calEnd))}
              onClick={() => sendMut.mutate()}
            >
              공지 발송
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const CHANNEL_ICONS: Record<string, any> = {
  announcement: Megaphone,
  general:      Hash,
  direct:       MessageSquare,
  group:        Hash,
};

const CHANNEL_TYPE_KO: Record<string, string> = {
  general: '일반', announcement: '공지', group: '그룹',
};

// ─── 채널 생성 모달 ───────────────────────────────────────────────────────────
function CreateChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('general');

  const mutation = useMutation({
    mutationFn: () => api.post('/channels', { name: name.trim(), type }),
    onSuccess: () => {
      toast.success('채널이 생성되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      onClose();
      setName('');
      setType('general');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '채널 생성에 실패했습니다.');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="채널 만들기" size="sm">
      <div className="space-y-3">
        <div>
          <label className="label">채널 이름 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 공지, 일반, 마케팅팀"
            className="input"
          />
        </div>
        <div>
          <label className="label">유형</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            {Object.entries(CHANNEL_TYPE_KO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            만들기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 채널 사이드바 아이템 ─────────────────────────────────────────────────────
function ChannelItem({ channel, isActive, onClick }: {
  channel: Channel; isActive: boolean; onClick: () => void;
}) {
  const Icon = CHANNEL_ICONS[channel.type] ?? Hash;
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
        isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
      <span className="flex-1 truncate">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0">
          {channel.unreadCount > 9 ? '9+' : channel.unreadCount}
        </span>
      )}
    </button>
  );
}

// ─── 읽음 멤버 팝오버 ─────────────────────────────────────────────────────────
function ReadsPopover({ channelId, messageId, confirmed, total }: {
  channelId: string; messageId: string; confirmed: number; total: number;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['message-reads', channelId, messageId],
    queryFn: async () => {
      const { data } = await api.get(`/channels/${channelId}/messages/${messageId}/reads`);
      return data.data as { confirmed: MessageRead[]; unconfirmed: MessageRead[] };
    },
    enabled: open,
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-primary-500 transition-colors"
      >
        <Users className="h-3 w-3" />
        <span>{confirmed}/{total}명 확인</span>
      </button>
      {open && (
        <div className="absolute bottom-6 right-0 z-50 w-64 bg-white rounded-xl shadow-lg border border-border p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-text-primary">확인 현황</p>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {data ? (
            <>
              <div className="mb-2">
                <p className="text-xs text-green-600 font-medium mb-1">확인 ({data.confirmed.length}명)</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {data.confirmed.map((r) => (
                    <p key={r.userId} className="text-xs text-text-secondary">{r.user?.name}</p>
                  ))}
                  {data.confirmed.length === 0 && <p className="text-xs text-text-muted">아직 없음</p>}
                </div>
              </div>
              <div>
                <p className="text-xs text-red-500 font-medium mb-1">미확인 ({data.unconfirmed.length}명)</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {data.unconfirmed.map((r) => (
                    <p key={r.userId} className="text-xs text-text-secondary">{r.user?.name}</p>
                  ))}
                  {data.unconfirmed.length === 0 && <p className="text-xs text-text-muted">전원 확인 완료</p>}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">불러오는 중...</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메시지 버블 ──────────────────────────────────────────────────────────────
function MessageBubble({
  message, isMine, channelId, onDeleted, isAnnouncement, isAdmin,
}: {
  message: Message;
  isMine: boolean;
  channelId: string;
  onDeleted: (id: string) => void;
  isAnnouncement?: boolean;
  isAdmin?: boolean;
}) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/channels/${channelId}/messages/${message.id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
      toast.success('확인했습니다.');
    },
    onError: () => { toast.error('확인에 실패했습니다.'); },
  });

  const editMutation = useMutation({
    mutationFn: (content: string) =>
      api.patch(`/channels/${channelId}/messages/${message.id}`, { content }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '수정에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/channels/${channelId}/messages/${message.id}`),
    onSuccess: () => {
      onDeleted(message.id);
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '삭제에 실패했습니다.');
    },
  });

  const handleDelete = () => {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
    deleteMutation.mutate();
  };

  return (
    <div
      className={clsx('flex gap-2.5 mb-3 group', isMine && 'flex-row-reverse')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      {!isMine && (
        <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
          {message.user.name.charAt(0)}
        </div>
      )}

      <div className={clsx('max-w-xs lg:max-w-md', isMine && 'items-end flex flex-col')}>
        {!isMine && <p className="text-xs text-text-muted mb-1 ml-1">{message.user.name}</p>}

        {editing ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              autoFocus
              className="px-3 py-2 rounded-xl border border-primary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="p-1 rounded-lg hover:bg-background text-text-muted transition-colors"
                aria-label="수정 취소"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => editMutation.mutate(editText.trim())}
                disabled={!editText.trim() || editMutation.isPending}
                className="p-1 rounded-lg hover:bg-primary-50 text-primary-500 disabled:opacity-40 transition-colors"
                aria-label="수정 저장"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className={clsx(
              'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
              isMine
                ? 'bg-primary-500 text-white rounded-tr-sm'
                : 'bg-white border border-border text-text-primary rounded-tl-sm',
            )}>
              {message.deletedAt ? (
                <span className="italic text-xs opacity-60">삭제된 메시지입니다.</span>
              ) : (
                message.content
              )}
              {message.isEdited && !message.deletedAt && (
                <span className="text-xs opacity-60 ml-1">(수정됨)</span>
              )}
            </div>

            {/* 수정/삭제 액션 */}
            {isMine && hovered && !message.deletedAt && (
              <div className={clsx(
                'absolute top-1 flex gap-0.5',
                isMine ? '-left-16' : '-right-16',
              )}>
                <button
                  onClick={() => { setEditing(true); setEditText(message.content); }}
                  className="p-1.5 rounded-lg bg-white border border-border shadow-sm hover:bg-background text-text-secondary transition-colors"
                  aria-label="메시지 수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg bg-white border border-border shadow-sm hover:bg-red-50 text-red-400 disabled:opacity-40 transition-colors"
                  aria-label="메시지 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className={clsx('flex items-center gap-2 mt-1', isMine ? 'justify-end' : 'ml-1')}>
          <p className="text-xs text-text-muted">
            {format(new Date(message.createdAt), 'HH:mm')}
          </p>
          {/* 공지 대상 배지 (발신자 뷰 전용) */}
          {isAnnouncement && isMine && message.targetType && message.targetType !== 'all' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {message.isPrivateRecipients ? '🔒 비공개 ' : ''}
              {message.targetType === 'department' ? `${message.targetDepartment} 부서` : `${message.targetUserIds?.length ?? 0}명`}
            </span>
          )}
          {/* 캘린더 연동 배지 */}
          {isAnnouncement && message.linkedScheduleId && (
            <span className="text-xs text-primary-500 flex items-center gap-0.5">
              <Calendar className="h-3 w-3" /> 일정 등록됨
            </span>
          )}
        {/* 공지 채널 확인 UI */}
          {isAnnouncement && !message.deletedAt && (
            <>
              {isAdmin && message.confirmedCount !== undefined && (
                <ReadsPopover
                  channelId={channelId}
                  messageId={message.id}
                  confirmed={message.confirmedCount}
                  total={message.totalCount ?? 0}
                />
              )}
              {!isMine && !message.confirmedByMe && (
                <button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs hover:bg-green-100 transition-colors disabled:opacity-40"
                >
                  <CheckCheck className="h-3 w-3" />
                  확인
                </button>
              )}
              {!isMine && message.confirmedByMe && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCheck className="h-3 w-3" /> 확인됨
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function MessagesPage() {
  usePageTitle('메시지');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevChannelRef = useRef<string | null>(null);

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.get('/channels');
      return data.data as Channel[];
    },
  });

  useEffect(() => {
    if (channels.length && !activeChannelId) setActiveChannelId(channels[0].id);
  }, [channels, activeChannelId]);

  const { data: messagesData } = useQuery({
    queryKey: ['messages', activeChannelId],
    queryFn: async () => {
      const { data } = await api.get(`/channels/${activeChannelId}/messages`, {
        params: { limit: 50 },
      });
      return data;
    },
    enabled: !!activeChannelId,
  });

  const messages: Message[] = messagesData?.messages ?? [];

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;

    const socket = getSocket(token);

    socket.on('message:new', (msg: Message) => {
      queryClient.setQueryData(['messages', msg.channelId], (old: any) => {
        if (!old) return old;
        const exists = old.messages?.some((m: Message) => m.id === msg.id);
        if (exists) return old;
        return { ...old, messages: [...(old.messages ?? []), msg] };
      });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    });

    socket.on('message:update', (payload: Partial<Message> & { channelId: string }) => {
      queryClient.setQueryData(['messages', payload.channelId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages?.map((m: Message) =>
            m.id === payload.id ? { ...m, ...payload } : m,
          ),
        };
      });
    });

    socket.on('message:delete', (payload: { id: string; channelId: string; deletedAt: string }) => {
      queryClient.setQueryData(['messages', payload.channelId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages?.map((m: Message) =>
            m.id === payload.id ? { ...m, deletedAt: payload.deletedAt } : m,
          ),
        };
      });
    });

    socket.on('message:confirmed', (payload: { messageId: string; channelId: string; confirmedCount: number; totalCount: number }) => {
      queryClient.setQueryData(['messages', payload.channelId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages?.map((m: Message) =>
            m.id === payload.messageId
              ? { ...m, confirmedCount: payload.confirmedCount, totalCount: payload.totalCount }
              : m,
          ),
        };
      });
    });

    return () => {
      socket.off('message:new');
      socket.off('message:update');
      socket.off('message:delete');
      socket.off('message:confirmed');
    };
  }, [queryClient]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;

    const socket = getSocket(token);

    if (prevChannelRef.current && prevChannelRef.current !== activeChannelId) {
      socket.emit('channel:leave', { channelId: prevChannelRef.current });
    }
    if (activeChannelId) {
      socket.emit('channel:join', { channelId: activeChannelId });
    }
    prevChannelRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/channels/${activeChannelId}/messages`, { content }),
    onSuccess: () => {
      setInputText('');
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '메시지 전송에 실패했습니다.');
    },
  });

  const readMutation = useMutation({
    mutationFn: (lastMessageId: string) =>
      api.post(`/channels/${activeChannelId}/read`, { last_read_message_id: lastMessageId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length) readMutation.mutate(messages[messages.length - 1].id);
  }, [messages.length, activeChannelId]);

  const handleSend = () => {
    if (!inputText.trim() || !activeChannelId) return;
    sendMutation.mutate(inputText.trim());
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const isAnnouncement = activeChannel?.type === 'announcement';
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';
  const [showComposer, setShowComposer] = useState(false);

  // 모바일: 채널 목록 / 채팅 전환 (activeChannelId 있으면 채팅 표시)
  const [showChannelList, setShowChannelList] = useState(false);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 채널 사이드바 — 다크 테마 유지 (채팅 UI 관례) */}
      {/* 모바일: activeChannel 없을 때 전체폭, 있을 때 숨김 / PC: 항상 표시 w-56 */}
      <div className={clsx(
        'bg-gray-900 flex flex-col flex-shrink-0 transition-all',
        'w-full md:w-56',
        activeChannelId && !showChannelList ? 'hidden md:flex' : 'flex',
      )}>
        <div className="px-3 py-4 flex-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">채널</p>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="채널 만들기"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {!channelsLoading && channels.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-500 mb-3">채널이 없습니다.</p>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="text-xs text-primary-400 hover:text-primary-300 underline transition-colors"
              >
                첫 채널 만들기
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {channels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  onClick={() => { setActiveChannelId(ch.id); setShowChannelList(false); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 메시지 영역 — 모바일: 채널 선택 시만 표시, PC: 항상 표시 */}
      <div className={clsx(
        'flex-1 flex flex-col min-w-0 bg-background',
        !activeChannelId || showChannelList ? 'hidden md:flex' : 'flex',
      )}>
        {!channelsLoading && channels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Hash className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-base font-semibold text-text-primary mb-1">채널이 없습니다</p>
            <p className="text-sm text-text-secondary mb-5">채널을 만들어 팀과 대화를 시작해보세요.</p>
            <Button onClick={() => setShowCreateChannel(true)}>
              <Plus className="h-4 w-4" /> 첫 채널 만들기
            </Button>
          </div>
        ) : (
          <>
            {/* 채널 헤더 */}
            {activeChannel && (
              <div className="h-14 bg-white border-b border-border flex items-center px-3 md:px-5 gap-2">
                {/* 모바일 뒤로가기 버튼 */}
                <button
                  onClick={() => setShowChannelList(true)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-background text-text-secondary transition-colors"
                  aria-label="채널 목록"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {(() => {
                  const Icon = CHANNEL_ICONS[activeChannel.type] ?? Hash;
                  return <Icon className="h-5 w-5 text-text-muted" />;
                })()}
                <span className="font-semibold text-text-primary flex-1">{activeChannel.name}</span>
                {/* 공지 채널: 관리자 전용 작성 버튼 */}
                {isAnnouncement && isAdmin && (
                  <button
                    onClick={() => setShowComposer(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    공지 작성
                  </button>
                )}
              </div>
            )}

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.user.id === user?.id}
                  channelId={activeChannelId!}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['messages', activeChannelId] })}
                  isAnnouncement={isAnnouncement}
                  isAdmin={isAdmin}
                />
              ))}
              {!messages.length && (
                <p className="text-sm text-text-muted text-center mt-12">첫 메시지를 보내보세요.</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력창 */}
            {activeChannelId && (
              <div className="bg-white border-t border-border px-4 py-3">
                <div className="flex items-center gap-2 bg-background rounded-xl border border-border px-4 py-2.5">
                  <input
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={`${activeChannel?.name ?? '채널'}에 메시지 보내기`}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted text-text-primary"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || sendMutation.isPending}
                    className="p-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateChannelModal open={showCreateChannel} onClose={() => setShowCreateChannel(false)} />

      {activeChannelId && (
        <AnnouncementComposerModal
          open={showComposer}
          onClose={() => setShowComposer(false)}
          channelId={activeChannelId}
        />
      )}
    </div>
  );
}
