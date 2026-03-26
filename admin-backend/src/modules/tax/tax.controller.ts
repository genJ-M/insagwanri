import { Controller, Get, Query, Param, Res, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { IsOptional, IsDateString } from 'class-validator';

class TaxQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@Controller('admin/v1/tax')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.BILLING)
export class TaxController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /** GET /admin/v1/tax/summary */
  @Get('summary')
  async getSummary(@Query() query: TaxQueryDto) {
    const from = query.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to   = query.to   ?? new Date().toISOString().slice(0, 10);

    const [row] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(supply_amount_krw), 0)  AS supply_amount,
        COALESCE(SUM(tax_amount_krw), 0)     AS tax_amount,
        COALESCE(SUM(discount_amount_krw), 0) AS discount_amount,
        COALESCE(SUM(total_amount_krw), 0)   AS total_amount,
        COALESCE(SUM(CASE WHEN status IN ('refunded','partial_refunded') THEN refunded_amount_krw ELSE 0 END), 0) AS refund_amount,
        COALESCE(SUM(CASE WHEN status IN ('refunded','partial_refunded') THEN ROUND(refunded_amount_krw / 1.1) ELSE 0 END), 0) AS refund_supply_amount,
        COALESCE(SUM(CASE WHEN status IN ('refunded','partial_refunded') THEN ROUND(refunded_amount_krw * 0.1 / 1.1) ELSE 0 END), 0) AS refund_tax_amount
      FROM payments
      WHERE status IN ('completed','refunded','partial_refunded')
        AND paid_at::date BETWEEN $1 AND $2
    `, [from, to]);

    const supplyAmount  = parseFloat(row.supply_amount);
    const taxAmount     = parseFloat(row.tax_amount);
    const refundAmount  = parseFloat(row.refund_amount);
    const refundTax     = parseFloat(row.refund_tax_amount);

    return {
      supply_amount:      supplyAmount,
      tax_amount:         taxAmount,
      discount_amount:    parseFloat(row.discount_amount),
      total_amount:       parseFloat(row.total_amount),
      refund_amount:      refundAmount,
      refund_tax_amount:  refundTax,
      net_supply_amount:  supplyAmount - parseFloat(row.refund_supply_amount),
      net_tax_amount:     taxAmount - refundTax,
      by_method: {
        card_corporate: { supply: 0, tax: 0, count: 0 },
        card_business:  { supply: 0, tax: 0, count: 0 },
        card_personal:  { supply: 0, tax: 0, count: 0 },
        bank_transfer:  { supply: 0, tax: 0, count: 0 },
        tax_invoice:    { supply: 0, tax: 0, count: 0 },
      },
    };
  }

  /** GET /admin/v1/tax/monthly */
  @Get('monthly')
  async getMonthly(@Query() query: TaxQueryDto) {
    const from = query.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to   = query.to   ?? new Date().toISOString().slice(0, 10);

    const rows = await this.dataSource.query(`
      SELECT
        EXTRACT(YEAR  FROM paid_at)::int AS year,
        EXTRACT(MONTH FROM paid_at)::int AS month,
        COALESCE(SUM(supply_amount_krw), 0)  AS supply_amount,
        COALESCE(SUM(tax_amount_krw), 0)     AS tax_amount,
        COALESCE(SUM(total_amount_krw), 0)   AS total_amount,
        COALESCE(SUM(CASE WHEN status IN ('refunded','partial_refunded') THEN refunded_amount_krw ELSE 0 END), 0) AS refund_amount,
        COUNT(*)::int AS count
      FROM payments
      WHERE status IN ('completed','refunded','partial_refunded')
        AND paid_at::date BETWEEN $1 AND $2
      GROUP BY EXTRACT(YEAR FROM paid_at), EXTRACT(MONTH FROM paid_at)
      ORDER BY year ASC, month ASC
    `, [from, to]);

    return rows;
  }

  /** GET /admin/v1/tax/export/:format */
  @Get('export/:format')
  async export(
    @Param('format') format: string,
    @Query() query: TaxQueryDto,
    @Res() res: Response,
  ) {
    const from = query.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to   = query.to   ?? new Date().toISOString().slice(0, 10);

    const rows = await this.dataSource.query(`
      SELECT
        p.invoice_number,
        c.name AS company_name,
        p.supply_amount_krw,
        p.tax_amount_krw,
        p.total_amount_krw,
        p.discount_amount_krw,
        p.status,
        p.paid_at,
        p.billing_period_start,
        p.billing_period_end
      FROM payments p
      JOIN companies c ON c.id = p.company_id
      WHERE p.status IN ('completed','refunded','partial_refunded')
        AND p.paid_at::date BETWEEN $1 AND $2
      ORDER BY p.paid_at ASC
    `, [from, to]);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tax_export_${from}_${to}.json"`);
      res.send(JSON.stringify(rows, null, 2));
      return;
    }

    // CSV (기본)
    const headers = ['청구번호', '회사명', '공급가액', '부가세', '합계', '할인', '상태', '결제일', '청구기간시작', '청구기간종료'];
    const csvRows = rows.map((r: any) => [
      r.invoice_number, r.company_name,
      r.supply_amount_krw, r.tax_amount_krw, r.total_amount_krw, r.discount_amount_krw,
      r.status, r.paid_at ? new Date(r.paid_at).toISOString().slice(0, 10) : '',
      r.billing_period_start, r.billing_period_end,
    ].join(','));

    const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tax_export_${from}_${to}.csv"`);
    res.send(csv);
  }
}
