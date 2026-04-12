import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApprovalsService } from './approvals.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateApprovalDto, UpdateApprovalDto, ActApprovalDto, ApprovalQueryDto,
} from './dto/approval.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  @Get('templates')
  getTemplates() {
    return this.svc.getTemplates();
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ApprovalQueryDto) {
    return this.svc.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateApprovalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.submit(id, user);
  }

  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.approve(id, dto, user);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.reject(id, dto, user);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.cancel(id, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.remove(id, user);
  }

  /** 봉인 문서 인쇄용 HTML (브라우저에서 PDF 인쇄) */
  @Get(':id/print')
  async print(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const html = await this.svc.getPrintHtml(id, user);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(html);
  }

  /** 문서 무결성 검증 */
  @Get(':id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.verifyIntegrity(id, user);
  }
}
