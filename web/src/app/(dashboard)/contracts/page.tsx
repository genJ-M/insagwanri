'use client';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileSignature, Plus, X, Trash2, AlertTriangle,
  XCircle, ExternalLink, Pencil, FileText, Coins,
  Scan, ChevronDown, ChevronUp, ShoppingCart, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── 타입 ────────────────────────────────────────────
type ContractType = 'employment' | 'part_time' | 'contract' | 'nda' | 'other';
type ContractStatus = 'active' | 'expired' | 'terminated';
type JobCategory = 'management' | 'sales' | 'development' | 'design' | 'finance' | 'hr' | 'production' | 'logistics' | 'customer' | 'research' | 'legal' | 'other';

interface Contract {
  id: string;
  type: ContractType;
  title: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  terminatedAt: string | null;
  terminateReason: string | null;
  daysLeft: number | null;
  isExpiringSoon: boolean;
  createdAt: string;
  jobCategory: JobCategory | null;
  jobDescription: string | null;
  workLocation: string | null;
  monthlySalary: number | null;
  annualSalary: number | null;
  salaryDetail: Record<string, number> | null;
  weeklyHours: number | null;
  templateId: string | null;
  ocrText: string | null;
  user: { id: string; name: string; department: string | null; position: string | null } | null;
}

interface Template {
  id: string;
  name: string;
  type: string;
  jobCategory: string;
  description: string;
  weeklyHours: number;
}

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

// ─── 상수 ────────────────────────────────────────────
const TYPE_LABELS: Record<ContractType, string> = {
  employment: '근로계약', part_time: '단시간근로',
  contract: '용역계약', nda: '비밀유지', other: '기타',
};
const TYPE_COLORS: Record<ContractType, string> = {
  employment: 'bg-blue-50 text-blue-700',
  part_time:  'bg-violet-50 text-violet-700',
  contract:   'bg-teal-50 text-teal-700',
  nda:        'bg-orange-50 text-orange-700',
  other:      'bg-gray-100 text-gray-600',
};
const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string }> = {
  active:     { label: '유효',   color: 'bg-emerald-50 text-emerald-700' },
  expired:    { label: '만료',   color: 'bg-gray-100 text-gray-500' },
  terminated: { label: '해지',   color: 'bg-red-50 text-red-600' },
};
const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  management: '경영·관리', sales: '영업·마케팅', development: 'IT·개발',
  design: '디자인', finance: '재무·회계', hr: '인사·총무',
  production: '생산·제조', logistics: '물류·운송', customer: '고객지원',
  research: '연구개발', legal: '법무', other: '기타',
};

const CREDIT_COSTS = { OCR: 2, AI_CLASSIFY: 1, AI_ANALYZE: 3, AI_REPORT: 3 };

// ─── 크레딧 배지 ─────────────────────────────────────
function CreditBadge({ balance }: { balance: number }) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold',
      balance <= 5 ? 'border-red-200 bg-red-50 text-red-600' :
      balance <= 20 ? 'border-amber-200 bg-amber-50 text-amber-700' :
      'border-teal-200 bg-teal-50 text-teal-700',
    )}>
      <Coins className="w-3.5 h-3.5" />
      {balance} 크레딧
    </div>
  );
}

