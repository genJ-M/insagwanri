import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { SetFeatureOverrideDto } from './dto/feature-override.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { OverrideType } from '../../database/entities/company-feature.entity';

@Controller('admin/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  // GET /admin/v1/features — 전체 feature 목록
  @Get('features')
  @Roles(AdminRole.READONLY)
  getAllFeatures() {
    return this.featureFlagsService.getAllFeatures();
  }

  // GET /admin/v1/companies/:id/features — 회사별 feature 현황
  @Get('companies/:id/features')
  @Roles(AdminRole.READONLY)
  getCompanyFeatures(@Param('id') id: string) {
    return this.featureFlagsService.getCompanyFeatures(id);
  }

  // PUT /admin/v1/companies/:id/features/:key — override 설정
  @Put('companies/:id/features/:key')
  @Roles(AdminRole.OPERATIONS)
  setOverride(
    @Param('id') companyId: string,
    @Param('key') featureKey: string,
    @Body() dto: SetFeatureOverrideDto,
    @AdminUser() user: AdminJwtPayload,
  ) {
    return this.featureFlagsService.setCompanyOverride(
      companyId,
      featureKey,
      {
        overrideType: dto.overrideType as OverrideType,
        isEnabled: dto.isEnabled,
        limitValue: dto.limitValue,
        configValue: dto.configValue,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      user,
    );
  }

  // DELETE /admin/v1/companies/:id/features/:key — override 삭제
  @Delete('companies/:id/features/:key')
  @Roles(AdminRole.OPERATIONS)
  removeOverride(
    @Param('id') companyId: string,
    @Param('key') featureKey: string,
  ) {
    return this.featureFlagsService.removeCompanyOverride(companyId, featureKey);
  }
}
