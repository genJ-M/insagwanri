import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { InvitationsService } from './invitations.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles, Public } from '../auth/decorators/roles.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import { CreateInviteLinkDto, JoinViaLinkDto } from './dto/invitations.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly svc: InvitationsService) {}

  // ─── 관리자 전용 ─────────────────────────────────────────────────────────

  /** POST /api/v1/invitations/links — 초대 링크 생성 */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('links')
  createLink(@GetUser() user: AuthenticatedUser, @Body() dto: CreateInviteLinkDto) {
    return this.svc.createLink(user, dto);
  }

  /** GET /api/v1/invitations/links — 초대 링크 목록 */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('links')
  listLinks(@GetUser() user: AuthenticatedUser) {
    return this.svc.listLinks(user);
  }

  /** PATCH /api/v1/invitations/links/:id/cancel — 초대 링크 취소 */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch('links/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelLink(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.cancelLink(user, id);
  }

  /** DELETE /api/v1/invitations/links/:id — 초대 링크 삭제 */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete('links/:id')
  deleteLink(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteLink(user, id);
  }

  // ─── 공개 엔드포인트 (가입 전) ────────────────────────────────────────────

  /** GET /api/v1/invitations/join/:token — 링크 미리보기 (인증 불필요) */
  @Public()
  @Get('join/:token')
  getLinkInfo(@Param('token') token: string) {
    return this.svc.getLinkInfo(token);
  }

  /** POST /api/v1/invitations/join/:token — 초대 링크 가입 (인증 불필요) */
  @Public()
  @Post('join/:token')
  @HttpCode(HttpStatus.CREATED)
  joinViaLink(
    @Param('token') token: string,
    @Body() dto: JoinViaLinkDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? 'unknown';
    return this.svc.joinViaLink(token, dto, ip);
  }
}
