import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import {
  CreateTeamDto, UpdateTeamDto,
  AddTeamMemberDto, SetTeamLeaderDto,
} from './dto/teams.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /** GET /teams — 회사 전체 팀 목록 */
  @Get()
  getTeams(@GetUser() user: AuthenticatedUser) {
    return this.teamsService.getTeams(user);
  }

  /** GET /teams/mine — 내가 속한 팀 목록 */
  @Get('mine')
  getMyTeams(@GetUser() user: AuthenticatedUser) {
    return this.teamsService.getMyTeams(user);
  }

  /** POST /teams — 팀 생성 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTeam(@GetUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(user, dto);
  }

  /** GET /teams/:id — 팀 상세 */
  @Get(':id')
  getTeam(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.teamsService.getTeam(user, id);
  }

  /** PATCH /teams/:id — 팀 정보 수정 */
  @Patch(':id')
  updateTeam(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(user, id, dto);
  }

  /** DELETE /teams/:id — 팀 삭제 (owner 전용) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTeam(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.teamsService.deleteTeam(user, id);
  }

  /** GET /teams/:id/members — 팀원 목록 */
  @Get(':id/members')
  getTeamMembers(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.teamsService.getTeamMembers(user, id);
  }

  /** POST /teams/:id/members — 팀원 추가 */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addTeamMember(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addTeamMember(user, id, dto);
  }

  /** DELETE /teams/:id/members/:userId — 팀원 제거 */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTeamMember(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeTeamMember(user, id, userId);
  }

  /** PATCH /teams/:id/leader — 팀장 지정 */
  @Patch(':id/leader')
  setTeamLeader(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetTeamLeaderDto,
  ) {
    return this.teamsService.setTeamLeader(user, id, dto);
  }
}
