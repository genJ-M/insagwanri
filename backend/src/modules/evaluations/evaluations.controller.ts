import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import {
  CreateCycleDto, UpdateCycleDto, AddParticipantsDto,
  SaveAnswersDto, EvaluationQueryDto,
} from './dto/evaluation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly svc: EvaluationsService) {}

  // ─── 사이클 ──────────────────────────────────────

  @Get('cycles')
  getCycles(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getCycles(user);
  }

  @Post('cycles')
  createCycle(@Body() dto: CreateCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.createCycle(dto, user);
  }

  @Get('cycles/:cycleId')
  getCycleDetail(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.getCycleDetail(cycleId, user);
  }

  @Patch('cycles/:cycleId')
  updateCycle(
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateCycleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateCycle(cycleId, dto, user);
  }

  @Post('cycles/:cycleId/activate')
  activateCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.activateCycle(cycleId, user);
  }

  @Post('cycles/:cycleId/publish')
  publishCycle(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.publishCycle(cycleId, user);
  }

  @Post('cycles/:cycleId/participants')
  addParticipants(
    @Param('cycleId') cycleId: string,
    @Body() dto: AddParticipantsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.addParticipantsToExisting(cycleId, dto, user);
  }

  // ─── 피평가자 결과 ────────────────────────────────

  @Get('cycles/:cycleId/results/:evaluateeId')
  getEvaluateeResults(
    @Param('cycleId') cycleId: string,
    @Param('evaluateeId') evaluateeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.getEvaluateeResults(cycleId, evaluateeId, user);
  }

  // ─── 평가 목록 / 단건 ─────────────────────────────

  @Get()
  getMyEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EvaluationQueryDto,
  ) {
    return this.svc.getMyEvaluations(user, query);
  }

  @Get(':evalId')
  getEvaluation(
    @Param('evalId') evalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.getEvaluation(evalId, user);
  }

  @Post(':evalId/answers')
  saveAnswers(
    @Param('evalId') evalId: string,
    @Body() dto: SaveAnswersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.saveAnswers(evalId, dto, user);
  }

  @Post(':evalId/submit')
  submitEvaluation(
    @Param('evalId') evalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.submitEvaluation(evalId, user);
  }
}
