import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { TrainingService } from './training.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateTrainingDto, UpdateTrainingDto, EnrollDto, CompleteEnrollmentDto,
} from './dto/training.dto';

@Controller('training')
export class TrainingController {
  constructor(private readonly svc: TrainingService) {}

  /** 교육 목록 조회 */
  @Get()
  getTrainings(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getTrainings(user);
  }

  /** 내 수강 목록 */
  @Get('my')
  getMyTrainings(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getMyTrainings(user);
  }

  /** 교육 생성 (관리자) */
  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  createTraining(
    @Body() dto: CreateTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.createTraining(dto, user);
  }

  /** 교육 수정 (관리자) */
  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateTraining(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateTraining(id, dto, user);
  }

  /** 교육 취소 (관리자) */
  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  deleteTraining(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.deleteTraining(id, user);
  }

  /** 수강 등록 (관리자) */
  @Post(':id/enroll')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  enrollUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.enrollUsers(id, dto, user);
  }

  /** 수료 처리 (관리자) */
  @Post(':id/complete/:userId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  completeEnrollment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CompleteEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.completeEnrollment(id, userId, dto.note, user);
  }
}
