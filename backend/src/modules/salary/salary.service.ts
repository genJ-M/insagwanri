import {
  Injectable, ConflictException, NotFoundException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salary, SalaryStatus } from '../../database/entities/salary.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateSalaryDto, UpdateSalaryDto, SalaryQueryDto, AutoCalculateDto,
} from './dto/salary.dto';

// ── 연도별 최저시급 (원) ─────────────────────────────────
// [유지보수] 매년 8월 고용노동부 고시 → 다음해 1월 1일 적용
// 새 연도 확정 시: MIN_WAGE_TABLE에 항목 추가 (docs/time-sensitive-maintenance.md)
const MIN_WAGE_TABLE: Record<number, number> = {
  2024: 9_860,
  2025: 10_030,
  2026: 10_030, // 2026년 확정값 (2025년과 동일)
};
/** 해당 연도 최저시급 (없으면 가장 최근 연도 값) */
function getMinWage(year: number): number {
  if (MIN_WAGE_TABLE[year]) return MIN_WAGE_TABLE[year];
  const latest = Math.max(...Object.keys(MIN_WAGE_TABLE).map(Number).filter((y) => y <= year));
  return MIN_WAGE_TABLE[latest] ?? MIN_WAGE_TABLE[2025];
}
/** 월 소정근로시간 (주 40h × 4.345주) = 209h */
const MONTHLY_WORK_HOURS = 209;

// ── 4대보험 요율 (근로자 부담분) ────────────────────────
// [유지보수] 매년 초 건강보험공단·고용부 고시 확인 후 갱신
// 요율 변경 시: 아래 값 + RATE_YEAR 를 함께 수정 (docs/time-sensitive-maintenance.md)
/** 현재 요율이 적용되는 기준 연도 — 요율 변경 시 반드시 같이 수정 */
export const RATE_YEAR = 2026;
const RATES = {
  nationalPension:      0.045,   // 4.5%  (2024~2026 동일)
  healthInsurance:      0.03545, // 3.545% (2024~2026 동일)
  careInsuranceRatio:   0.1295,  // 장기요양 = 건강보험료 × 12.95% (2024~2026 동일)
  employmentInsurance:  0.009,   // 0.9%  (2024~2026 동일)
};

/** 월 근로소득세 (간이세액표 근사치) */
function estimateIncomeTax(monthlySalary: number): number {
  // 과세표준 = 총급여 - 비과세(식비200,000 + 교통비200,000 등)은 별도 처리
  // 여기서는 과세소득에 대한 간이 계산만 제공
  if (monthlySalary <= 1_060_000) return 0;
  if (monthlySalary <= 1_500_000) return Math.round(monthlySalary * 0.006);
  if (monthlySalary <= 3_000_000) return Math.round(monthlySalary * 0.011);
  if (monthlySalary <= 4_500_000) return Math.round(monthlySalary * 0.016);
  if (monthlySalary <= 7_600_000) return Math.round(monthlySalary * 0.025);
  return Math.round(monthlySalary * 0.035);
}

/** 4대보험 + 소득세 자동 계산 */
export function autoCalcDeductions(dto: AutoCalculateDto) {
  const { base_salary, meal_allowance = 0, transport_allowance = 0 } = dto;

  // 국민연금·고용보험 기준: 기본급 + 정기수당 (비과세 제외)
  const taxableBase = base_salary;

  const nationalPension = Math.round(taxableBase * RATES.nationalPension / 10) * 10;
  const health          = Math.round(taxableBase * RATES.healthInsurance / 10) * 10;
  const careInsurance   = Math.round(health * RATES.careInsuranceRatio / 10) * 10;
  const employment      = Math.round(taxableBase * RATES.employmentInsurance / 10) * 10;

  // 소득세: 과세대상(기본급 - 비과세)
  const nonTaxableLimit = 200_000; // 식비 비과세 한도
  const mealNonTaxable  = Math.min(meal_allowance, nonTaxableLimit);
  const transportNonTaxable = Math.min(transport_allowance, nonTaxableLimit);
  const taxableTotal = base_salary - mealNonTaxable - transportNonTaxable;
  const incomeTax  = estimateIncomeTax(taxableTotal);
  const localTax   = Math.round(incomeTax * 0.1 / 10) * 10;

  // 최저시급 위반 검사 (기본급 기준)
  const minWageHourly  = getMinWage(dto.year);
  const minWageMonthly = minWageHourly * MONTHLY_WORK_HOURS;
  const minWageViolation = base_salary < minWageMonthly;
  const shortfall = minWageViolation ? minWageMonthly - base_salary : 0;

  return {
    nationalPension, healthInsurance: health, careInsurance,
    employmentInsurance: employment, incomeTax, localTax,
    minWageHourly, minWageMonthly, minWageViolation, shortfall,
  };
}

