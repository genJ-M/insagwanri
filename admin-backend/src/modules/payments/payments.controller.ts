import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentQueryDto, RefundDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';

@Controller('admin/v1/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // GET /admin/v1/payments
  @Get()
  @Roles(AdminRole.BILLING)
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  // GET /admin/v1/payments/summary/:year/:month
  @Get('summary/:year/:month')
  @Roles(AdminRole.BILLING)
  getMonthlySummary(
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.paymentsService.getMonthlySummary(parseInt(year), parseInt(month));
  }

  // GET /admin/v1/payments/:id
  @Get(':id')
  @Roles(AdminRole.BILLING)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  // POST /admin/v1/payments/:id/refund
  @Post(':id/refund')
  @Roles(AdminRole.BILLING)
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
    @AdminUser() user: AdminJwtPayload,
  ) {
    return this.paymentsService.refund(id, dto, user);
  }
}
