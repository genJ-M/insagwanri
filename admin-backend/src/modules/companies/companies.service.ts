import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CompanyQueryDto, SuspendCompanyDto, ChangePlanDto } from './dto/company-query.dto';
import { Subscription, SubscriptionStatus } from '../../database/entities/subscription.entity';
import { Plan } from '../../database/entities/plan.entity';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';

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

    private jwtService: JwtService,
    private configService: ConfigService,
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
  // 대시보드 요약 통계
  // ──────────────────────────────────────────────
  async getStats() {
    const [row] = await this.dataSource.query(`
      SELECT
        COUNT(DISTINCT c.id)::int AS total,
        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN c.id END)::int AS active_subscriptions,
        COALESCE(SUM(CASE WHEN s.status = 'active' AND s.billing_cycle = 'monthly'
          THEN p.price_monthly_krw ELSE 0 END), 0)::bigint AS mrr_krw,
        COUNT(DISTINCT CASE WHEN s.status = 'past_due' THEN c.id END)::int AS past_due,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', NOW())
          THEN c.id END)::int AS new_this_month
      FROM companies c
      LEFT JOIN subscriptions s ON s.company_id = c.id
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE c.deleted_at IS NULL
    `);

    return {
      total: row.total,
      active_subscriptions: row.active_subscriptions,
      mrr_krw: parseInt(row.mrr_krw ?? '0'),
      past_due: row.past_due,
      new_this_month: row.new_this_month,
    };
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

  // ──────────────────────────────────────────────
  // Impersonation — 회사 owner 권한 임시 토큰 발급 (TTL 30분)
  // ──────────────────────────────────────────────
  async impersonateCompany(companyId: string, actor: AdminJwtPayload) {
    await this.findOne(companyId);

    // 회사 owner 사용자 조회
    const owners = await this.dataSource.query(`
      SELECT id, email, name, role
      FROM users
      WHERE company_id = $1 AND role = 'owner' AND deleted_at IS NULL
      LIMIT 1
    `, [companyId]);

    if (!owners.length) {
      throw new NotFoundException('해당 회사의 owner 계정을 찾을 수 없습니다.');
    }

    const owner = owners[0];

    // Customer 백엔드 JWT 시크릿으로 임시 토큰 발급
    const customerJwtSecret = this.configService.get<string>('CUSTOMER_JWT_ACCESS_SECRET');
    if (!customerJwtSecret) {
      throw new BadRequestException('CUSTOMER_JWT_ACCESS_SECRET 환경변수가 설정되지 않았습니다.');
    }

    const impersonationToken = this.jwtService.sign(
      {
        sub: owner.id,
        companyId,
        role: owner.role,
        email: owner.email,
        isImpersonation: true,
        impersonatedBy: actor.email,
      },
      {
        secret: customerJwtSecret,
        expiresIn: '30m',
      },
    );

    return {
      accessToken: impersonationToken,
      expiresIn: 1800,
      targetUser: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
      },
      message: '임시 접속 토큰이 발급되었습니다. 30분 후 만료됩니다.',
    };
  }

  // ──────────────────────────────────────────────
  // 고객사 데이터 초기화 (SUPER_ADMIN 전용 — 테스트 계정 정리용)
  // ──────────────────────────────────────────────
  async deleteCompanyData(companyId: string, actor: AdminJwtPayload) {
    if (actor.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN만 데이터 삭제를 수행할 수 있습니다.');
    }

    await this.findOne(companyId); // 존재 확인

    // 관련 데이터 소프트 삭제 (순서 중요: FK 제약)
    const now = new Date().toISOString();

    await this.dataSource.query(
      `UPDATE users SET deleted_at = $1 WHERE company_id = $2 AND deleted_at IS NULL`,
      [now, companyId],
    );

    await this.subscriptionRepository.update(
      { companyId },
      { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    );

    await this.dataSource.query(
      `UPDATE companies SET status = 'deleted', deleted_at = $1, updated_at = $1 WHERE id = $2`,
      [now, companyId],
    );

    return { message: '고객사 데이터가 삭제(soft delete) 처리되었습니다.' };
  }
}
