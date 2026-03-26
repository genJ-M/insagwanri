import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class AnalyticsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
}

@Controller('admin/v1/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.READONLY)
export class AnalyticsController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('usage')
  async getUsage(@Query() query: AnalyticsQueryDto) {
    const now = new Date();
    const year  = query.year  ?? now.getFullYear();
    const month = query.month ?? (now.getMonth() + 1);
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEnd   = new Date(year, month, 0).toISOString().slice(0, 10); // 말일

    // 1. 요약 지표
    const [summary] = await this.dataSource.query(`
      SELECT
        COUNT(DISTINCT c.id)                                         AS active_tenants,
        COUNT(DISTINCT u.id)                                         AS total_employees,
        COALESCE(SUM(ar.count_today), 0)                            AS ai_requests_today
      FROM companies c
      LEFT JOIN users u       ON u.company_id = c.id AND u.deleted_at IS NULL
      LEFT JOIN (
        SELECT company_id, COUNT(*) AS count_today
        FROM ai_requests
        WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
        GROUP BY company_id
      ) ar ON ar.company_id = c.id
      WHERE c.deleted_at IS NULL AND c.status = 'active'
    `);

    // 2. 플랜 분포
    const planDist = await this.dataSource.query(`
      SELECT
        p.name AS plan_name,
        p.display_name AS plan_display_name,
        COUNT(*) AS count,
        ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM subscriptions WHERE status = 'active'), 0), 1) AS percentage
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
      GROUP BY p.id, p.name, p.display_name, p.sort_order
      ORDER BY p.sort_order
    `);

    // 3. 한도 임박 회사 (직원 또는 AI 사용량 70% 이상)
    const nearLimit = await this.dataSource.query(`
      SELECT
        c.id, c.name,
        p.name AS plan_name,
        COUNT(u.id)::int AS employee_count,
        p.max_employees,
        ROUND(COUNT(u.id) * 100.0 / NULLIF(p.max_employees, 0))::int AS employee_usage_pct,
        COALESCE(ar.count_today, 0)::int AS ai_usage_today,
        p.ai_requests_per_day AS ai_limit,
        ROUND(COALESCE(ar.count_today, 0) * 100.0 / NULLIF(p.ai_requests_per_day, 0))::int AS ai_usage_pct
      FROM companies c
      JOIN subscriptions s ON s.company_id = c.id AND s.status = 'active'
      JOIN plans p ON p.id = s.plan_id
      LEFT JOIN users u ON u.company_id = c.id AND u.deleted_at IS NULL
      LEFT JOIN (
        SELECT company_id, COUNT(*) AS count_today
        FROM ai_requests
        WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
        GROUP BY company_id
      ) ar ON ar.company_id = c.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, p.name, p.max_employees, p.ai_requests_per_day, ar.count_today
      HAVING
        COUNT(u.id) * 100.0 / NULLIF(p.max_employees, 0) >= 70
        OR COALESCE(ar.count_today, 0) * 100.0 / NULLIF(p.ai_requests_per_day, 0) >= 70
      ORDER BY employee_usage_pct DESC NULLS LAST
      LIMIT 10
    `);

    // 4. 월별 MRR 추이 (최근 6개월)
    const mrr = await this.dataSource.query(`
      SELECT
        TO_CHAR(p.created_at, 'YYYY-MM') AS month,
        SUM(p.total_amount_krw) AS revenue_krw,
        COUNT(*) AS payment_count
      FROM payments p
      WHERE p.status = 'completed'
        AND p.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    return {
      active_tenants: parseInt(summary.active_tenants ?? '0'),
      total_employees: parseInt(summary.total_employees ?? '0'),
      ai_requests_today: parseInt(summary.ai_requests_today ?? '0'),
      plan_distribution: planDist,
      near_limit_companies: nearLimit,
      monthly_mrr: mrr,
    };
  }

  // GET /admin/v1/analytics/realtime — 실시간 현황
  @Get('realtime')
  async getRealtime() {
    // 오늘 출퇴근 기록 기반 DAU
    const [dau] = await this.dataSource.query(`
      SELECT
        COUNT(DISTINCT ar.user_id)::int AS dau,
        COUNT(DISTINCT ar.company_id)::int AS active_companies_today
      FROM attendance_records ar
      WHERE DATE(ar.clock_in AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
    `);

    // 현재 출근 중 (clock_in 있고 clock_out 없는 인원)
    const [onsite] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT user_id)::int AS currently_working
      FROM attendance_records
      WHERE DATE(clock_in AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
        AND clock_out IS NULL
    `);

    // 오늘 신규 가입 회사
    const [newCompanies] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS new_companies_today
      FROM companies
      WHERE DATE(created_at AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
        AND deleted_at IS NULL
    `);

    // 최근 1시간 API 호출량 (ai_requests 기준)
    const [apiLoad] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS api_calls_last_hour
      FROM ai_requests
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    // 활성 구독 총계
    const [subs] = await this.dataSource.query(`
      SELECT
        COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_subscriptions,
        COUNT(CASE WHEN status = 'past_due' THEN 1 END)::int AS past_due_subscriptions,
        COUNT(CASE WHEN status = 'trialing' THEN 1 END)::int AS trialing_subscriptions
      FROM subscriptions
    `);

    return {
      as_of: new Date().toISOString(),
      dau: dau.dau,
      active_companies_today: dau.active_companies_today,
      currently_working: onsite.currently_working,
      new_companies_today: newCompanies.new_companies_today,
      api_calls_last_hour: apiLoad.api_calls_last_hour,
      subscriptions: {
        active: subs.active_subscriptions,
        past_due: subs.past_due_subscriptions,
        trialing: subs.trialing_subscriptions,
      },
    };
  }

  // GET /admin/v1/analytics/funnel — 온보딩 퍼널 (가입→결제 단계별 이탈)
  @Get('funnel')
  async getFunnel() {
    // 단계 1: 가입 완료 (이메일 인증 여부 무관)
    const [registered] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT id)::int AS count
      FROM companies
      WHERE deleted_at IS NULL
    `);

    // 단계 2: 플랜 선택 완료 (subscription 레코드 존재)
    const [planSelected] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT company_id)::int AS count
      FROM subscriptions
    `);

    // 단계 3: 결제 수단 등록 (payment_methods 존재)
    const [cardAdded] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT bp.company_id)::int AS count
      FROM billing_profiles bp
      JOIN payment_methods pm ON pm.billing_profile_id = bp.id
      WHERE pm.is_active = TRUE
    `);

    // 단계 4: 첫 결제 완료 (active 구독)
    const [active] = await this.dataSource.query(`
      SELECT COUNT(DISTINCT company_id)::int AS count
      FROM subscriptions
      WHERE status = 'active'
        AND canceled_at IS NULL
    `);

    const r = registered.count || 1; // division by zero 방지
    return {
      stages: [
        {
          stage: 'registered',
          label: '회원가입',
          count: registered.count,
          rate: 100,
        },
        {
          stage: 'plan_selected',
          label: '플랜 선택',
          count: planSelected.count,
          rate: Math.round((planSelected.count / r) * 100),
        },
        {
          stage: 'card_added',
          label: '결제 수단 등록',
          count: cardAdded.count,
          rate: Math.round((cardAdded.count / r) * 100),
        },
        {
          stage: 'active',
          label: '첫 결제 완료',
          count: active.count,
          rate: Math.round((active.count / r) * 100),
        },
      ],
    };
  }
}
