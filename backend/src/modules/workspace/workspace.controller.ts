import { Controller, Get, Patch, Body } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import {
  UpdateWorkspaceDto, UpdateWorkSettingsDto, UpdateGpsSettingsDto, UpdateBrandingDto,
  UpdateAttendanceMethodsDto, UpdateItSettingsDto, UpdatePublicSectorSettingsDto,
  UpdateShiftWorkerSettingsDto, UpdatePartTimeSettingsDto, UpdateFieldVisitWorkspaceSettingsDto,
} from './dto/workspace.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /** GET /workspace/industry-presets — 업종 프리셋 목록 (전 직원 조회 가능) */
  @Get('industry-presets')
  getIndustryPresets() {
    return { success: true, data: this.workspaceService.getIndustryPresets() };
  }

  /** GET /workspace/settings */
  @Get('settings')
  async getSettings(@GetUser() user: AuthenticatedUser) {
    return this.workspaceService.getSettings(user);
  }

  /** PATCH /workspace/settings — 회사 기본 정보 */
  @Patch('settings')
  async updateWorkspace(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.updateWorkspace(user, dto);
  }

  /** PATCH /workspace/work-settings — 근무 시간/요일 */
  @Patch('work-settings')
  async updateWorkSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateWorkSettingsDto) {
    return this.workspaceService.updateWorkSettings(user, dto);
  }

  /** PATCH /workspace/gps-settings — GPS 설정 */
  @Patch('gps-settings')
  async updateGpsSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateGpsSettingsDto) {
    return this.workspaceService.updateGpsSettings(user, dto);
  }

  /** PATCH /workspace/branding — 커버 이미지 & 브랜딩 */
  @Patch('branding')
  async updateBranding(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateBrandingDto) {
    return this.workspaceService.updateBranding(user, dto);
  }

  /** PATCH /workspace/attendance-methods — 출퇴근 방식 설정 (owner) */
  @Patch('attendance-methods')
  async updateAttendanceMethods(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateAttendanceMethodsDto) {
    const data = await this.workspaceService.updateAttendanceMethods(user, dto);
    return { success: true, data };
  }

  /** PATCH /workspace/it-settings — IT/스타트업 특화 설정 (owner) */
  @Patch('it-settings')
  async updateItSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateItSettingsDto) {
    const data = await this.workspaceService.updateItSettings(user, dto);
    return { success: true, data };
  }

  /** PATCH /workspace/public-sector-settings — 공공기관 특화 설정 (owner) */
  @Patch('public-sector-settings')
  async updatePublicSectorSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdatePublicSectorSettingsDto) {
    const data = await this.workspaceService.updatePublicSectorSettings(user, dto);
    return { success: true, data };
  }

  /** PATCH /workspace/shift-worker-settings — 현장직/교대근무직 특화 설정 (owner) */
  @Patch('shift-worker-settings')
  async updateShiftWorkerSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateShiftWorkerSettingsDto) {
    const data = await this.workspaceService.updateShiftWorkerSettings(user, dto);
    return { success: true, data };
  }

  /** PATCH /workspace/part-time-settings — 파트타임/아르바이트 특화 설정 (owner) */
  @Patch('part-time-settings')
  async updatePartTimeSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdatePartTimeSettingsDto) {
    const data = await this.workspaceService.updatePartTimeSettings(user, dto);
    return { success: true, data };
  }

  /** PATCH /workspace/field-visit-settings — 현장 외근직 설정 (owner) */
  @Patch('field-visit-settings')
  async updateFieldVisitSettings(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateFieldVisitWorkspaceSettingsDto) {
    const data = await this.workspaceService.updateFieldVisitSettings(user, dto);
    return { success: true, data };
  }
}