// ── 재무/회계 부서 키워드 ────────────────────────────────────
const FINANCE_DEPT_KEYWORDS = ['재무', '회계', 'finance', '경리', '급여'];

/** 사용자가 재무/회계 부서 소속인지 확인 (대소문자 무관) */
function isFinanceDepartment(dept?: string | null): boolean {
  if (!dept) return false;
  const lower = dept.toLowerCase();
  return FINANCE_DEPT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * 타인의 급여를 열람할 수 있는지 확인
 * - OWNER: 항상 허용
 * - 재무팀 MANAGER: 허용
 * - canManageSalary or canManagePayroll = true: 허용
 * - canViewSalary = true: 허용 (읽기 전용)
 */
function canViewOthersSalary(user: AuthenticatedUser): boolean {
  if (user.role === UserRole.OWNER) return true;
  const perms = user.permissions ?? {};
  if (perms.canManageSalary || perms.canManagePayroll) return true;
  if (perms.canViewSalary) return true;
  if (user.role === UserRole.MANAGER && isFinanceDepartment(user.department)) return true;
  return false;
}

/**
 * 급여를 생성·수정·확정·지급할 수 있는지 확인
 * - OWNER: 항상 허용
 * - 재무팀 MANAGER: 허용
 * - canManageSalary or canManagePayroll = true: 허용
 */
function canManageOthersSalary(user: AuthenticatedUser): boolean {
  if (user.role === UserRole.OWNER) return true;
  const perms = user.permissions ?? {};
  if (perms.canManageSalary || perms.canManagePayroll) return true;
  if (user.role === UserRole.MANAGER && isFinanceDepartment(user.department)) return true;
  return false;
}

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(Salary) private salaryRepo: Repository<Salary>,
    @InjectRepository(User)   private userRepo: Repository<User>,
  ) {}

  // ─── 급여 목록 조회 ──────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: SalaryQueryDto) {
    const qb = this.salaryRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('s.deleted_at IS NULL');

    if (query.year)    qb.andWhere('s.year = :year',   { year: query.year });
    if (query.month)   qb.andWhere('s.month = :month', { month: query.month });
    if (query.user_id) qb.andWhere('s.user_id = :uid', { uid: query.user_id });
    if (query.status)  qb.andWhere('s.status = :status', { status: query.status });

    if (currentUser.role === UserRole.EMPLOYEE) {
      // 직원은 본인 것만 (열람 권한 없음)
      qb.andWhere('s.user_id = :selfId', { selfId: currentUser.id });
    } else if (!canViewOthersSalary(currentUser)) {
      // 관리자급이라도 급여 열람 권한이 없으면 본인 것만
      qb.andWhere('s.user_id = :selfId', { selfId: currentUser.id });
    } else {
      // 열람 범위 제한 (managed_departments 스코프)
      const perms = currentUser.permissions ?? {};
      const depts = currentUser.managedDepartments;
      if (perms.salaryScope === 'managed_departments' && depts && depts.length > 0) {
        qb.andWhere('u.department IN (:...depts)', { depts });
      }
    }

    qb.orderBy('s.year', 'DESC').addOrderBy('s.month', 'DESC').addOrderBy('u.name', 'ASC');

    const salaries = await qb.getMany();
    return salaries.map((s) => this.toResponse(s));
  }

  // ─── 내 급여 목록 ────────────────────────────────────
  async findMine(currentUser: AuthenticatedUser, query: SalaryQueryDto) {
    return this.findAll(currentUser, { ...query, user_id: currentUser.id });
  }

  // ─── 단건 조회 ───────────────────────────────────────
  async findOne(currentUser: AuthenticatedUser, id: string) {
    const salary = await this.salaryRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['user'],
    });
    if (!salary) throw new NotFoundException('급여 기록을 찾을 수 없습니다.');
    // 본인 급여는 누구나 조회 가능, 타인 급여는 열람 권한 필요
    if (salary.userId !== currentUser.id && !canViewOthersSalary(currentUser)) {
      throw new ForbiddenException('급여 열람 권한이 없습니다. 재무팀 관리자 또는 권한 보유자만 접근할 수 있습니다.');
    }
    return this.toResponse(salary);
  }

  // ─── 생성 ────────────────────────────────────────────
  async create(currentUser: AuthenticatedUser, dto: CreateSalaryDto) {
    if (!canManageOthersSalary(currentUser)) {
      throw new ForbiddenException('급여 등록 권한이 없습니다. 재무팀 관리자 또는 급여 관리 권한 보유자만 등록할 수 있습니다.');
    }

    const target = await this.userRepo.findOne({
      where: { id: dto.user_id, companyId: currentUser.companyId },
    });
    if (!target) throw new NotFoundException('직원을 찾을 수 없습니다.');

    const exists = await this.salaryRepo.findOne({
      where: { companyId: currentUser.companyId, userId: dto.user_id, year: dto.year, month: dto.month },
    });
    if (exists) throw new ConflictException(`${dto.year}년 ${dto.month}월 급여가 이미 존재합니다.`);

    const salary = this.salaryRepo.create({
      companyId:            currentUser.companyId,
      userId:               dto.user_id,
      year:                 dto.year,
      month:                dto.month,
      baseSalary:           dto.base_salary,
      overtimePay:          dto.overtime_pay          ?? 0,
      holidayPay:           dto.holiday_pay           ?? 0,
      bonus:                dto.bonus                 ?? 0,
      mealAllowance:        dto.meal_allowance        ?? 0,
      transportAllowance:   dto.transport_allowance   ?? 0,
      otherAllowance:       dto.other_allowance       ?? 0,
      incomeTax:            dto.income_tax            ?? 0,
      localTax:             dto.local_tax             ?? 0,
      nationalPension:      dto.national_pension      ?? 0,
      healthInsurance:      dto.health_insurance      ?? 0,
      careInsurance:        dto.care_insurance        ?? 0,
      employmentInsurance:  dto.employment_insurance  ?? 0,
      otherDeduction:       dto.other_deduction       ?? 0,
      note:                 dto.note                  ?? null,
      createdBy:            currentUser.id,
      status:               SalaryStatus.DRAFT,
    });

    const saved = await this.salaryRepo.save(salary);
    return this.findOne(currentUser, saved.id);
  }

  // ─── 수정 ────────────────────────────────────────────
  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateSalaryDto) {
    if (!canManageOthersSalary(currentUser)) {
      throw new ForbiddenException('급여 수정 권한이 없습니다.');
    }
    const salary = await this.salaryRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!salary) throw new NotFoundException('급여 기록을 찾을 수 없습니다.');
    if (salary.status === SalaryStatus.PAID) {
      throw new BadRequestException('지급 완료된 급여는 수정할 수 없습니다.');
    }

    if (dto.base_salary           != null) salary.baseSalary           = dto.base_salary;
    if (dto.overtime_pay          != null) salary.overtimePay          = dto.overtime_pay;
    if (dto.holiday_pay           != null) salary.holidayPay           = dto.holiday_pay;
    if (dto.bonus                 != null) salary.bonus                 = dto.bonus;
    if (dto.meal_allowance        != null) salary.mealAllowance        = dto.meal_allowance;
    if (dto.transport_allowance   != null) salary.transportAllowance   = dto.transport_allowance;
    if (dto.other_allowance       != null) salary.otherAllowance       = dto.other_allowance;
    if (dto.income_tax            != null) salary.incomeTax            = dto.income_tax;
    if (dto.local_tax             != null) salary.localTax             = dto.local_tax;
    if (dto.national_pension      != null) salary.nationalPension      = dto.national_pension;
    if (dto.health_insurance      != null) salary.healthInsurance      = dto.health_insurance;
    if (dto.care_insurance        != null) salary.careInsurance        = dto.care_insurance;
    if (dto.employment_insurance  != null) salary.employmentInsurance  = dto.employment_insurance;
    if (dto.other_deduction       != null) salary.otherDeduction       = dto.other_deduction;
    if (dto.note                  != null) salary.note                 = dto.note;

    await this.salaryRepo.save(salary);
    return this.findOne(currentUser, id);
  }

  // ─── 확정 / 지급완료 상태 전환 ──────────────────────
  async confirm(currentUser: AuthenticatedUser, id: string) {
    if (!canManageOthersSalary(currentUser)) throw new ForbiddenException('급여 확정 권한이 없습니다.');
    const salary = await this.salaryRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!salary) throw new NotFoundException('급여 기록을 찾을 수 없습니다.');
    if (salary.status !== SalaryStatus.DRAFT) throw new BadRequestException('초안 상태에서만 확정할 수 있습니다.');
    salary.status = SalaryStatus.CONFIRMED;
    await this.salaryRepo.save(salary);
    return this.findOne(currentUser, id);
  }

  async markPaid(currentUser: AuthenticatedUser, id: string) {
    if (!canManageOthersSalary(currentUser)) throw new ForbiddenException('급여 지급 처리 권한이 없습니다.');
    const salary = await this.salaryRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!salary) throw new NotFoundException('급여 기록을 찾을 수 없습니다.');
    if (salary.status !== SalaryStatus.CONFIRMED) throw new BadRequestException('확정 상태에서만 지급 처리할 수 있습니다.');
    salary.status = SalaryStatus.PAID;
    salary.paidAt = new Date();
    await this.salaryRepo.save(salary);
    return this.findOne(currentUser, id);
  }

  // ─── 삭제 ────────────────────────────────────────────
  async remove(currentUser: AuthenticatedUser, id: string) {
    if (currentUser.role !== UserRole.OWNER) throw new ForbiddenException('소유자만 삭제할 수 있습니다.');
    const salary = await this.salaryRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!salary) throw new NotFoundException();
    await this.salaryRepo.softDelete(id);
    return { message: '삭제되었습니다.' };
  }

  // ─── 자동 계산 (UI 헬퍼) ────────────────────────────
  calculate(_currentUser: AuthenticatedUser, dto: AutoCalculateDto) {
    return autoCalcDeductions(dto);
  }

  // ─── 월별 요약 ───────────────────────────────────────
  async monthlySummary(currentUser: AuthenticatedUser, year: number, month: number) {
    if (!canViewOthersSalary(currentUser)) throw new ForbiddenException('급여 요약 열람 권한이 없습니다.');

    const salaries = await this.salaryRepo.find({
      where: { companyId: currentUser.companyId, year, month },
      relations: ['user'],
    });

    const total = salaries.reduce((acc, s) => {
      const gross = s.baseSalary + s.overtimePay + s.holidayPay + s.bonus
        + s.mealAllowance + s.transportAllowance + s.otherAllowance;
      const deduction = s.incomeTax + s.localTax + s.nationalPension
        + s.healthInsurance + s.careInsurance + s.employmentInsurance + s.otherDeduction;
      acc.grossPay    += gross;
      acc.deduction   += deduction;
      acc.netPay      += gross - deduction;
      acc.count       += 1;
      if (s.status === SalaryStatus.PAID) acc.paidCount += 1;
      return acc;
    }, { grossPay: 0, deduction: 0, netPay: 0, count: 0, paidCount: 0 });

    return total;
  }

  // ─── 직렬화 ──────────────────────────────────────────
  private toResponse(s: Salary) {
    const grossPay = s.baseSalary + s.overtimePay + s.holidayPay + s.bonus
      + s.mealAllowance + s.transportAllowance + s.otherAllowance;
    const totalDeduction = s.incomeTax + s.localTax + s.nationalPension
      + s.healthInsurance + s.careInsurance + s.employmentInsurance + s.otherDeduction;
    const netPay = grossPay - totalDeduction;

    return {
      id:                   s.id,
      year:                 s.year,
      month:                s.month,
      status:               s.status,
      paidAt:               s.paidAt,
      note:                 s.note,
      workDays:             s.workDays,
      workMinutes:          s.workMinutes,
      // earnings
      baseSalary:           s.baseSalary,
      overtimePay:          s.overtimePay,
      holidayPay:           s.holidayPay,
      bonus:                s.bonus,
      mealAllowance:        s.mealAllowance,
      transportAllowance:   s.transportAllowance,
      otherAllowance:       s.otherAllowance,
      grossPay,
      // deductions
      incomeTax:            s.incomeTax,
      localTax:             s.localTax,
      nationalPension:      s.nationalPension,
      healthInsurance:      s.healthInsurance,
      careInsurance:        s.careInsurance,
      employmentInsurance:  s.employmentInsurance,
      otherDeduction:       s.otherDeduction,
      totalDeduction,
      // net
      netPay,
      // user
      user: s.user ? {
        id:         s.user.id,
        name:       s.user.name,
        department: s.user.department,
        position:   s.user.position,
        role:       s.user.role,
      } : undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
