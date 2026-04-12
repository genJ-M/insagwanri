import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  InviteUserDto, InviteByPhoneDto, CreateShareableLinkDto,
  AcceptInviteDto, UpdateUserDto,
  UpdateRoleDto, UpdatePermissionsDto, ChangePasswordDto, UserQueryDto,
  RequestPermissionChangeDto, UpdateWorkScheduleDto, RequestWorkScheduleChangeDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Public } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users — 직원 목록 */
  @Get()
  async findAll(@GetUser() user: AuthenticatedUser, @Query() query: UserQueryDto) {
    return this.usersService.findAll(user, query);
  }

  /** GET /users/me — 내 프로필 */
  @Get('me')
  async getMe(@GetUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user, user.id);
  }

  /** PATCH /users/me — 내 프로필 수정 */
  @Patch('me')
  async updateMe(@GetUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user, dto);
  }

  /** PATCH /users/me/password — 비밀번호 변경 */
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@GetUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user, dto);
  }

  /** POST /users/invite — 이메일로 직원 초대 */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@GetUser() user: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.usersService.inviteUser(user, dto);
  }

  /** POST /users/invite/phone — 전화번호로 직원 초대 (SMS) */
  @Post('invite/phone')
  @HttpCode(HttpStatus.CREATED)
  async inviteByPhone(@GetUser() user: AuthenticatedUser, @Body() dto: InviteByPhoneDto) {
    return this.usersService.inviteByPhone(user, dto);
  }

  /** POST /users/invite/link — 공유 초대 링크 생성 */
  @Post('invite/link')
  @HttpCode(HttpStatus.CREATED)
  async createInviteLink(@GetUser() user: AuthenticatedUser, @Body() dto: CreateShareableLinkDto) {
    return this.usersService.createShareableLink(user, dto);
  }

  /** GET /users/org-stats — 조직 통계 */
  @Get('org-stats')
  async getOrgStats(@GetUser() user: AuthenticatedUser) {
    return this.usersService.getOrgStats(user);
  }

  /** GET /users/birthdays/this-month — 이달 생일 목록 (manager/owner) */
  @Get('birthdays/this-month')
  async getBirthdaysThisMonth(@GetUser() user: AuthenticatedUser) {
    return this.usersService.getBirthdaysThisMonth(user);
  }

  /** GET /users/birthdays/upcoming?days=30 — 다가오는 생일 (manager/owner) */
  @Get('birthdays/upcoming')
  async getUpcomingBirthdays(
    @GetUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.usersService.getUpcomingBirthdays(user, days ? Number(days) : 30);
  }

  /** GET /users/invites — 대기 중인 초대 목록 */
  @Get('invites')
  async findInvites(@GetUser() user: AuthenticatedUser) {
    return this.usersService.findInvites(user);
  }

  /** DELETE /users/invites/:id — 초대 취소 */
  @Delete('invites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvite(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.cancelInvite(user, id);
  }

  /** POST /users/invites/:id/resend — 초대 재발송 */
  @Post('invites/:id/resend')
  async resendInvite(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.resendInvite(user, id);
  }

  /** GET /auth/invite?token= — 초대 정보 조회 (Public) */
  @Public()
  @Get('invite-info')
  async getInviteInfo(@Query('token') token: string) {
    return this.usersService.getInviteInfo(token);
  }

  /** POST /auth/accept-invite — 초대 수락 (Public) */
  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  /** GET /users/:id/certificate?type=employment|career — 증명서 데이터 */
  @Get(':id/certificate')
  async getCertificate(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('type') type: string,
  ) {
    return this.usersService.getCertificateData(user, id, type);
  }

  /** GET /users/:id — 특정 직원 조회 */
  @Get(':id')
  async findOne(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.findOne(user, id);
  }

  /** PATCH /users/:id — 직원 정보 수정 (owner/manager) */
  @Patch(':id')
  async updateUser(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user, id, dto);
  }

  /** PATCH /users/:id/role — 역할 변경 (owner) */
  @Patch(':id/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRole(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(user, id, dto);
  }

  /** GET /users/permission-change-template — 권한 변경 기안 작성 가이드 */
  @Get('permission-change-template')
  getPermissionChangeTemplate() {
    return this.usersService.getPermissionChangeTemplate();
  }

  /** PATCH /users/:id/permissions — 세부 권한 직접 설정 (owner / 위임자만) */
  @Patch(':id/permissions')
  async updatePermissions(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.usersService.updatePermissions(user, id, dto);
  }

  /** POST /users/:id/permissions/request — 권한 변경 결재 기안 (manager 이상) */
  @Post(':id/permissions/request')
  async requestPermissionChange(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequestPermissionChangeDto,
  ) {
    return this.usersService.requestPermissionChange(user, id, dto);
  }

  /** DELETE /users/:id — 직원 비활성화 (owner) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deactivateUser(user, id);
  }

  // ── 경력 ──────────────────────────────────
  @Get(':id/careers')
  getCareers(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getCareers(user, id);
  }

  @Post(':id/careers')
  @HttpCode(HttpStatus.CREATED)
  createCareer(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.createCareer(user, id, dto);
  }

  @Patch(':id/careers/:cid')
  updateCareer(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Param('cid') cid: string, @Body() dto: any) {
    return this.usersService.updateCareer(user, id, cid, dto);
  }

  @Delete(':id/careers/:cid')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCareer(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Param('cid') cid: string) {
    return this.usersService.deleteCareer(user, id, cid);
  }

  // ── 학력 ──────────────────────────────────
  @Get(':id/educations')
  getEducations(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getEducations(user, id);
  }

  @Post(':id/educations')
  @HttpCode(HttpStatus.CREATED)
  createEducation(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.createEducation(user, id, dto);
  }

  @Patch(':id/educations/:eid')
  updateEducation(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Param('eid') eid: string, @Body() dto: any) {
    return this.usersService.updateEducation(user, id, eid, dto);
  }

  @Delete(':id/educations/:eid')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEducation(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Param('eid') eid: string) {
    return this.usersService.deleteEducation(user, id, eid);
  }

  // ── 첨부문서 ──────────────────────────────
  @Get(':id/documents')
  getDocuments(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getDocuments(user, id);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  createDocument(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: any) {
    return this.usersService.createDocument(user, id, dto);
  }

  @Delete(':id/documents/:did')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(@GetUser() user: AuthenticatedUser, @Param('id') id: string, @Param('did') did: string) {
    return this.usersService.deleteDocument(user, id, did);
  }

  // ── 개인 근무 스케줄 ──────────────────────────
  /**
   * GET /users/:id/work-schedule
   * 개인 근무 스케줄 조회 (본인 또는 관리자)
   */
  @Get(':id/work-schedule')
  async getWorkSchedule(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.usersService.getWorkSchedule(user, id);
    return { success: true, data };
  }

  /**
   * PATCH /users/:id/work-schedule
   * 개인 근무 스케줄 직접 변경 (owner / 계약 관리 권한자)
   */
  @Patch(':id/work-schedule')
  async updateWorkSchedule(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    const data = await this.usersService.updateWorkSchedule(user, id, dto);
    return { success: true, data };
  }

  /**
   * POST /users/work-schedule-change
   * 근무 스케줄 변경 결재 기안 생성 (manager 이하)
   * → 결재 완료 시 자동으로 개인 스케줄에 반영됨
   */
  @Post('work-schedule-change')
  @HttpCode(HttpStatus.CREATED)
  async requestWorkScheduleChange(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: RequestWorkScheduleChangeDto,
  ) {
    const data = await this.usersService.requestWorkScheduleChange(user, dto);
    return { success: true, data };
  }

  /**
   * GET /users/me/work-schedule
   * 내 근무 스케줄 조회
   */
  @Get('me/work-schedule')
  async getMyWorkSchedule(@GetUser() user: AuthenticatedUser) {
    const data = await this.usersService.getWorkSchedule(user, user.id);
    return { success: true, data };
  }
}
