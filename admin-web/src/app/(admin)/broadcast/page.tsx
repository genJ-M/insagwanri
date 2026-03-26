'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

type Target = 'all' | 'plan' | 'companies';
type Channel = 'in_app' | 'email' | 'both';

const PLAN_OPTS = [
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function BroadcastPage() {
  const [target, setTarget] = useState<Target>('all');
  const [planName, setPlanName] = useState('free');
  const [companyIdsText, setCompanyIdsText] = useState('');
  const [channel, setChannel] = useState<Channel>('in_app');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // 발송 이력
  const { data: history } = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: async () => (await api.get('/broadcast/history')).data.data as Array<{
      date: string; count: number;
    }>,
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const companyIds = companyIdsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      return api.post('/broadcast', {
        target,
        ...(target === 'plan' && { planName }),
        ...(target === 'companies' && { companyIds }),
        channel,
        title,
        message,
      });
    },
    onSuccess: (res) => {
      const { sent, target_users } = res.data.data;
      toast.success(`공지 발송 완료: ${target_users}명 대상, ${sent}건 처리됨`);
      setTitle('');
      setMessage('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? '발송에 실패했습니다.'),
  });

  const handleSend = () => {
    if (!title.trim()) return toast.error('제목을 입력해 주세요.');
    if (!message.trim()) return toast.error('내용을 입력해 주세요.');
    if (!confirm('공지를 발송하시겠습니까? 취소할 수 없습니다.')) return;
    sendMutation.mutate();
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">공지 브로드캐스트</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* 수신 대상 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">수신 대상</label>
          <div className="flex gap-3">
            {(['all', 'plan', 'companies'] as Target[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  value={t}
                  checked={target === t}
                  onChange={() => setTarget(t)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {t === 'all' ? '전체' : t === 'plan' ? '플랜별' : '특정 회사'}
                </span>
              </label>
            ))}
          </div>
          {target === 'plan' && (
            <select
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLAN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {target === 'companies' && (
            <textarea
              value={companyIdsText}
              onChange={(e) => setCompanyIdsText(e.target.value)}
              placeholder="회사 UUID를 줄바꿈 또는 콤마로 구분하여 입력"
              rows={3}
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* 발송 채널 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">발송 채널</label>
          <div className="flex gap-3">
            {([
              { value: 'in_app', label: '앱 내 알림' },
              { value: 'email', label: '이메일' },
              { value: 'both', label: '둘 다' },
            ] as { value: Channel; label: string }[]).map((c) => (
              <label key={c.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value={c.value}
                  checked={channel === c.value}
                  onChange={() => setChannel(c.value)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="공지 제목"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{title.length}/100</p>
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="공지 내용을 입력해 주세요."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{message.length}/2000</p>
        </div>

        <button
          onClick={handleSend}
          disabled={sendMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {sendMutation.isPending ? '발송 중...' : '공지 발송'}
        </button>
      </div>

      {/* 최근 발송 이력 */}
      {history && history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">최근 발송 이력 (공지)</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.date} className="flex justify-between text-sm text-gray-600">
                <span>{h.date}</span>
                <span className="font-medium">{h.count.toLocaleString()}건</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
