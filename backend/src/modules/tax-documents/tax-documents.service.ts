import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { addDays, format, differenceInDays, startOfYear, endOfYear } from 'date-fns';
import { Salary } from '../../database/entities/salary.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';

// ── 4대보험 사업주 부담 요율 ────────────────────────────
// [유지보수] salary.service.ts의 RATE_YEAR/RATES와 항상 동기화 유지
// 요율 변경 시: salary.service.ts와 이 파일을 함께 수정 (docs/time-sensitive-maintenance.md)
const EMPLOYER_RATES = {
  nationalPension:     0.045,   // 4.5%  (2024~2026 동일)
  healthInsurance:     0.03545, // 3.545% (2024~2026 동일)
  careInsuranceRatio:  0.1295,  // 건강보험료 × 12.95% (2024~2026 동일)
  employmentInsurance: 0.009,   // 0.9% 150인 미만 (2024~2026 동일)
  industrialAccident:  0.009,   // 산재 평균 0.9% (업종별 상이 — 매년 3월 고용부 고시)
};

// ── 세무 캘린더 (고정 일정) ───────────────────────────────
interface TaxSchedule {
  id: string;
  category: 'tax' | 'labor' | 'insurance';
  title: string;
  description: string;
  month: number;
  day: number;
  applicableTo: 'all' | 'corporation' | 'individual';
}

const TAX_SCHEDULES: TaxSchedule[] = [
  // 원천세 — 매월 10일
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `withholding-${i + 1}`,
    category: 'tax' as const,
    title: `${i + 1}월 원천세 신고납부`,
    description: '직원 급여에서 원천징수한 소득세 신고 및 납부',
    month: i + 1,
    day: 10,
    applicableTo: 'all' as const,
  })),
  // 4대보험 — 매월 10일
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `insurance-${i + 1}`,
    category: 'insurance' as const,
    title: `${i + 1}월 4대보험료 납부`,
    description: '국민연금·건강보험·고용보험·산재보험 월 납부',
    month: i + 1,
    day: 10,
    applicableTo: 'all' as const,
  })),
  // 부가세
  { id: 'vat-q1', category: 'tax', title: '부가세 확정신고 (2기)', description: '전년 7~12월 부가가치세 확정신고납부', month: 1, day: 25, applicableTo: 'all' },
  { id: 'vat-q2', category: 'tax', title: '부가세 예정신고 (1기)', description: '1~3월 부가가치세 예정신고납부', month: 4, day: 25, applicableTo: 'all' },
  { id: 'vat-q3', category: 'tax', title: '부가세 확정신고 (1기)', description: '1~6월 부가가치세 확정신고납부', month: 7, day: 25, applicableTo: 'all' },
  { id: 'vat-q4', category: 'tax', title: '부가세 예정신고 (2기)', description: '7~9월 부가가치세 예정신고납부', month: 10, day: 25, applicableTo: 'all' },
  // 법인세
  { id: 'corporate-tax', category: 'tax', title: '법인세 신고납부', description: '전년도 법인세 신고 및 납부 (12월 결산법인)', month: 3, day: 31, applicableTo: 'corporation' },
  // 종합소득세
  { id: 'income-tax', category: 'tax', title: '종합소득세 신고납부', description: '전년도 종합소득세 신고 및 납부', month: 5, day: 31, applicableTo: 'individual' },
  // 연말정산
  { id: 'year-end', category: 'tax', title: '근로소득 연말정산 자료 제출', description: '직원 연말정산 원천징수 이행상황 신고', month: 3, day: 10, applicableTo: 'all' },
];

export interface TodoItem {
  id: string;
  category: 'tax' | 'labor' | 'insurance' | 'contract';
  title: string;
  description: string;
  dueDate: string;
  daysLeft: number;
  urgency: 'urgent' | 'warning' | 'normal';
  actionUrl?: string;
  actionLabel?: string;
}

@Injectable()
export class TaxDocumentsService {
  constructor(
    @InjectRepository(Salary) private salaryRepo: Repository<Salary>,
    @InjectRepository(User)   private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
  ) {}

