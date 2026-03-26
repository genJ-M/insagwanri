'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer, ChevronDown, Building2, User as UserIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type CertType = 'employment' | 'career';

interface CertData {
  issueDate: string;
  type: string;
  employee: {
    name: string;
    employeeNumber: string | null;
    department: string | null;
    position: string | null;
    joinedAt: string | null;
    email: string;
  };
  company: {
    name: string;
    businessNumber: string | null;
    address: string | null;
    phone: string | null;
  };
  tenure?: { years: number; months: number } | null;
}

const CERT_TYPES: { id: CertType; label: string; desc: string }[] = [
  { id: 'employment', label: '재직증명서', desc: '현재 재직 중임을 증명합니다.' },
  { id: 'career',     label: '경력증명서', desc: '근무 이력 및 재직 기간을 증명합니다.' },
];

// ─── 증명서 템플릿 ────────────────────────────────────
function CertificateTemplate({ data }: { data: CertData }) {
  const isCareer = data.type === 'career';
  const issueYear  = data.issueDate.split('-')[0];
  const issueMonth = data.issueDate.split('-')[1];
  const issueDay   = data.issueDate.split('-')[2];

  const joinedDateStr = data.employee.joinedAt
    ? (() => {
        const [y, m, d] = data.employee.joinedAt.split('-');
        return `${y}년 ${m}월 ${d}일`;
      })()
    : '확인 불가';

  return (
    <div
      id="certificate-print-area"
      className="bg-white p-10 font-serif"
      style={{ width: '595px', minHeight: '842px', fontFamily: '"Noto Serif KR", serif' }}
    >
      {/* 헤더 */}
      <div className="text-center mb-12">
        <div className="w-20 h-1 bg-gray-900 mx-auto mb-6" />
        <h1 className="text-3xl font-bold tracking-widest text-gray-900 mb-2">
          {isCareer ? '경 력 증 명 서' : '재 직 증 명 서'}
        </h1>
        <div className="w-20 h-1 bg-gray-900 mx-auto mt-4" />
      </div>

      {/* 인적사항 */}
      <table className="w-full border-collapse mb-8 text-[14px]">
        <tbody>
          {[
            { label: '성       명', value: data.employee.name },
            { label: '사  원  번  호', value: data.employee.employeeNumber ?? '—' },
            { label: '소 속 부 서', value: data.employee.department ?? '—' },
            { label: '직       위', value: data.employee.position ?? '—' },
            { label: '입  사  일', value: joinedDateStr },
            ...(isCareer && data.tenure
              ? [{ label: '근 속 기 간', value: `${data.tenure.years}년 ${data.tenure.months}개월` }]
              : []),
          ].map(row => (
            <tr key={row.label} className="border border-gray-300">
              <td className="bg-gray-50 px-5 py-3 font-semibold text-gray-700 w-40 border-r border-gray-300 text-center tracking-wider">
                {row.label}
              </td>
              <td className="px-5 py-3 text-gray-900">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 증명 내용 */}
      <div className="text-center my-10 leading-loose">
        <p className="text-[15px] text-gray-800">
          위 사람은 현재{' '}
          <span className="font-bold text-gray-900 underline decoration-gray-400">
            {data.company.name}
          </span>
          에{isCareer ? ' 재직한 사실이 있음을' : ' 재직 중임을'} 증명합니다.
        </p>
      </div>

      {/* 발급일 */}
      <div className="text-center my-10">
        <p className="text-[15px] text-gray-800 tracking-wider">
          {issueYear}년 &nbsp; {issueMonth}월 &nbsp; {issueDay}일
        </p>
      </div>

      {/* 발급기관 */}
      <div className="text-center mt-12">
        <p className="text-[16px] font-bold text-gray-900 tracking-widest mb-4">
          {data.company.name}
        </p>
        {data.company.businessNumber && (
          <p className="text-[12px] text-gray-500">사업자등록번호: {data.company.businessNumber}</p>
        )}
        {data.company.address && (
          <p className="text-[12px] text-gray-500">{data.company.address}</p>
        )}
        {data.company.phone && (
          <p className="text-[12px] text-gray-500">전화: {data.company.phone}</p>
        )}
        {/* 직인 영역 */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="text-[14px] text-gray-700">대표자</span>
          <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
            <span className="text-[11px] text-red-400 font-bold">직인</span>
          </div>
        </div>
      </div>

      {/* 하단 주의문구 */}
      <div className="mt-12 pt-4 border-t border-gray-200 text-center">
        <p className="text-[11px] text-gray-400">
          본 증명서는 관리왕 시스템에서 발급되었으며, 발급일 기준의 정보를 기재합니다.
        </p>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────
export default function CertificatesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'owner' || user?.role === 'manager';

  const [selectedUserId, setSelectedUserId] = useState(user?.id ?? '');
  const [certType, setCertType] = useState<CertType>('employment');
  const [certData, setCertData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users?limit=200').then(r => r.data.data?.users ?? []),
    enabled: isAdmin,
  });

  const handleGenerate = async () => {
    const targetId = isAdmin ? selectedUserId : (user?.id ?? '');
    if (!targetId) { toast.error('직원을 선택하세요.'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/users/${targetId}/certificate?type=${certType}`);
      setCertData(res.data.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '데이터 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const area = document.getElementById('certificate-print-area');
    if (!area) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${certType === 'employment' ? '재직증명서' : '경력증명서'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Noto Serif KR', serif; }
          @page { size: A4; margin: 0; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>${area.outerHTML}</body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-[20px] font-bold text-gray-900">증명서 발급</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">재직증명서 및 경력증명서를 발급합니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto grid lg:grid-cols-[320px_1fr] gap-6">

          {/* 좌측 설정 패널 */}
          <div className="space-y-4">
            {/* 직원 선택 (관리자) */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <label className="block text-[12px] font-semibold text-gray-500 mb-2">직원 선택</label>
                <select
                  value={selectedUserId}
                  onChange={e => { setSelectedUserId(e.target.value); setCertData(null); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-primary-400"
                >
                  <option value="">직원 선택</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.department ? `(${u.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 증명서 유형 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <label className="block text-[12px] font-semibold text-gray-500 mb-3">증명서 유형</label>
              <div className="space-y-2">
                {CERT_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => { setCertType(ct.id); setCertData(null); }}
                    className={clsx(
                      'w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all',
                      certType === ct.id
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <FileText className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', certType === ct.id ? 'text-primary-500' : 'text-gray-400')} />
                    <div>
                      <p className={clsx('text-[13px] font-semibold', certType === ct.id ? 'text-primary-700' : 'text-gray-800')}>
                        {ct.label}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{ct.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={loading || (isAdmin && !selectedUserId)}
              className="w-full py-3 rounded-xl bg-primary-500 text-white text-[14px] font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {loading ? '생성 중...' : '증명서 생성'}
            </button>

            {certData && (
              <button
                onClick={handlePrint}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-semibold hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                인쇄 / PDF 저장
              </button>
            )}

            {/* 주의사항 */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[12px] font-semibold text-amber-800 mb-1">발급 안내</p>
              <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
                <li>발급일 기준 정보가 기재됩니다.</li>
                <li>직인은 출력 후 날인이 필요합니다.</li>
                <li>직원 정보 오류 시 설정에서 수정하세요.</li>
              </ul>
            </div>
          </div>

          {/* 우측 미리보기 */}
          <div>
            {certData ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-semibold text-gray-700">미리보기</p>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    인쇄
                  </button>
                </div>
                <div className="overflow-x-auto p-4 bg-gray-100 flex justify-center">
                  <div className="shadow-xl">
                    <CertificateTemplate data={certData} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-20 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-[14px] font-semibold text-gray-500">증명서를 생성해주세요</p>
                <p className="text-[12px] text-gray-400 mt-1">
                  {isAdmin ? '직원을 선택하고 유형을 선택 후' : '유형을 선택 후'} 생성 버튼을 누르세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
