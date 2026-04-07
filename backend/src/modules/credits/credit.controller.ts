import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { IsInt, Min } from 'class-validator';

class PurchaseDto {
  @IsInt() @Min(1)
  credits: number;

  /** 패키지 ID (pack_10 / pack_50 / pack_200) */
  package_id: string;
}

@Controller('credits')
export class CreditController {
  constructor(private readonly svc: CreditService) {}

  /** 잔액 조회 */
  @Get('balance')
  async getBalance(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.svc.getBalance(user.companyId);
    return { success: true, data };
  }

  /** 이력 조회 */
  @Get('history')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const data = await this.svc.getHistory(user.companyId, limit ? parseInt(limit) : 50);
    return { success: true, data };
  }

  /** 구매 가능 패키지 목록 */
  @Get('packages')
  getPackages() {
    return { success: true, data: this.svc.getCreditPackages() };
  }

  /**
   * 크레딧 구매 (실결제 연동 전 — 테스트/관리자 수동 충전)
   * 실제 서비스에서는 결제 PG 연동 후 webhook으로 처리
   */
  @Post('purchase')
  @Roles(UserRole.OWNER)
  async purchase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PurchaseDto,
  ) {
    const pkg = this.svc.getCreditPackages().find(p => p.id === dto.package_id);
    if (!pkg) return { success: false, message: '유효하지 않은 패키지입니다.' };

    await this.svc.charge(
      user.companyId, pkg.credits,
      'purchase', `${pkg.label} 구매 (₩${pkg.priceKrw.toLocaleString()})`,
      user.id,
    );
    return { success: true, data: { charged: pkg.credits, priceKrw: pkg.priceKrw } };
  }
}