// ─── 크레딧 구매 모달 ────────────────────────────────
function CreditPurchaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState('');
  const { data: packages = [] } = useQuery<CreditPackage[]>({
    queryKey: ['credit-packages'],
    queryFn: () => api.get('/credits/packages').then(r => r.data.data),
  });

  const handlePurchase = async (pkg: CreditPackage) => {
    setLoading(pkg.id);
    try {
      await api.post('/credits/purchase', { package_id: pkg.id, credits: pkg.credits });
      toast.success(`${pkg.credits} 크레딧이 충전되었습니다!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '충전 실패');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">크레딧 구매</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">OCR·AI 기능에 사용되는 크레딧입니다.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-6 py-4 space-y-2.5">
          {/* 사용처 안내 */}
          <div className="bg-gray-50 rounded-xl p-3 mb-1">
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">크레딧 사용처</p>
            <div className="space-y-1">
              {Object.entries({ 'OCR (이미지→텍스트)': CREDIT_COSTS.OCR, 'AI 업무 분류': CREDIT_COSTS.AI_CLASSIFY, 'AI 계약서 분석': CREDIT_COSTS.AI_ANALYZE, 'AI 보고서 초안': CREDIT_COSTS.AI_REPORT }).map(([label, cost]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-600">{label}</span>
                  <span className="text-[11px] font-bold text-teal-600">{cost} 크레딧</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">· 월 무료 지급: 가입 플랜에 따라 20~200 크레딧<br/>· 개인 일일 한도: 최대 20 크레딧/일</p>
          </div>

          {packages.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg)}
              disabled={loading === pkg.id}
              className="w-full flex items-center justify-between px-4 py-3 border-2 border-gray-100 hover:border-primary-300 hover:bg-primary-50 rounded-xl transition-all group"
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-gray-800 group-hover:text-primary-700">{pkg.label}</span>
                  {pkg.badge && (
                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full">{pkg.badge}</span>
                  )}
                </div>
                <span className="text-[11px] text-gray-400">{pkg.perUnit}</span>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-primary-600">₩{pkg.priceKrw.toLocaleString()}</p>
                {loading === pkg.id && <p className="text-[10px] text-gray-400">처리 중...</p>}
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 pb-5">
          <p className="text-center text-[10px] text-gray-400">
            * 실결제 연동 전 테스트 버전입니다. 실제 결제가 발생하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 템플릿 선택 모달 ────────────────────────────────
function TemplatePickerModal({
  onSelect, onClose,
}: {
  onSelect: (template: any) => void;
  onClose: () => void;
}) {
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contracts/templates').then(r => r.data.data),
  });
  const [selected, setSelected] = useState<string>('');

  const handleApply = async () => {
    if (!selected) { toast.error('템플릿을 선택하세요.'); return; }
    const detail = await api.get(`/contracts/templates/${selected}`).then(r => r.data.data);
    onSelect(detail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">계약서 템플릿 선택</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">표준 근로계약서 템플릿을 선택하면 내용이 자동으로 채워집니다.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={clsx(
                'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                selected === t.id
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span className="text-[13px] font-bold text-gray-800">{t.name}</span>
                {selected === t.id && <CheckCircle2 className="w-4 h-4 text-primary-500 ml-auto" />}
              </div>
              <p className="text-[11px] text-gray-500 ml-6">{t.description}</p>
              <div className="flex items-center gap-2 mt-1 ml-6">
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', TYPE_COLORS[t.type as ContractType] ?? 'bg-gray-100 text-gray-500')}>
                  {TYPE_LABELS[t.type as ContractType] ?? t.type}
                </span>
                {t.weeklyHours > 0 && (
                  <span className="text-[10px] text-gray-400">주 {t.weeklyHours}시간</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 px-6 pb-5 border-t border-gray-100 pt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleApply} className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600">
            템플릿 적용
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 계약 등록/수정 폼 ───────────────────────────────
function ContractForm({
  users, editItem, creditBalance, onClose, onSuccess,
}: {
  users: any[];
  editItem?: Contract;
  creditBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [userId, setUserId] = useState(editItem?.user?.id ?? '');
  const [type, setType] = useState<ContractType>(editItem?.type ?? 'employment');
  const [title, setTitle] = useState(editItem?.title ?? '');
  const [startDate, setStartDate] = useState(editItem?.startDate ?? '');
  const [endDate, setEndDate] = useState(editItem?.endDate ?? '');
  const [fileUrl, setFileUrl] = useState(editItem?.fileUrl ?? '');
  const [fileName, setFileName] = useState(editItem?.fileName ?? '');
  const [note, setNote] = useState(editItem?.note ?? '');
  const [jobCategory, setJobCategory] = useState<JobCategory | ''>(editItem?.jobCategory ?? '');
  const [jobDescription, setJobDescription] = useState(editItem?.jobDescription ?? '');
  const [workLocation, setWorkLocation] = useState(editItem?.workLocation ?? '');
  const [monthlySalary, setMonthlySalary] = useState(editItem?.monthlySalary?.toString() ?? '');
  const [weeklyHours, setWeeklyHours] = useState(editItem?.weeklyHours?.toString() ?? '');
  const [templateId, setTemplateId] = useState(editItem?.templateId ?? '');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [ocrText, setOcrText] = useState(editItem?.ocrText ?? '');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const annualSalary = monthlySalary ? parseInt(monthlySalary) * 12 : 0;

  const handleTemplate = (tmpl: any) => {
    setType(tmpl.type as ContractType);
    setJobCategory(tmpl.jobCategory as JobCategory);
    setWeeklyHours(tmpl.weeklyHours?.toString() ?? '');
    setNote(tmpl.content ?? '');
    setTemplateId(tmpl.id);
    if (!title) setTitle(tmpl.name);
  };

  const handleOcr = async (file: File) => {
    if (creditBalance < CREDIT_COSTS.OCR) {
      toast.error(`OCR에 ${CREDIT_COSTS.OCR} 크레딧이 필요합니다. 현재 잔액: ${creditBalance}크레딧`);
      return;
    }
    setOcrLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/contracts/ocr', {
        image_base64: base64,
        mime_type: file.type,
        contract_id: editItem?.id,
      });
      const text: string = res.data.data.ocr_text;
      setOcrText(text);
      // OCR 결과를 note에 추가
      setNote(prev => prev ? `${prev}\n\n---\n**OCR 추출 텍스트:**\n${text}` : text);
      toast.success('이미지에서 텍스트를 추출했습니다. (2 크레딧 차감)');
      onSuccess(); // 크레딧 잔액 갱신
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'OCR 실패');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!editItem && !userId) { toast.error('직원을 선택하세요.'); return; }
    if (!title.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!startDate) { toast.error('계약 시작일을 입력하세요.'); return; }
    setLoading(true);
    try {
      const body = {
        ...(editItem ? {} : { user_id: userId }),
        type, title,
        start_date: startDate,
        end_date: endDate || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
        note: note || undefined,
        job_category: jobCategory || undefined,
        job_description: jobDescription || undefined,
        work_location: workLocation || undefined,
        monthly_salary: monthlySalary ? parseInt(monthlySalary) : undefined,
        annual_salary: annualSalary || undefined,
        weekly_hours: weeklyHours ? parseInt(weeklyHours) : undefined,
        template_id: templateId || undefined,
      };
      if (editItem) {
        await api.patch(`/contracts/${editItem.id}`, body);
      } else {
        await api.post('/contracts', body);
      }
      toast.success(editItem ? '수정되었습니다.' : '계약이 등록되었습니다.');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-gray-900">{editItem ? '계약 수정' : '계약 등록'}</h2>
              {templateId && (
                <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[11px] font-semibold rounded-lg border border-primary-100">
                  📄 템플릿 적용됨
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* 템플릿 선택 버튼 */}
            {!editItem && (
              <div className="bg-gradient-to-r from-primary-50 to-teal-50 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-gray-700">표준 계약서 템플릿</p>
                  <p className="text-[11px] text-gray-500">근로계약서 표준 양식을 선택해 자동으로 내용을 채웁니다.</p>
                </div>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0 ml-3"
                >
                  <FileText className="w-3.5 h-3.5 text-primary-500" />
                  템플릿 선택
                </button>
              </div>
            )}

            {/* 직원 선택 */}
            {!editItem && (
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">직원</label>
                <select value={userId} onChange={e => setUserId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400">
                  <option value="">직원 선택</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 유형</label>
                <select value={type} onChange={e => setType(e.target.value as ContractType)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">직무 카테고리</label>
                <select value={jobCategory} onChange={e => setJobCategory(e.target.value as JobCategory)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400">
                  <option value="">선택 안함</option>
                  {Object.entries(JOB_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약명</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 2026년 정규직 근로계약"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 시작일</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약 종료일 <span className="text-gray-300 font-normal">(무기한 시 공란)</span></label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
              </div>
            </div>

            {/* 급여 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">월 기본급 (원)</label>
                <input
                  type="number" value={monthlySalary}
                  onChange={e => setMonthlySalary(e.target.value)}
                  placeholder="예: 3000000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
                />
                {annualSalary > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">연봉 {(annualSalary / 10000).toFixed(0)}만원</p>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">주 소정 근로 시간</label>
                <input
                  type="number" value={weeklyHours} min={1} max={52}
                  onChange={e => setWeeklyHours(e.target.value)}
                  placeholder="40"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>

            {/* 추가 정보 토글 */}
            <button
              type="button"
              onClick={() => setShowExtra(v => !v)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700"
            >
              {showExtra ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showExtra ? '추가 정보 접기' : '추가 정보 (근무지·업무내용·파일)'}
            </button>

            {showExtra && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">근무 장소</label>
                  <input value={workLocation} onChange={e => setWorkLocation(e.target.value)}
                    placeholder="예: 서울특별시 강남구 테헤란로 123"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">업무 내용</label>
                  <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={2}
                    placeholder="담당 업무를 입력하세요"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">파일 URL</label>
                    <input value={fileUrl} onChange={e => setFileUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">파일명</label>
                    <input value={fileName} onChange={e => setFileName(e.target.value)}
                      placeholder="계약서.pdf"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400" />
                  </div>
                </div>

                {/* OCR 이미지 업로드 */}
                <div className="border border-dashed border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[12px] font-semibold text-gray-600">계약서 이미지 → 텍스트 변환 (OCR)</p>
                      <p className="text-[11px] text-gray-400">JPG·PNG·WEBP 이미지를 업로드하면 텍스트로 추출합니다.</p>
                    </div>
                    <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">{CREDIT_COSTS.OCR} 크레딧/장</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleOcr(f); }} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={ocrLoading || creditBalance < CREDIT_COSTS.OCR}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-[12px] font-semibold hover:bg-teal-100 disabled:opacity-50"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      {ocrLoading ? 'OCR 처리 중...' : '이미지 선택'}
                    </button>
                    {creditBalance < CREDIT_COSTS.OCR && (
                      <span className="text-[11px] text-red-500">크레딧 부족</span>
                    )}
                  </div>
                  {ocrText && (
                    <div className="mt-2 max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2">
                      <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{ocrText.slice(0, 300)}{ocrText.length > 300 ? '...' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 계약서 내용 */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">계약서 내용</label>
              <RichTextEditor
                value={note}
                onChange={setNote}
                placeholder="계약서 내용을 입력하거나 템플릿을 선택하세요"
                minHeight={120}
              />
            </div>
          </div>

          <div className="flex gap-2 px-6 pb-6 border-t border-gray-100 pt-4">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>

      {showTemplatePicker && (
        <TemplatePickerModal
          onSelect={handleTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </>
  );
}

// ─── 메인 ─────────────────────────────────────────────
export default function ContractsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [jobCategoryFilter, setJobCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Contract | undefined>();
  const [showPurchase, setShowPurchase] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contracts'] });
    qc.invalidateQueries({ queryKey: ['credit-balance'] });
  };

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts', statusFilter, typeFilter, jobCategoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (jobCategoryFilter) params.set('job_category', jobCategoryFilter);
      return api.get(`/contracts${params.toString() ? `?${params}` : ''}`).then(r => r.data.data);
    },
  });

  const { data: creditData } = useQuery<CreditBalance>({
    queryKey: ['credit-balance'],
    queryFn: () => api.get('/credits/balance').then(r => r.data.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users?limit=200').then(r => r.data.data?.users ?? []),
    enabled: isAdmin,
  });

  const terminateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/contracts/${id}/terminate`, { reason }),
    onSuccess: () => { toast.success('계약이 해지되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '해지에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => { toast.success('삭제되었습니다.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const handleTerminate = (id: string) => {
    const reason = window.prompt('해지 사유를 입력하세요 (선택):');
    if (reason === null) return;
    terminateMutation.mutate({ id, reason: reason || undefined });
  };

  const expiringSoon = contracts.filter(c => c.isExpiringSoon && c.status === 'active');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold text-gray-900">계약 관리</h1>
              {expiringSoon.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  <AlertTriangle className="w-3 h-3" />
                  {expiringSoon.length}건 만료예정
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">근로계약서를 등록·관리하고 만료일을 추적합니다.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* 크레딧 잔액 */}
            {creditData && <CreditBadge balance={creditData.balance} />}
            {isAdmin && (
              <button
                onClick={() => setShowPurchase(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                구매
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setEditItem(undefined); setShowForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
              >
                <Plus className="w-4 h-4" />
                계약 등록
              </button>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
            <option value="">전체 상태</option>
            <option value="active">유효</option>
            <option value="expired">만료</option>
            <option value="terminated">해지</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
            <option value="">전체 유형</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={jobCategoryFilter} onChange={e => setJobCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-primary-400">
            <option value="">전체 직무</option>
            {Object.entries(JOB_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* 크레딧 안내 */}
        {creditData && creditData.balance <= 5 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            크레딧이 거의 소진되었습니다. OCR·AI 기능 사용을 위해 충전이 필요합니다.
            <button onClick={() => setShowPurchase(true)} className="font-bold underline ml-1">충전하기</button>
          </div>
        )}
      </div>

      {/* 만료 예정 배너 */}
      {expiringSoon.length > 0 && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-[13px] font-bold text-amber-800">30일 이내 만료 예정 계약 ({expiringSoon.length}건)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(c => (
              <span key={c.id} className="px-2.5 py-1 bg-amber-100 rounded-lg text-[12px] font-semibold text-amber-700">
                {c.user?.name} · {c.title} · D-{c.daysLeft}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 계약 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-48" />
                    <div className="h-2.5 bg-gray-100 rounded w-64" />
                  </div>
                </div>
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="py-16 text-center">
              <FileSignature className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">등록된 계약이 없습니다.</p>
              {isAdmin && (
                <button onClick={() => setShowForm(true)}
                  className="mt-3 text-[13px] text-primary-500 font-semibold hover:underline">
                  계약 등록하기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {contracts.map(c => {
                const sCfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.id} className={clsx('px-5 py-4 hover:bg-gray-50', c.isExpiringSoon && c.status === 'active' && 'bg-amber-50/30')}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-[13px] font-bold text-primary-600 flex-shrink-0">
                          {c.user?.name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {c.user && <span className="text-[13px] font-bold text-gray-900">{c.user.name}</span>}
                            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', TYPE_COLORS[c.type])}>
                              {TYPE_LABELS[c.type]}
                            </span>
                            {c.jobCategory && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                                {JOB_CATEGORY_LABELS[c.jobCategory]}
                              </span>
                            )}
                            <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', sCfg.color)}>
                              {sCfg.label}
                            </span>
                            {c.isExpiringSoon && c.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                D-{c.daysLeft}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-semibold text-gray-700 truncate">{c.title}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[12px] text-gray-400 flex-wrap">
                            <span>{c.startDate} ~ {c.endDate ?? '무기한'}</span>
                            {c.user?.department && <span>{c.user.department}</span>}
                            {c.monthlySalary && (
                              <span className="text-emerald-600 font-semibold">
                                월 {(c.monthlySalary / 10000).toFixed(0)}만원
                              </span>
                            )}
                            {c.weeklyHours && <span>주{c.weeklyHours}시간</span>}
                            {c.workLocation && <span className="truncate max-w-[160px]">{c.workLocation}</span>}
                          </div>
                          {c.ocrText && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                              <Scan className="w-3 h-3" />
                              OCR 텍스트 포함
                            </span>
                          )}
                          {c.terminateReason && (
                            <p className="text-[12px] text-red-400 mt-0.5">해지사유: {c.terminateReason}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.fileUrl && (
                          <a href={c.fileUrl} target="_blank" rel="noopener noreferrer"
                            title="파일 보기"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {isAdmin && c.status === 'active' && (
                          <>
                            <button
                              onClick={() => { setEditItem(c); setShowForm(true); }}
                              title="수정"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTerminate(c.id)}
                              title="해지"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-400">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isAdmin && c.status !== 'active' && (
                          <button
                            onClick={() => { if (window.confirm('삭제할까요?')) deleteMutation.mutate(c.id); }}
                            title="삭제"
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <ContractForm
          users={users}
          editItem={editItem}
          creditBalance={creditData?.balance ?? 0}
          onClose={() => { setShowForm(false); setEditItem(undefined); }}
          onSuccess={invalidate}
        />
      )}

      {showPurchase && (
        <CreditPurchaseModal
          onClose={() => setShowPurchase(false)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
