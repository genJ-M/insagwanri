import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';

interface Channel {
  id: string;
  name: string;
  type: 'general' | 'announcement' | 'group' | 'direct';
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  deletedAt: string | null;
  isEdited: boolean;
  user: { id: string; name: string };
  createdAt: string;
  confirmedByMe?: boolean;
  confirmedCount?: number;
  totalCount?: number;
}

// ─── 채널 목록 ────────────────────────────────────────────────────────────────
function ChannelList({ onSelect }: { onSelect: (ch: Channel) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const res = await api.get('/channels');
      return res.data.data as Channel[];
    },
  });

  if (isLoading) return <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(ch) => ch.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={<Text style={styles.emptyText}>참여 중인 채널이 없습니다.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.channelItem} onPress={() => onSelect(item)}>
          <View style={[styles.channelIcon, item.type === 'announcement' && styles.channelIconAnnounce]}>
            <Text style={styles.channelIconText}>{item.type === 'announcement' ? '📢' : '#'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.channelName}>{item.name}</Text>
            {item.type === 'announcement' && (
              <Text style={styles.channelTypeBadge}>공지</Text>
            )}
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

// ─── 채팅방 ───────────────────────────────────────────────────────────────────
function ChatRoom({ channel, onBack }: { channel: Channel; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const isAnnouncement = channel.type === 'announcement';

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', channel.id],
    queryFn: async () => {
      const res = await api.get(`/channels/${channel.id}/messages`, { params: { limit: 50 } });
      return res.data as { messages: Message[] };
    },
  });

  const messages: Message[] = messagesData?.messages ?? [];

  // 소켓 실시간
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage?.getItem?.('access_token') : null;
    if (!token) return;

    let socket: any;
    getSocket(token).then?.((sock: any) => {
      socket = sock;
      sock.emit('channel:join', { channelId: channel.id });

      sock.on('message:new', (msg: Message) => {
        qc.setQueryData(['messages', channel.id], (old: any) => {
          if (!old) return old;
          const exists = old.messages?.some((m: Message) => m.id === msg.id);
          if (exists) return old;
          return { ...old, messages: [...(old.messages ?? []), msg] };
        });
      });

      sock.on('message:confirmed', (payload: any) => {
        qc.setQueryData(['messages', channel.id], (old: any) => {
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
    }).catch?.(() => {});

    return () => {
      socket?.emit('channel:leave', { channelId: channel.id });
      socket?.off('message:new');
      socket?.off('message:confirmed');
    };
  }, [channel.id]);

  // 읽음 처리
  useEffect(() => {
    if (messages.length) {
      api.post(`/channels/${channel.id}/read`, {
        last_read_message_id: messages[messages.length - 1].id,
      }).catch(() => {});
    }
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/channels/${channel.id}/messages`, { content }),
    onSuccess: () => {
      setInput('');
      qc.invalidateQueries({ queryKey: ['messages', channel.id] });
    },
  });

  const confirmMut = useMutation({
    mutationFn: (messageId: string) =>
      api.post(`/channels/${channel.id}/messages/${messageId}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', channel.id] });
      qc.invalidateQueries({ queryKey: ['unconfirmed-announcements'] });
    },
  });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.user.id === user?.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.user.name[0]}</Text>
          </View>
        )}
        <View style={{ maxWidth: '75%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
          {!isMe && <Text style={styles.msgSender}>{item.user.name}</Text>}
          <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
            <Text style={[styles.msgContent, isMe && styles.msgContentMe]}>
              {item.deletedAt ? '삭제된 메시지입니다.' : item.content}
            </Text>
          </View>
          <View style={[styles.msgMeta, isMe && styles.msgMetaMe]}>
            <Text style={styles.msgTime}>
              {new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {/* 공지 확인 버튼 */}
            {isAnnouncement && !item.deletedAt && !isMe && !item.confirmedByMe && (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirmMut.mutate(item.id)}
                disabled={confirmMut.isPending}
              >
                <Text style={styles.confirmBtnText}>✅ 확인</Text>
              </TouchableOpacity>
            )}
            {isAnnouncement && !item.deletedAt && !isMe && item.confirmedByMe && (
              <Text style={styles.confirmedText}>✅ 확인됨</Text>
            )}
            {isAnnouncement && !item.deletedAt && isMe && item.confirmedCount !== undefined && (
              <Text style={styles.readCountText}>
                {item.confirmedCount}/{item.totalCount}명 확인
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ 채널</Text>
        </TouchableOpacity>
        <Text style={styles.chatTitle}>
          {isAnnouncement ? '📢 ' : '# '}{channel.name}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>첫 메시지를 보내보세요.</Text>}
        />
      )}

      {/* 공지 채널: 일반직원 읽기 전용 표시 */}
      {isAnnouncement && user?.role === 'employee' ? (
        <View style={styles.readOnlyBar}>
          <Text style={styles.readOnlyText}>📢 공지 채널은 읽기 전용입니다.</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="메시지 입력..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => { if (input.trim()) sendMut.mutate(input.trim()); }}
            disabled={!input.trim() || sendMut.isPending}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  if (selectedChannel) {
    return (
      <ChatRoom
        channel={selectedChannel}
        onBack={() => setSelectedChannel(null)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ChannelList onSelect={setSelectedChannel} />
    </View>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },

  // 채널 목록
  channelItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  channelIconAnnounce: { backgroundColor: '#FFF7ED' },
  channelIconText: { fontSize: 16 },
  channelName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  channelTypeBadge: { fontSize: 11, color: '#C2410C', marginTop: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // 채팅 헤더
  chatHeader: {
    height: 52,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  backBtn: { padding: 6 },
  backBtnText: { fontSize: 15, color: '#2563EB', fontWeight: '600' },
  chatTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },

  // 메시지 목록
  msgList: { padding: 12, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  msgSender: { fontSize: 11, color: '#6B7280', marginBottom: 2, marginLeft: 2 },
  msgBubble: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  msgBubbleMe: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  msgContent: { fontSize: 14, color: '#111827', lineHeight: 20 },
  msgContentMe: { color: '#fff' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, marginLeft: 2 },
  msgMetaMe: { justifyContent: 'flex-end', marginLeft: 0, marginRight: 2 },
  msgTime: { fontSize: 11, color: '#9CA3AF' },
  confirmBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1, borderColor: '#6EE7B7',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  confirmBtnText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  confirmedText: { fontSize: 11, color: '#10B981' },
  readCountText: { fontSize: 11, color: '#93C5FD' },

  // 입력창
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendBtnDisabled: { backgroundColor: '#BFDBFE' },
  sendBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // 읽기 전용 바
  readOnlyBar: {
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
    alignItems: 'center',
  },
  readOnlyText: { fontSize: 13, color: '#C2410C' },
});
