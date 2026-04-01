import {
  Controller, Get, Query, Param, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { TaxDocumentsService } from './tax-documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';

@Controller('tax-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class TaxDocumentsController {
  constructor(private readonly svc: TaxDocumentsService) {}

  /** 이번 달 할 일 목록 */
  @Get('todo')
  async getTodo(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getTodo(user);
  }

  /** 연간 세무 캘린더 */
  @Get('annual-calendar')
  getAnnualCalendar(@Query('year') year?: string) {
    return this.svc.getAnnualCalendar(year ? Number(year) : new Date().getFullYear());
  }

  /** 원천징수이행상황 — HTML (출력용) */
  @Get('withholding-tax')
  async getWithholdingTax(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('userId') userId: string | undefined,
    @Res() res: Response,
  ) {
    const html = await this.svc.getWithholdingTaxHtml(
      user,
      Number(year ?? new Date().getFullYear()),
      Number(month ?? new Date().getMonth() + 1),
      userId,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /** 4대보험 취득/상실 신고서 — HTML (출력용) */
  @Get('insurance-form/:userId')
  async getInsuranceForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string,
    @Query('type') type: 'acquisition' | 'loss',
    @Res() res: Response,
  ) {
    const html = await this.svc.getInsuranceFormHtml(user, targetUserId, type ?? 'acquisition');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /** 연말정산 연간 집계 — HTML (출력용) */
  @Get('year-end-summary')
  async getYearEndSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const html = await this.svc.getYearEndSummaryHtml(user, Number(year ?? new Date().getFullYear() - 1));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /** 퇴직금 계산서 — HTML (출력용) */
  @Get('retirement-pay/:userId')
  async getRetirementPay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string,
    @Res() res: Response,
  ) {
    const html = await this.svc.getRetirementPayHtml(user, targetUserId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
