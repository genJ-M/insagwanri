const COLOR_MAP: Record<string, string> = {
  // 구독/서비스 상태
  active:        'bg-green-100 text-green-700',
  trialing:      'bg-purple-100 text-purple-700',
  past_due:      'bg-orange-100 text-orange-700',
  suspended:     'bg-red-100 text-red-700',
  canceled:      'bg-gray-100 text-gray-500',
  pending:       'bg-yellow-100 text-yellow-700',
  // 결제 상태
  completed:     'bg-green-100 text-green-700',
  failed:        'bg-red-100 text-red-700',
  refunded:      'bg-blue-100 text-blue-700',
  partial_refunded: 'bg-blue-50 text-blue-600',
  void:          'bg-gray-100 text-gray-500',
  processing:    'bg-yellow-100 text-yellow-700',
  // 카드 유형
  corporate:     'bg-indigo-100 text-indigo-700',
  business:      'bg-teal-100 text-teal-700',
  personal:      'bg-slate-100 text-slate-700',
  bank_transfer: 'bg-amber-100 text-amber-700',
  // 계약 상태
  draft:         'bg-gray-100 text-gray-600',
  signed:        'bg-green-100 text-green-700',
  terminated:    'bg-red-100 text-red-600',
  expired:       'bg-orange-100 text-orange-600',
};

const LABEL_MAP: Record<string, string> = {
  active: '활성', trialing: '체험중', past_due: '미납', suspended: '정지',
  canceled: '해지', pending: '대기', completed: '완료', failed: '실패',
  refunded: '환불', partial_refunded: '부분환불', void: '무효', processing: '처리중',
  corporate: '법인카드', business: '사업자카드', personal: '개인카드',
  bank_transfer: '계좌이체', draft: '초안', signed: '서명완료',
  terminated: '해지', expired: '만료', monthly: '월간', yearly: '연간',
};

interface Props {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, size = 'sm' }: Props) {
  const colorClass = COLOR_MAP[status] ?? 'bg-gray-100 text-gray-600';
  const text = label ?? LABEL_MAP[status] ?? status;
  const sizeClass = size === 'sm'
    ? 'text-xs px-2 py-0.5 rounded-full'
    : 'text-sm px-3 py-1 rounded-full';

  return (
    <span className={`inline-flex items-center font-medium ${colorClass} ${sizeClass}`}>
      {text}
    </span>
  );
}
