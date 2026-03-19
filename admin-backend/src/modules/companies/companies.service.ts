import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanyQueryDto, SuspendCompanyDto, ChangePlanDto } from './dto/company-query.dto';
import { Subscription, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { Plan } from '../../database/entities/plan.entity';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';

// 공유 DB의 companies 테이블 — Customer 서비스가 소유하는 테이블
// Admin은 읽기/상태변경만 허용
@Injectable()
export class CompaniesService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,

    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,

    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) {}

  // ──────────────────────────────────────────────
  // 회사 목록 조회 (with 구독 현황)
  // ──────────────────────────────────────────────
  async findAll(query: CompanyQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE c.deleted_at IS NULL`;
    const params: any[] = [];
    let paramIdx = 1;

    if (query.search) {
      whereClause += ` AND (c.name ILIKE $${paramIdx} OR c.business_number ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.status) {
      whereClause += ` AND s.status = $${paramIdx}`;
      params.push(query.status);
      paramIdx++;
    }

    if (query.plan) {
      whereClause += ` AND p.name = $${paramIdx}`;
      params.push(query.plan);
      paramIdx++;
    }

    const sql = `
      SELECT
        c.id, c.name, c.business_number, c.status AS company_status,
        c.created_at, c.deleted_at,
        s.id AS subscription_id, s.status AS subscription_status,
        s.billing_cycle, s.current_period_end, s.quantity,
        p.name AS plan_name, p.display_name AS plan_display_name,
        p.price_monthly_krw
      FROM companies c
      LEFT JOIN subscriptions s ON s.company_id = c.id
      LEFT JOIN plans p ON p.id = s.plan_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM companies c
      LEFT JOIN subscriptions s ON s.company_id = c.id
      LEFT JOIN plans p ON p.id = s.plan_id
      ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(countSql, params.slice(0, -2)),
    ]);

    return {
      items: rows,
      total: parseInt(countRows[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  // ──────────────────────────────────────────────
  // 회사 상세 조회
  // ──────────────────────────────────────────────
  async findOne(companyId: string) {
    const rows = await this.dataSource.query(`
      SELECT
        c.*,
        s.id AS sub_id, s.status AS sub_status, s.billing_cycle,
        s.current_period_start, s.current_period_end, s.quantity,
        s.retry_count, s.next_retry_at, s.canceled_at,
        p.name AS plan_name, p.display_name AS plan_display_name,
        p.price_monthly_krw, p.max_employees, p.ai_requests_per_day,
        bp.legal_name, bp.business_registration_number, bp.billing_email,
        bp.tax_invoice_required
      FROM companies c
      LEFT JOIN subscriptions s ON s.company_id = c.id
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN billing_profiles bp ON bp.company_id = c.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `, [companyId]);

    if (!rows.length) {
      throw new NotFoundException(`회사 ID ${companyId}를 찾을 수 없습니다.`);
    }

    return rows[0];
  }

  // ──────────────────────────────────────────────
  // 회사 서비스 정지
  // ──────────────────────────────────────────────
  async suspendCompany(companyId: string, dto: SuspendCompanyDto, actor: AdminJwtPayload) {
    await this.findOne(companyId); // 존재 확인

    const subscription = await this.subscriptionRepository.findOne({
      where: { companyId },
    });

    if (!subscription) {
      throw new BadRequestException('구독 정보가 없습니다.');
    }

    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('이미 정지된 서비스입니다.');
    }

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.SUSPENDED,
    });

    // companies 테이블 status 도 suspended로 변경
    await this.dataSource.query(
      `UPDATE companies SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [companyId],
    );

    return { message: '서비스가 정지되었습니다.' };
  }

  // ──────────────────────────────────────────────
  // 회사 서비스 재활성화
  // ──────────────────────────────────────────────
  async activateCompany(companyId: string, actor: AdminJwtPayload) {
    await this.findOne(companyId);

    const subscription = await this.subscriptionRepository.findOne({
      where: { companyId },
    });

    if (!subscription) {
      throw new BadRequestException('구독 정보가 없습니다.');
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('이미 활성 상태입니다.');
    }

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.ACTIVE,
    });

    await this.dataSource.query(
      `UPDATE companies SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [companyId],
    );

    return { message: '서비스가 재활성화되었습니다.' };
  }

  // ──────────────────────────────────────────────
  // 플랜 변경
  // ──────────────────────────────────────────────
  async changePlan(companyId: string, dto: ChangePlanDto, actor: AdminJwtPayload) {
    await this.findOne(companyId);

    const plan = await this.planRepository.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('플랜을 찾을 수 없습니다.');

    const subscription = await this.subscriptionRepository.findOne({ where: { companyId } });
    if (!subscription) throw new BadRequestException('구독 정보가 없습니다.');

    await this.subscriptionRepository.update(subscription.id, { planId: dto.planId });

    return { message: `플랜이 ${plan.displayName}으로 변경되었습니다.` };
  }

  // ──────────────────────────────────────────────
  // 회사 직원 목록 조회
  // ──────────────────────────────────────────────
  async getEmployees(companyId: string) {
    await this.findOne(companyId);

    return this.dataSource.query(`
      SELECT id, email, name, role, status, joined_at, last_login_at, deleted_at
      FROM users
      WHERE company_id = $1
      ORDER BY joined_at ASC
    `, [companyId]);
  }
}
