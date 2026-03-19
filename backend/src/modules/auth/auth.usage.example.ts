/**
 * ──────────────────────────────────────────────────────────
 * 다른 모듈 컨트롤러에서 인증/권한을 적용하는 예시입니다.
 * 실제 구현 파일이 아닌 참고용 예시 파일입니다.
 * ──────────────────────────────────────────────────────────
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles, Public } from './decorators/roles.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';

// ──────────────────────────────────────────────
// app.module.ts에서 전역 가드를 등록했으므로
// @UseGuards(JwtAuthGuard, RolesGuard)는 생략 가능합니다.
// @Roles()와 @Public()만 붙이면 됩니다.
// ──────────────────────────────────────────────

@Controller('attendance')
export class AttendanceExampleController {

  // ① 인증 불필요 라우트
  @Public()
  @Get('health')
  healthCheck() {
    return 'OK';
  }

  // ② 인증만 필요 (역할 무관) — 본인 근태 조회
  @Get('me')
  getMyAttendance(@GetUser() user: AuthenticatedUser) {
    // user.id, user.companyId, user.role 모두 사용 가능
    console.log(`company: ${user.companyId}, user: ${user.id}`);
    return {};
  }

  // ③ 특정 역할만 허용 — 전체 근태 조회 (owner, manager)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  getAllAttendance(
    @GetUser() user: AuthenticatedUser,
    @Query('date') date: string,
  ) {
    // user.companyId로 해당 회사 데이터만 조회해야 합니다 (멀티테넌트 필수)
    return {};
  }

  // ④ owner만 허용
  @Roles(UserRole.OWNER)
  @Patch(':id')
  updateAttendance(
    @Param('id') id: string,
    @GetUser('companyId') companyId: string, // 특정 필드만 추출
    @Body() body: any,
  ) {
    return {};
  }

  // ⑤ 컨트롤러 레벨 역할 지정 (클래스 전체에 적용)
  // @Roles(UserRole.OWNER, UserRole.MANAGER) 를 클래스에 붙이면
  // 해당 컨트롤러의 모든 메서드에 적용됩니다.
}

// ──────────────────────────────────────────────
// 멀티테넌트 필수 패턴
// 모든 DB 쿼리에 companyId 조건을 반드시 포함해야 합니다.
// ──────────────────────────────────────────────
/*
async getTasksByCompany(user: AuthenticatedUser) {
  return this.taskRepository.find({
    where: {
      companyId: user.companyId,  // ← 멀티테넌트 격리 필수
    },
  });
}
*/
