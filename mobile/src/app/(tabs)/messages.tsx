import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import type { Socket } from 'socket.io-client';

interface Channel {
  id: string;
  name: string;
  is_private: boolean;
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
}

// 채널 목록 화면
function ChannelList({ onSelect }: { onSelect: (ch: Channel) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const res = await api.get('/collaboration/channels');
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
          <View style={styles.channelIcon}>
            <Text style={styles.channelIconText}>{item.is_private ? '🔒' : '#'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.channelName}>{item.name}</Text>
          </View>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

// 채팅방 화면
function ChatRoom({ channel, onBack }: { channel: Channel; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let mounted = true;

    // 과거 메시지 로드
    api.get(`/collaboration/channels/${channel.id}/messages?limit=50`)
      .then((res) => {
        if (mounted) {
          setMessages((res.data.data as Message[]).reverse());
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    // 소켓 연결 및 채널 입장
    getSocket().then((sock) => {
      if (!mounted) return;
      socketRef.current = sock;
      sock.emit('join_channel', { channelId: channel.id });

      sock.on('new_message', (msg: Message) => {
        if (mounted) setMessages((prev) => [...prev, msg]);
      });
    });

    return () => {
      mounted = false;
      socketRef.current?.emit('leave_channel', { channelId: channel.id });
      socketRef.current?.off('new_message');
    };
  }, [channel.id]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      channelId: channel.id,
      content: text,
    });
    setInput('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.sender_name[0]}</Text>
          </View>
        )}
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
          <Text style={[styles.msgContent, isMe && styles.msgContentMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
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
      {/* 헤더 */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 채널</Text>
        </TouchableOpacity>
        <Text style={styles.chatTitle}># {channel.name}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* 입력창 */}
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
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Text style={styles.sendBtnText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function MessagesScreen() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    return () => {
      disconnectSocket(); // 메시지 탭 이탈 시 소켓 정리
    };
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

const styles = StyleSheet.create({
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconText: { fontSize: 16 },
  channelName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  unreadBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 40, fontSize: 14 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  msgList: { padding: 12, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  msgBubble: {
    maxWidth: '75%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    gap: 2,
  },
  msgBubbleMe: {
    backgroundColor: '#2563EB',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
    borderColor: '#2563EB',
  },
  msgSender: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  msgContent: { fontSize: 14, color: '#111827', lineHeight: 20 },
  msgContentMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#9CA3AF', alignSelf: 'flex-end' },
  msgTimeMe: { color: '#BFDBFE' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: '#BFDBFE' },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
