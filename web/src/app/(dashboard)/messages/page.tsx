'use client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, Hash, Megaphone, MessageSquare, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { Channel, Message } from '@/types';
import { clsx } from 'clsx';

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
          <label className="block text-sm font-medium text-gray-700 mb-1">채널 이름 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 공지, 일반, 마케팅팀"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

// ─── 메시지 버블 ──────────────────────────────────────────────────────────────
function MessageBubble({
  message, isMine, channelId, onDeleted,
}: {
  message: Message;
  isMine: boolean;
  channelId: string;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

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
        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
          {message.user.name.charAt(0)}
        </div>
      )}

      <div className={clsx('max-w-xs lg:max-w-md', isMine && 'items-end flex flex-col')}>
        {!isMine && <p className="text-xs text-gray-500 mb-1 ml-1">{message.user.name}</p>}

        {editing ? (
          /* 인라인 편집 */
          <div className="flex flex-col gap-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              autoFocus
              className="px-3 py-2 rounded-xl border border-blue-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => editMutation.mutate(editText.trim())}
                disabled={!editText.trim() || editMutation.isPending}
                className="p-1 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-40"
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
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm',
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

            {/* 수정/삭제 액션 (본인 메시지 + hover) */}
            {isMine && hovered && !message.deletedAt && (
              <div className={clsx(
                'absolute top-1 flex gap-0.5',
                isMine ? '-left-16' : '-right-16',
              )}>
                <button
                  onClick={() => { setEditing(true); setEditText(message.content); }}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-500"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-red-50 text-red-400 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <p className={clsx('text-xs text-gray-400 mt-1', isMine ? 'text-right' : 'ml-1')}>
          {format(new Date(message.createdAt), 'HH:mm')}
        </p>
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

  // 채널 목록
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.get('/channels');
      return data.data as Channel[];
    },
  });

  // 자동으로 첫 번째 채널 선택
  useEffect(() => {
    if (channels.length && !activeChannelId) setActiveChannelId(channels[0].id);
  }, [channels, activeChannelId]);

  // 메시지 목록
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

  // ── 소켓 연결 및 채널 룸 관리 ──────────────────
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

    return () => {
      socket.off('message:new');
      socket.off('message:update');
      socket.off('message:delete');
    };
  }, [queryClient]);

  // 채널 전환 시 룸 join/leave
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

  // 메시지 전송
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/channels/${activeChannelId}/messages`, { content }),
    onSuccess: () => {
      setInputText('');
      // 전송 후 포커스 유지
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? '메시지 전송에 실패했습니다.');
    },
  });

  // 읽음 처리
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

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 채널 사이드바 */}
      <div className="w-56 bg-gray-900 flex flex-col flex-shrink-0">
        <div className="px-3 py-4 flex-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">채널</p>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-gray-400 hover:text-white transition-colors"
              title="채널 만들기"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* 채널 목록 또는 빈 상태 */}
          {!channelsLoading && channels.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-500 mb-3">채널이 없습니다.</p>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
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
                  onClick={() => setActiveChannelId(ch.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* 채널 없을 때 중앙 안내 */}
        {!channelsLoading && channels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Hash className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-base font-semibold text-gray-700 mb-1">채널이 없습니다</p>
            <p className="text-sm text-gray-400 mb-5">채널을 만들어 팀과 대화를 시작해보세요.</p>
            <Button onClick={() => setShowCreateChannel(true)}>
              <Plus className="h-4 w-4" /> 첫 채널 만들기
            </Button>
          </div>
        ) : (
          <>
            {/* 채널 헤더 */}
            {activeChannel && (
              <div className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-2">
                {(() => {
                  const Icon = CHANNEL_ICONS[activeChannel.type] ?? Hash;
                  return <Icon className="h-5 w-5 text-gray-400" />;
                })()}
                <span className="font-semibold text-gray-900">{activeChannel.name}</span>
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
                />
              ))}
              {!messages.length && (
                <p className="text-sm text-gray-400 text-center mt-12">첫 메시지를 보내보세요.</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력창 */}
            {activeChannelId && (
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-4 py-2.5">
                  <input
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={`${activeChannel?.name ?? '채널'}에 메시지 보내기`}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || sendMutation.isPending}
                    className="p-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
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
    </div>
  );
}
