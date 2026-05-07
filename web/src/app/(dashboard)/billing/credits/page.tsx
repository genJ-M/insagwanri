'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Sparkles, AlertCircle, Plus, Clock } from 'lucide-react';
import api from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import BillingTabs from '@/components/billing/BillingTabs';
import { useAuthStore } from '@/store/auth.store';
import { usePageTitle } from '@/hooks/usePageTitle';

interface CreditBalance {
  balance: number;
  monthlyGrant: number;
  lastGrantAt: string | null;
}

interface CreditPackage {
  id: string;
  credits: number;
  priceKrw: number;
  label: string;
  perUnit: string;
  badge?: string;
}

interface CreditTx {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string;
  createdAt: string;
  user?: { name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  monthly_grant: '월 무료 지급',
  purchase:      '구매 충전',
  manual_adjust: '수동 충전',
  ocr:           'OCR 차감',
  ai_classify:   'AI 분류',
  ai_analyze:    'AI 분석',
  ai_report:     'AI 보고서',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function BillingCreditsPage() {
  usePageTitle('AI 크레딧');
  const { user } = useAuthStore();
  const isOwner   = user?.role === 'owner';
  const isManager = user?.role === 'manager' || isOwner;
  const qc = useQueryClient();

  const [confirmPkg, setConfirmPkg] = useState<CreditPackage | null>(null);

  const { data: balance } = useQuery<CreditBalance>({
    queryKey: ['credit-balance'],
    queryFn: () => api.get('/credits/balance').then(r => r.data.data),
  });

  const { data: packages = [] } = useQuery<CreditPackage[]>({
    queryKey: ['credit-packages'],
    queryFn: () => api.get('/credits/packages').then(r => r.data.data),
  });

  const { data: history = [] } = useQuery<CreditTx[]>({
    queryKey: ['credit-history'],
    queryFn: () => api.get('/credits/history?limit=30').then(r => r.data.data),
    enabled: isManager,
  });

  const purchaseMut = useMutation({
    mutationFn: (pkg: CreditPackage) =>
      api.post('/credits/purchase', { credits: pkg.credits, package_id: pkg.id }),
    onSuccess: () => {
      toast.success('크레딧이 충전되었습니다.');
      setConfirmPkg(null);
      qc.invalidateQueries({ queryKey: ['credit-balance'] });
      qc.invalidateQueries({ queryKey: ['credit-history'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '충전에 실패했습니다.');
    },
  });

  const monthlyTotal = useMemo(() => balance?.monthlyGrant ?? 0, [balance]);

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="p-8 space-y-6 max-w-5xl">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">결제 관리</h1>
          <p className="text-sm text-text-muted mt-1">
            AI 기능 사용에 필요한 크레딧 잔액과 충전 내역을 확인하세요.
          </p>
        </div>

        <BillingTabs />

        {/* 잔액 카드 */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">현재 잔액</p>
              <p className="text-2xl font-bold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-primary-500" />
                {(balance?.balance ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">크레딧</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">월 무료 지급</p>
              <p className="text-base font-bold text-text-primary">{monthlyTotal.toLocaleString()} 크레딧</p>
              <p className="text-[11px] text-text-muted mt-0.5">매월 1일 자동 지급</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">최근 무료 지급일</p>
              <p className="text-base font-bold text-text-primary">{fmtDate(balance?.lastGrantAt ?? null)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">자동 충전</p>
            </div>
          </div>
        </Card>

        {/* 사용 단가 안내 */}
        <Card>
          <p className="text-[13px] font-semibold text-text-primary mb-3">크레딧 사용 단가</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-50 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-text-muted">이미지 OCR</p>
              <p className="text-[13px] font-semibold text-text-primary">2 크레딧 / 장</p>
            </div>
            <div className="bg-zinc-50 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-text-muted">AI 업무 분류</p>
              <p className="text-[13px] font-semibold text-text-primary">1 크레딧</p>
            </div>
            <div className="bg-zinc-50 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-text-muted">AI 계약서 분석</p>
              <p className="text-[13px] font-semibold text-text-primary">3 크레딧</p>
            </div>
            <div className="bg-zinc-50 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-text-muted">AI 보고서 초안</p>
              <p className="text-[13px] font-semibold text-text-primary">3 크레딧</p>
            </div>
          </div>
          <p className="text-[11px] text-text-muted mt-3">
            개인 일일 사용 한도: 20 크레딧
          </p>
        </Card>

        {/* 충전 패키지 (owner only) */}
        {isOwner && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-text-primary">크레딧 충전</p>
              <span className="text-[11px] text-text-muted">사업주 전용</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-start gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" />
              <p>
                현재 결제 PG 연동 전 단계로, 충전은 <strong>사업주 수동 충전</strong>으로만 진행됩니다.
                결제 연동 완료 시 자동 결제로 전환됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {packages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setConfirmPkg(p)}
                  disabled={purchaseMut.isPending}
                  className="group text-left border border-zinc-200 hover:border-primary-300 hover:shadow-sm rounded-xl px-4 py-4 transition-all disabled:opacity-60"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-bold text-text-primary">{p.label}</p>
                    {p.badge && (
                      <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-text-primary">
                    ₩{p.priceKrw.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">{p.perUnit}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* 거래 이력 (owner/manager) */}
        {isManager && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-text-muted" />
              <p className="text-[13px] font-semibold text-text-primary">거래 이력</p>
              <span className="text-[11px] text-text-muted">최근 30건</span>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">거래 내역이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold text-text-muted uppercase tracking-wider border-b border-zinc-100">
                      <th className="text-left px-2 py-2">일시</th>
                      <th className="text-left px-2 py-2">구분</th>
                      <th className="text-left px-2 py-2">사유</th>
                      <th className="text-right px-2 py-2">변동</th>
                      <th className="text-right px-2 py-2">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((tx) => (
                      <tr key={tx.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                        <td className="px-2 py-2 text-[12px] text-text-muted whitespace-nowrap">
                          {fmtDateTime(tx.createdAt)}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-text-secondary">
                          {TYPE_LABEL[tx.type] ?? tx.type}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-text-primary">
                          {tx.description}
                          {tx.user?.name && (
                            <span className="text-text-muted ml-1.5">· {tx.user.name}</span>
                          )}
                        </td>
                        <td
                          className={`px-2 py-2 text-[13px] font-semibold text-right whitespace-nowrap ${
                            tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-text-secondary text-right whitespace-nowrap">
                          {tx.balanceAfter.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </main>

      {/* 충전 확인 모달 */}
      <Modal
        open={!!confirmPkg}
        onClose={() => setConfirmPkg(null)}
        title="크레딧 충전 확인"
      >
        {confirmPkg && (
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">패키지</span>
                <span className="font-semibold text-text-primary">{confirmPkg.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">충전 크레딧</span>
                <span className="font-semibold text-text-primary">
                  {confirmPkg.credits.toLocaleString()} 크레딧
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">금액</span>
                <span className="font-semibold text-text-primary">
                  ₩{confirmPkg.priceKrw.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[12px] text-amber-800">
              결제 PG 연동 전이므로 즉시 충전됩니다. 실제 결제는 별도 입금/계산서 처리됩니다.
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmPkg(null)}>취소</Button>
              <Button
                onClick={() => purchaseMut.mutate(confirmPkg)}
                disabled={purchaseMut.isPending}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {purchaseMut.isPending ? '처리 중...' : '충전'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