  // ── 이번 달 할 일 목록 ──────────────────────────────────
  async getTodo(authUser: AuthenticatedUser): Promise<TodoItem[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lookAhead = addDays(today, 35); // 35일 이내 마감
    const items: TodoItem[] = [];

    // 1. 세무 고정 일정
    const year = now.getFullYear();
    for (const s of TAX_SCHEDULES) {
      const due = new Date(year, s.month - 1, s.day);
      const daysLeft = differenceInDays(due, today);
      if (daysLeft >= -3 && daysLeft <= 35) {
        items.push({
          id: s.id,
          category: s.category,
          title: s.title,
          description: s.description,
          dueDate: format(due, 'yyyy-MM-dd'),
          daysLeft,
          urgency: daysLeft <= 3 ? 'urgent' : daysLeft <= 7 ? 'warning' : 'normal',
          actionUrl: s.category === 'tax' ? '/tax-documents' : undefined,
          actionLabel: '서류 준비',
        });
      }
    }

    // 2. 최저시급 인상 확인 (1월)
    if (now.getMonth() === 0 && now.getDate() <= 15) {
      items.push({
        id: 'min-wage-check',
        category: 'labor',
        title: '최저시급 인상 확인',
        description: '새해 최저시급 적용 여부 급여 검토 필요',
        dueDate: format(new Date(year, 0, 15), 'yyyy-MM-dd'),
        daysLeft: differenceInDays(new Date(year, 0, 15), today),
        urgency: 'warning',
        actionUrl: '/salary',
        actionLabel: '급여 검토',
      });
    }

    // 3. 입사 후 14일 이내 4대보험 취득신고 미처리 직원
    const newHires = await this.userRepo.find({
      where: {
        companyId: authUser.companyId,
        joinedAt: MoreThanOrEqual(addDays(today, -14) as any),
      },
      select: ['id', 'name', 'joinedAt'],
    });
    for (const hire of newHires) {
      const joinDate = new Date(hire.joinedAt!);
      const deadline = addDays(joinDate, 14);
      const daysLeft = differenceInDays(deadline, today);
      if (daysLeft >= 0) {
        items.push({
          id: `insurance-acq-${hire.id}`,
          category: 'labor',
          title: `${hire.name} 4대보험 취득신고`,
          description: `입사일로부터 14일 이내 신고 필요 (마감: ${format(deadline, 'M월 d일')})`,
          dueDate: format(deadline, 'yyyy-MM-dd'),
          daysLeft,
          urgency: daysLeft <= 3 ? 'urgent' : 'warning',
          actionUrl: `/tax-documents?tab=insurance&userId=${hire.id}`,
          actionLabel: '신고서 보기',
        });
      }
    }

    // 4. 연차 소멸 30일 전 (입사일 기준 연차 만료)
    const allUsers = await this.userRepo.find({
      where: { companyId: authUser.companyId },
      select: ['id', 'name', 'joinedAt'],
    });
    for (const u of allUsers) {
      if (!u.joinedAt) continue;
      const joined = new Date(u.joinedAt);
      // 다음 입사 기념일 = 올해 또는 내년 기념일
      const anniversary = new Date(year, joined.getMonth(), joined.getDate());
      if (anniversary < today) anniversary.setFullYear(year + 1);
      const daysLeft = differenceInDays(anniversary, today);
      if (daysLeft <= 30 && daysLeft >= 0) {
        items.push({
          id: `leave-expire-${u.id}`,
          category: 'labor',
          title: `${u.name} 연차 소멸 예정`,
          description: `${format(anniversary, 'M월 d일')} 이전 미사용 연차 소멸`,
          dueDate: format(anniversary, 'yyyy-MM-dd'),
          daysLeft,
          urgency: daysLeft <= 7 ? 'urgent' : 'warning',
          actionUrl: '/vacations',
          actionLabel: '연차 현황',
        });
      }
    }

    // 정렬: 마감 임박 순
    return items.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  // ── 연간 세무 캘린더 ────────────────────────────────────
  getAnnualCalendar(year: number) {
    return TAX_SCHEDULES.map((s) => ({
      ...s,
      date: format(new Date(year, s.month - 1, s.day), 'yyyy-MM-dd'),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── 원천징수 영수증 HTML ─────────────────────────────────
  async getWithholdingTaxHtml(
    authUser: AuthenticatedUser,
    year: number,
    month: number,
    userId?: string,
  ): Promise<string> {
    const where: any = { companyId: authUser.companyId, year, month };
    if (userId) where.userId = userId;

    const salaries = await this.salaryRepo.find({
      where,
      relations: ['user'],
      order: { user: { name: 'ASC' } as any },
    });

    const company = await this.companyRepo.findOne({ where: { id: authUser.companyId } });
    if (!company) throw new NotFoundException('회사 정보 없음');

    const rows = salaries.map((s) => `
      <tr>
        <td>${s.user?.name ?? '-'}</td>
        <td>${(s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance + s.otherAllowance).toLocaleString()}</td>
        <td>${s.incomeTax.toLocaleString()}</td>
        <td>${s.localTax.toLocaleString()}</td>
        <td>${s.nationalPension.toLocaleString()}</td>
        <td>${s.healthInsurance.toLocaleString()}</td>
        <td>${s.careInsurance.toLocaleString()}</td>
        <td>${s.employmentInsurance.toLocaleString()}</td>
        <td>${(s.incomeTax + s.localTax + s.nationalPension + s.healthInsurance + s.careInsurance + s.employmentInsurance + s.otherDeduction).toLocaleString()}</td>
        <td>${(s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance + s.otherAllowance - s.incomeTax - s.localTax - s.nationalPension - s.healthInsurance - s.careInsurance - s.employmentInsurance - s.otherDeduction).toLocaleString()}</td>
      </tr>
    `).join('');

    const totals = salaries.reduce((acc, s) => ({
      gross: acc.gross + s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance + s.otherAllowance,
      incomeTax: acc.incomeTax + s.incomeTax,
      localTax: acc.localTax + s.localTax,
      nationalPension: acc.nationalPension + s.nationalPension,
      healthInsurance: acc.healthInsurance + s.healthInsurance,
      careInsurance: acc.careInsurance + s.careInsurance,
      employmentInsurance: acc.employmentInsurance + s.employmentInsurance,
      totalDeduction: acc.totalDeduction + s.incomeTax + s.localTax + s.nationalPension + s.healthInsurance + s.careInsurance + s.employmentInsurance + s.otherDeduction,
      netPay: acc.netPay + (s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance + s.otherAllowance - s.incomeTax - s.localTax - s.nationalPension - s.healthInsurance - s.careInsurance - s.employmentInsurance - s.otherDeduction),
    }), { gross: 0, incomeTax: 0, localTax: 0, nationalPension: 0, healthInsurance: 0, careInsurance: 0, employmentInsurance: 0, totalDeduction: 0, netPay: 0 });

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>원천징수이행상황신고서 ${year}년 ${month}월</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; padding: 20px; color: #111; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 12px; color: #444; margin-bottom: 16px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: right; white-space: nowrap; }
  th { background: #f0f0f0; text-align: center; font-weight: bold; }
  td:first-child { text-align: left; }
  .total-row { background: #fafafa; font-weight: bold; }
  .notice { margin-top: 16px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
  @media print {
    body { padding: 0; }
    button { display: none; }
  }
</style>
</head>
<body>
<h1>근로소득 원천징수이행상황</h1>
<p class="subtitle">${year}년 ${month}월 귀속 · 신고납부기한: ${year}년 ${month < 12 ? month + 1 : 1}월 10일</p>
<div class="meta">
  <span>사업장명: <strong>${company.name}</strong></span>
  <span>출력일: ${format(new Date(), 'yyyy-MM-dd')}</span>
  <span>대상 인원: ${salaries.length}명</span>
</div>
<table>
  <thead>
    <tr>
      <th>성명</th>
      <th>총지급액</th>
      <th>소득세</th>
      <th>지방세</th>
      <th>국민연금</th>
      <th>건강보험</th>
      <th>장기요양</th>
      <th>고용보험</th>
      <th>총공제액</th>
      <th>실지급액</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td>합 계</td>
      <td>${totals.gross.toLocaleString()}</td>
      <td>${totals.incomeTax.toLocaleString()}</td>
      <td>${totals.localTax.toLocaleString()}</td>
      <td>${totals.nationalPension.toLocaleString()}</td>
      <td>${totals.healthInsurance.toLocaleString()}</td>
      <td>${totals.careInsurance.toLocaleString()}</td>
      <td>${totals.employmentInsurance.toLocaleString()}</td>
      <td>${totals.totalDeduction.toLocaleString()}</td>
      <td>${totals.netPay.toLocaleString()}</td>
    </tr>
  </tbody>
</table>
<p class="notice">
  ※ 이 서류는 관리왕에서 자동 생성된 참고용 자료입니다. 실제 신고는 홈택스(hometax.go.kr)에서 진행하시기 바랍니다.<br>
  ※ 원천징수 신고납부 기한: 매월 10일 (반기납부 사업장 제외)
</p>
<script>window.print();</script>
</body>
</html>`;
  }

  // ── 4대보험 취득/상실 신고서 ───────────────────────────
  async getInsuranceFormHtml(
    authUser: AuthenticatedUser,
    targetUserId: string,
    formType: 'acquisition' | 'loss',
  ): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: targetUserId, companyId: authUser.companyId },
    });
    if (!user) throw new NotFoundException('직원 정보 없음');

    const company = await this.companyRepo.findOne({ where: { id: authUser.companyId } });
    if (!company) throw new NotFoundException('회사 정보 없음');

    // 최근 급여에서 기본급 가져오기
    const latestSalary = await this.salaryRepo.findOne({
      where: { companyId: authUser.companyId, userId: targetUserId },
      order: { year: 'DESC', month: 'DESC' },
    });

    const baseSalary = latestSalary?.baseSalary ?? 0;
    const eventDate = formType === 'acquisition'
      ? (user.joinedAt ? format(new Date(user.joinedAt), 'yyyy-MM-dd') : '-')
      : format(new Date(), 'yyyy-MM-dd');

    const typeLabel = formType === 'acquisition' ? '피보험자격 취득신고' : '피보험자격 상실신고';
    const dateLabel = formType === 'acquisition' ? '취득 일자' : '상실 일자';

    // 사업주 부담 4대보험 계산
    const np  = Math.round(baseSalary * EMPLOYER_RATES.nationalPension / 10) * 10;
    const hi  = Math.round(baseSalary * EMPLOYER_RATES.healthInsurance / 10) * 10;
    const ci  = Math.round(hi * EMPLOYER_RATES.careInsuranceRatio / 10) * 10;
    const ei  = Math.round(baseSalary * EMPLOYER_RATES.employmentInsurance / 10) * 10;
    const ia  = Math.round(baseSalary * EMPLOYER_RATES.industrialAccident / 10) * 10;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${typeLabel} — ${user.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: bold; background: #f0f0f0; padding: 6px 10px; margin-bottom: 8px; border-left: 3px solid #333; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 7px 10px; font-size: 11px; }
  th { background: #f8f8f8; font-weight: bold; width: 30%; text-align: left; }
  .insurance-table th { width: 25%; text-align: center; }
  .insurance-table td { text-align: right; }
  .notice { margin-top: 20px; font-size: 10px; color: #666; border: 1px solid #ccc; padding: 10px; background: #fafafa; }
  .stamp-area { text-align: right; margin-top: 16px; font-size: 11px; color: #888; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<h1>4대사회보험 ${typeLabel}</h1>

<div class="section">
  <div class="section-title">사업장 정보</div>
  <table>
    <tr><th>사업장명</th><td>${company.name}</td></tr>
    <tr><th>신고일</th><td>${format(new Date(), 'yyyy년 MM월 dd일')}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">피보험자 정보</div>
  <table>
    <tr><th>성명</th><td>${user.name}</td><th>부서</th><td>${user.department ?? '-'}</td></tr>
    <tr><th>직위</th><td>${user.position ?? '-'}</td><th>${dateLabel}</th><td>${eventDate}</td></tr>
    <tr><th>월 보수액 (기본급)</th><td colspan="3">${baseSalary.toLocaleString()} 원</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">4대보험 사업주 부담 예상 금액</div>
  <table class="insurance-table">
    <thead>
      <tr><th>보험 종류</th><th>요율</th><th>사업주 부담액</th></tr>
    </thead>
    <tbody>
      <tr><td>국민연금</td><td>4.5%</td><td>${np.toLocaleString()} 원</td></tr>
      <tr><td>건강보험</td><td>3.545%</td><td>${hi.toLocaleString()} 원</td></tr>
      <tr><td>장기요양보험</td><td>건강보험×12.95%</td><td>${ci.toLocaleString()} 원</td></tr>
      <tr><td>고용보험</td><td>0.9%</td><td>${ei.toLocaleString()} 원</td></tr>
      <tr><td>산재보험</td><td>0.9% (업종 평균)</td><td>${ia.toLocaleString()} 원</td></tr>
      <tr style="font-weight:bold; background:#f0f0f0"><td>합 계</td><td></td><td>${(np + hi + ci + ei + ia).toLocaleString()} 원</td></tr>
    </tbody>
  </table>
</div>

<div class="notice">
  ※ 이 서류는 관리왕에서 자동 생성된 참고용 초안입니다.<br>
  ※ 실제 신고는 4대사회보험 정보연계센터(4insure.or.kr) 또는 EDI를 통해 진행하시기 바랍니다.<br>
  ※ 취득신고 기한: 입사일로부터 14일 이내 / 상실신고 기한: 퇴사일이 속하는 달의 다음 달 15일 이내
</div>
<div class="stamp-area">사업주 확인 _______________</div>
<script>window.print();</script>
</body>
</html>`;
  }

  // ── 연말정산 자료 패키지 ────────────────────────────────
  async getYearEndSummaryHtml(authUser: AuthenticatedUser, year: number): Promise<string> {
    const salaries = await this.salaryRepo.find({
      where: { companyId: authUser.companyId, year },
      relations: ['user'],
      order: { user: { name: 'ASC' } as any, month: 'ASC' },
    });

    const company = await this.companyRepo.findOne({ where: { id: authUser.companyId } });
    if (!company) throw new NotFoundException('회사 정보 없음');

    // 직원별 연간 집계
    const byUser = new Map<string, {
      name: string;
      months: number;
      grossTotal: number;
      taxTotal: number;
      localTaxTotal: number;
      pensionTotal: number;
      healthTotal: number;
      careTotal: number;
      employmentTotal: number;
    }>();

    for (const s of salaries) {
      const key = s.userId;
      const gross = s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance + s.otherAllowance;
      if (!byUser.has(key)) {
        byUser.set(key, { name: s.user?.name ?? '-', months: 0, grossTotal: 0, taxTotal: 0, localTaxTotal: 0, pensionTotal: 0, healthTotal: 0, careTotal: 0, employmentTotal: 0 });
      }
      const u = byUser.get(key)!;
      u.months++;
      u.grossTotal += gross;
      u.taxTotal += s.incomeTax;
      u.localTaxTotal += s.localTax;
      u.pensionTotal += s.nationalPension;
      u.healthTotal += s.healthInsurance;
      u.careTotal += s.careInsurance;
      u.employmentTotal += s.employmentInsurance;
    }

    const rows = Array.from(byUser.values()).map((u) => `
      <tr>
        <td>${u.name}</td>
        <td>${u.months}개월</td>
        <td>${u.grossTotal.toLocaleString()}</td>
        <td>${u.taxTotal.toLocaleString()}</td>
        <td>${u.localTaxTotal.toLocaleString()}</td>
        <td>${u.pensionTotal.toLocaleString()}</td>
        <td>${u.healthTotal.toLocaleString()}</td>
        <td>${u.careTotal.toLocaleString()}</td>
        <td>${u.employmentTotal.toLocaleString()}</td>
        <td>${(u.taxTotal + u.localTaxTotal + u.pensionTotal + u.healthTotal + u.careTotal + u.employmentTotal).toLocaleString()}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${year}년 연말정산 자료 — ${company.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; padding: 20px; color: #111; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 6px; }
  .subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #555; padding: 5px 6px; text-align: right; white-space: nowrap; }
  th { background: #e8e8e8; text-align: center; font-weight: bold; }
  td:first-child, td:nth-child(2) { text-align: center; }
  .notice { margin-top: 14px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<h1>${year}년 근로소득 연간 집계 (연말정산 자료)</h1>
<p class="subtitle">세무사 제출용 참고 자료 · 제출 기한: ${year + 1}년 3월 10일</p>
<div class="meta">
  <span>사업장명: <strong>${company.name}</strong></span>
  <span>출력일: ${format(new Date(), 'yyyy-MM-dd')}</span>
  <span>대상 인원: ${byUser.size}명</span>
</div>
<table>
  <thead>
    <tr>
      <th>성명</th><th>지급월수</th><th>연간 총지급액</th>
      <th>소득세</th><th>지방소득세</th>
      <th>국민연금</th><th>건강보험</th><th>장기요양</th><th>고용보험</th>
      <th>총공제합계</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<p class="notice">
  ※ 이 자료는 관리왕에서 자동 생성된 참고용 자료입니다. 실제 연말정산은 홈택스(hometax.go.kr)에서 진행하시기 바랍니다.<br>
  ※ 의료비·교육비·기부금 등 추가 공제 항목은 직원 개인이 홈택스 간소화 서비스를 통해 제출해야 합니다.
</p>
<script>window.print();</script>
</body>
</html>`;
  }

  // ── 퇴직금 계산서 ─────────────────────────────────────
  async getRetirementPayHtml(authUser: AuthenticatedUser, targetUserId: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: targetUserId, companyId: authUser.companyId },
    });
    if (!user) throw new NotFoundException('직원 정보 없음');
    if (!user.joinedAt) throw new ForbiddenException('입사일 정보 없음');

    const company = await this.companyRepo.findOne({ where: { id: authUser.companyId } });
    const today = new Date();
    const joinDate = new Date(user.joinedAt);
    const serviceYears = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (serviceYears < 1) {
      return `<html><body style="font-family:sans-serif;padding:24px"><h2>퇴직금 미발생</h2><p>퇴직금은 계속근로기간 1년 이상인 경우에만 발생합니다. (현재 ${(serviceYears * 12).toFixed(1)}개월 근무)</p></body></html>`;
    }

    // 최근 3개월 급여 평균으로 평균임금 계산
    const recentSalaries = await this.salaryRepo.find({
      where: { companyId: authUser.companyId, userId: targetUserId },
      order: { year: 'DESC', month: 'DESC' },
      take: 3,
    });

    const avgMonthly = recentSalaries.length > 0
      ? recentSalaries.reduce((sum, s) => sum + s.baseSalary + s.overtimePay + s.holidayPay + s.bonus + s.mealAllowance + s.transportAllowance, 0) / recentSalaries.length
      : 0;

    const dailyAvg = avgMonthly / 30;
    const retirementPay = Math.round(dailyAvg * 30 * serviceYears);

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>퇴직금 계산서 — ${user.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; padding: 24px; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #999; padding: 8px 12px; }
  th { background: #f0f0f0; width: 40%; font-weight: bold; }
  .total-row { background: #fff8e1; font-weight: bold; font-size: 14px; }
  .notice { font-size: 10px; color: #666; border: 1px solid #ddd; padding: 10px; background: #fafafa; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<h1>퇴직금 계산서</h1>
<table>
  <tr><th>성명</th><td>${user.name}</td></tr>
  <tr><th>부서/직위</th><td>${user.department ?? '-'} / ${user.position ?? '-'}</td></tr>
  <tr><th>입사일</th><td>${format(joinDate, 'yyyy년 MM월 dd일')}</td></tr>
  <tr><th>계산 기준일</th><td>${format(today, 'yyyy년 MM월 dd일')}</td></tr>
  <tr><th>계속근로연수</th><td>${serviceYears.toFixed(2)}년 (${Math.floor(serviceYears)}년 ${Math.round((serviceYears % 1) * 12)}개월)</td></tr>
  <tr><th>최근 3개월 평균임금</th><td>${avgMonthly.toLocaleString()} 원/월</td></tr>
  <tr><th>1일 평균임금</th><td>${Math.round(dailyAvg).toLocaleString()} 원</td></tr>
  <tr class="total-row"><th>퇴직금 예상액</th><td>${retirementPay.toLocaleString()} 원</td></tr>
</table>
<p style="font-size:11px;margin-bottom:8px;color:#555">계산식: 1일 평균임금 × 30일 × 계속근로연수</p>
<div class="notice">
  ※ 이 금액은 관리왕 자동 계산 참고치입니다. 실제 퇴직금은 세금(퇴직소득세)이 별도 공제됩니다.<br>
  ※ 퇴직금 지급 기한: 퇴직일로부터 14일 이내 (합의 시 연장 가능)
</div>
<script>window.print();</script>
</body>
</html>`;
  }
}
