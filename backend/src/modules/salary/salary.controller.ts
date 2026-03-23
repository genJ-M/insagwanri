import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  CreateSalaryDto, UpdateSalaryDto, SalaryQueryDto, AutoCalculateDto,
} from './dto/salary.dto';

@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  /** GET /salary — 급여 목록 (관리자: 전체, 직원: 본인) */
  @Get()
  async findAll(@GetUser() user: AuthenticatedUser, @Query() query: SalaryQueryDto) {
    const data = await this.salaryService.findAll(user, query);
    return { success: true, data };
  }

  /** GET /salary/me — 내 급여 목록 */
  @Get('me')
  async findMine(@GetUser() user: AuthenticatedUser, @Query() query: SalaryQueryDto) {
    const data = await this.salaryService.findMine(user, query);
    return { success: true, data };
  }

  /** GET /salary/summary?year=&month= — 월별 요약 통계 */
  @Get('summary')
  async summary(
    @GetUser() user: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const data = await this.salaryService.monthlySummary(
      user,
      parseInt(year, 10),
      parseInt(month, 10),
    );
    return { success: true, data };
  }

  /** POST /salary/calculate — 4대보험 자동 계산 (UI 헬퍼) */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@GetUser() user: AuthenticatedUser, @Body() dto: AutoCalculateDto) {
    const data = this.salaryService.calculate(user, dto);
    return { success: true, data };
  }

  /** GET /salary/:id — 단건 조회 */
  @Get(':id')
  async findOne(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.salaryService.findOne(user, id);
    return { success: true, data };
  }

  /** POST /salary — 급여 생성 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser() user: AuthenticatedUser, @Body() dto: CreateSalaryDto) {
    const data = await this.salaryService.create(user, dto);
    return { success: true, data };
  }

  /** PATCH /salary/:id — 급여 수정 */
  @Patch(':id')
  async update(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryDto,
  ) {
    const data = await this.salaryService.update(user, id, dto);
    return { success: true, data };
  }

  /** PATCH /salary/:id/confirm — 확정 */
  @Patch(':id/confirm')
  async confirm(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.salaryService.confirm(user, id);
    return { success: true, data };
  }

  /** PATCH /salary/:id/pay — 지급완료 */
  @Patch(':id/pay')
  async pay(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.salaryService.markPaid(user, id);
    return { success: true, data };
  }

  /** DELETE /salary/:id */
  @Delete(':id')
  async remove(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.salaryService.remove(user, id);
    return { success: true, data };
  }
}
