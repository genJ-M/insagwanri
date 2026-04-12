import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { VacationsService } from './vacations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateVacationDto, RejectVacationDto, VacationQueryDto, SetBalanceDto,
} from './dto/vacation.dto';

@Controller('vacations')
export class VacationsController {
  constructor(private readonly svc: VacationsService) {}

  /** 목록 조회 (관리자: 전체, 직원: 본인) */
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: VacationQueryDto,
  ) {
    return this.svc.findAll(user, query);
  }

  /** 본인 잔여 휴가 */
  @Get('balance')
  getMyBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
  ) {
    return this.svc.getMyBalance(user, year ? Number(year) : undefined);
  }

  /** 팀 전체 잔여 휴가 (관리자) */
  @Get('balances/team')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getTeamBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
  ) {
    return this.svc.getTeamBalances(user, year ? Number(year) : undefined);
  }

  /** 단건 조회 */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.findOne(id, user);
  }

  /** 휴가 신청 */
  @Post()
  create(
    @Body() dto: CreateVacationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.create(dto, user);
  }

  /** 승인 (관리자 또는 팀장) */
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.approve(id, user);
  }

  /** 반려 (관리자 또는 팀장) */
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVacationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.reject(id, dto, user);
  }

  /** 취소 (본인) */
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.cancel(id, user);
  }

  /** 삭제 */
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.remove(id, user);
  }

  /** 잔여 휴가 설정 (관리자) */
  @Post('balances')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  setBalance(
    @Body() dto: SetBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.setBalance(dto, user);
  }
}
