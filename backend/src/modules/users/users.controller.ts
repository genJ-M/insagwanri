import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  InviteUserDto, AcceptInviteDto, UpdateUserDto,
  UpdateRoleDto, ChangePasswordDto, UserQueryDto,
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

  /** POST /users/invite — 직원 초대 */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@GetUser() user: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.usersService.inviteUser(user, dto);
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

  /** DELETE /users/:id — 직원 비활성화 (owner) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deactivateUser(user, id);
  }
}
