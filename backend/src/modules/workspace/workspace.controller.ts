import { Controller, Get, Patch, Body } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import {
  UpdateWorkspaceDto, UpdateWorkSettingsDto, UpdateGpsSettingsDto,
} from './dto/workspace.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

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
}
