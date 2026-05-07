import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeatureModulesService } from './feature-modules.service';
import { ToggleModuleDto, ApplyPresetDto } from './dto/feature-modules.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import { IndustryPresetId } from './industry-preset.constants';
import { INDUSTRY_PRESETS } from './industry-preset.constants';
import { MODULE_CATALOG } from './module-catalog.constants';

@Controller('feature-modules')
export class FeatureModulesController {
  constructor(private readonly service: FeatureModulesService) {}

  /**
   * GET /feature-modules
   * 현재 회사의 전체 모듈 상태 목록 (카탈로그 + 활성화 여부)
   */
  @Get()
  getModuleStatus(@GetUser() user: AuthenticatedUser) {
    return this.service.getModuleStatus(user.companyId);
  }

  /**
   * GET /feature-modules/active
   * 활성 모듈 ID 목록만 반환 — 프론트 초기 로딩용
   */
  @Get('active')
  getActiveModuleIds(@GetUser() user: AuthenticatedUser) {
    return this.service.getActiveModuleIds(user.companyId);
  }

  /**
   * GET /feature-modules/presets
   * 업종 프리셋 목록 (정적 카탈로그)
   */
  @Get('presets')
  getPresets() {
    return Object.values(INDUSTRY_PRESETS);
  }

  /**
   * GET /feature-modules/catalog
   * 전체 모듈 카탈로그 (정적)
   */
  @Get('catalog')
  getCatalog() {
    return Object.values(MODULE_CATALOG);
  }

  /**
   * GET /feature-modules/check/:moduleId
   * 특정 모듈 활성 여부 확인 — boolean 반환
   */
  @Get('check/:moduleId')
  async checkModule(
    @GetUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
  ) {
    const isActive = await this.service.isModuleActive(user.companyId, moduleId);
    return { moduleId, isActive };
  }

  /**
   * PATCH /feature-modules/:moduleId
   * 모듈 활성/비활성 토글 — owner 전용
   */
  @Patch(':moduleId')
  toggleModule(
    @GetUser() user: AuthenticatedUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: ToggleModuleDto,
  ) {
    return this.service.toggleModule(user.companyId, moduleId, dto.isActive, user);
  }

  /**
   * POST /feature-modules/apply-preset
   * 업종 프리셋 일괄 적용 — owner 전용
   */
  @Post('apply-preset')
  @HttpCode(HttpStatus.OK)
  applyPreset(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ApplyPresetDto,
  ) {
    return this.service.applyIndustryPreset(
      user.companyId,
      dto.presetId as IndustryPresetId,
      user,
      dto.currentPlanName,
    );
  }

  /**
   * POST /feature-modules/sync-plan
   * 현재 플랜 기준으로 모듈 재동기화 — 구독 변경 후 자동 호출용
   * body: { planName: string }
   */
  @Post('sync-plan')
  @HttpCode(HttpStatus.OK)
  syncPlan(
    @GetUser() user: AuthenticatedUser,
    @Body('planName') planName: string,
  ) {
    return this.service.syncModulesForPlan(user.companyId, planName);
  }
}
