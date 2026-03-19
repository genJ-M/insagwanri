import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompanyQueryDto, SuspendCompanyDto, ChangePlanDto } from './dto/company-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';

@Controller('admin/v1/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  // GET /admin/v1/companies
  @Get()
  @Roles(AdminRole.READONLY)
  findAll(@Query() query: CompanyQueryDto) {
    return this.companiesService.findAll(query);
  }

  // GET /admin/v1/companies/:id
  @Get(':id')
  @Roles(AdminRole.READONLY)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findOne(id);
  }

  // GET /admin/v1/companies/:id/employees
  @Get(':id/employees')
  @Roles(AdminRole.SUPPORT)
  getEmployees(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.getEmployees(id);
  }

  // POST /admin/v1/companies/:id/suspend
  @Post(':id/suspend')
  @Roles(AdminRole.OPERATIONS)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendCompanyDto,
    @AdminUser() user: AdminJwtPayload,
  ) {
    return this.companiesService.suspendCompany(id, dto, user);
  }

  // Post /admin/v1/companies/:id/activate
  @Post(':id/activate')
  @Roles(AdminRole.OPERATIONS)
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @AdminUser() user: AdminJwtPayload,
  ) {
    return this.companiesService.activateCompany(id, user);
  }

  // Patch /admin/v1/companies/:id/plan
  @Patch(':id/plan')
  @Roles(AdminRole.BILLING)
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanDto,
    @AdminUser() user: AdminJwtPayload,
  ) {
    return this.companiesService.changePlan(id, dto, user);
  }
}
