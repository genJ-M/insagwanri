import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ShiftSwapService } from './shift-swap.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateSwapRequestDto, PeerRespondDto, ApproveRejectDto, SwapQueryDto, VolunteerDto,
} from './dto/shift-swap.dto';

@Controller('shift-swap')
export class ShiftSwapController {
  constructor(private readonly svc: ShiftSwapService) {}

  /** GET /shift-swap — 목록 (관리자: 전체 / 직원: 본인 관련 + open) */
  @Get()
  async findAll(@GetUser() user: AuthenticatedUser, @Query() q: SwapQueryDto) {
    const data = await this.svc.findAll(user, q);
    return { success: true, data };
  }

  /** GET /shift-swap/board — 대타 게시판 (cover open 목록) */
  @Get('board')
  async findBoard(@GetUser() user: AuthenticatedUser) {
    const data = await this.svc.findBoard(user);
    return { success: true, data };
  }

  /** POST /shift-swap — 교환 신청 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser() user: AuthenticatedUser, @Body() dto: CreateSwapRequestDto) {
    const data = await this.svc.create(user, dto);
    return { success: true, data };
  }

  /** POST /shift-swap/:id/peer-respond — 상대방 수락/거절 */
  @Post(':id/peer-respond')
  @HttpCode(HttpStatus.OK)
  async peerRespond(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PeerRespondDto,
  ) {
    const data = await this.svc.peerRespond(user, id, dto);
    return { success: true, data };
  }

  /** POST /shift-swap/:id/volunteer — 대타 자원 */
  @Post(':id/volunteer')
  @HttpCode(HttpStatus.OK)
  async volunteer(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VolunteerDto,
  ) {
    const data = await this.svc.volunteer(user, id, dto);
    return { success: true, data };
  }

  /** PATCH /shift-swap/:id/approve — 업주 승인 */
  @Patch(':id/approve')
  async approve(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
  ) {
    const data = await this.svc.approve(user, id, dto);
    return { success: true, data };
  }

  /** PATCH /shift-swap/:id/reject — 업주 거절 */
  @Patch(':id/reject')
  async reject(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveRejectDto,
  ) {
    const data = await this.svc.reject(user, id, dto);
    return { success: true, data };
  }

  /** DELETE /shift-swap/:id — 요청자 취소 */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancel(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.svc.cancel(user, id);
    return { success: true, data };
  }
}
