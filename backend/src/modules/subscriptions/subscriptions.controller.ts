import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import {
  UpgradeSubscriptionDto, IssueBillingKeyDto, CancelSubscriptionDto,
  ToggleAutoRenewDto, PurchaseAddonDto,
  PreviewSeatChangeDto, AddSeatsDto,
  PreviewLocationChangeDto, AddLocationsDto,
  ScheduleSeatDecreaseDto, ScheduleLocationDecreaseDto,
  SetBillingDelegateDto,
} from './dto/subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  // GET /api/v1/subscriptions/plans
  @Get('plans')
  getPlans(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getPlans(user);
  }

  // POST /api/v1/subscriptions/upgrade
  @Post('upgrade')
  upgrade(@Body() dto: UpgradeSubscriptionDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.upgrade(dto, user);
  }

  // POST /api/v1/subscriptions/cancel
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Body() dto: CancelSubscriptionDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancel(dto, user);
  }

  // GET /api/v1/subscriptions/invoices
  @Get('invoices')
  getInvoices(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getInvoices(user);
  }

  // GET /api/v1/subscriptions/payment-methods
  @Get('payment-methods')
  getPaymentMethods(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getPaymentMethods(user);
  }

  // GET /api/v1/subscriptions/toss/client-key
  @Get('toss/client-key')
  getTossClientKey(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getTossClientKey(user);
  }

  // POST /api/v1/subscriptions/toss/billing-key
  @Post('toss/billing-key')
  issueBillingKey(@Body() dto: IssueBillingKeyDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.issueBillingKey(dto, user);
  }

  // PATCH /api/v1/subscriptions/auto-renew
  @Patch('auto-renew')
  @HttpCode(HttpStatus.OK)
  toggleAutoRenew(@Body() dto: ToggleAutoRenewDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.toggleAutoRenew(dto, user);
  }

  // GET /api/v1/subscriptions/addons
  @Get('addons')
  getAddonCatalog() {
    return { success: true, data: this.subscriptionsService.getAddonCatalog() };
  }

  // GET /api/v1/subscriptions/addons/active
  @Get('addons/active')
  getActiveAddons(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getActiveAddons(user);
  }

  // POST /api/v1/subscriptions/addons/purchase
  @Post('addons/purchase')
  purchaseAddon(@Body() dto: PurchaseAddonDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.purchaseAddon(dto, user);
  }

  // DELETE /api/v1/subscriptions/payment-methods/:id
  @Delete('payment-methods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.deletePaymentMethod(id, user);
  }

  // ── Per-seat: 인원 추가 (일할 계산) ─────────────────────────────
  @Post('seats/preview')
  @HttpCode(HttpStatus.OK)
  previewSeatChange(@Body() dto: PreviewSeatChangeDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.previewSeatChange(dto.newSeatCount, user);
  }

  @Post('seats/add')
  @HttpCode(HttpStatus.OK)
  addSeats(@Body() dto: AddSeatsDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.addSeats(dto, user);
  }

  // ── Per-seat: 지점 추가 (일할 계산) ─────────────────────────────
  @Post('locations/preview')
  @HttpCode(HttpStatus.OK)
  previewLocationChange(@Body() dto: PreviewLocationChangeDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.previewLocationChange(dto.newExtraLocations, user);
  }

  @Post('locations/add')
  @HttpCode(HttpStatus.OK)
  addLocations(@Body() dto: AddLocationsDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.addLocations(dto, user);
  }

  // ── 감소 예약 (다음 청구주기에 자동 적용) ──────────────────────
  @Post('seats/schedule-decrease')
  @HttpCode(HttpStatus.OK)
  scheduleSeatDecrease(@Body() dto: ScheduleSeatDecreaseDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.scheduleSeatDecrease(dto.newSeatCount, user);
  }

  @Post('locations/schedule-decrease')
  @HttpCode(HttpStatus.OK)
  scheduleLocationDecrease(@Body() dto: ScheduleLocationDecreaseDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.scheduleLocationDecrease(dto.newExtraLocations, user);
  }

  @Delete('scheduled-changes')
  @HttpCode(HttpStatus.OK)
  cancelScheduledChanges(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancelScheduledChanges(user);
  }

  // ── Free 플랜 다운그레이드 (카드 없이 가능) ──────────────────
  @Post('downgrade-to-free')
  @HttpCode(HttpStatus.OK)
  downgradeToFree(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.downgradeToFree(user);
  }

  // ── 결제 위임 계정 (OWNER 전용 지정/해제) ──────────────────────
  @Get('billing-delegate')
  getBillingDelegate(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getBillingDelegate(user);
  }

  @Post('billing-delegate')
  @HttpCode(HttpStatus.OK)
  setBillingDelegate(@Body() dto: SetBillingDelegateDto, @GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.setBillingDelegate(dto.userId ?? null, user);
  }

  @Delete('billing-delegate')
  @HttpCode(HttpStatus.OK)
  clearBillingDelegate(@GetUser() user: AuthenticatedUser) {
    return this.subscriptionsService.setBillingDelegate(null, user);
  }
}
