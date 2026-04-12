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
}
