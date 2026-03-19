import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GetUser } from './decorators/get-user.decorator';
import { Public } from './decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * 회사 최초 가입 — 회사 생성 + owner 계정 동시 생성
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /auth/login
   * 로그인 — access_token + refresh_token 발급
   * Rate limit: 5회 / 60초 (브루트포스 방지)
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /auth/refresh
   * Access Token 재발급 (Refresh Token Rotation 적용)
   * Body: { refresh_token: string }
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@GetUser() user: any) {
    const result = await this.authService.refreshTokens(
      user.sub,
      user.companyId,
      user.refreshToken,
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /auth/logout
   * 로그아웃 — DB의 Refresh Token 무효화
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@GetUser() user: AuthenticatedUser) {
    await this.authService.logout(user.id);
    return {
      success: true,
      data: null,
    };
  }

  /**
   * GET /auth/me
   * 현재 인증된 사용자 정보 확인
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@GetUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: user,
    };
  }

  /**
   * GET /auth/verify-email?token=...
   * 이메일 인증 토큰 확인
   */
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { success: true, data: { message: '이메일 인증이 완료되었습니다.' } };
  }

  /**
   * POST /auth/resend-verification
   * 이메일 인증 재발송 (로그인 상태에서)
   */
  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@GetUser() user: AuthenticatedUser) {
    await this.authService.resendVerification(user.id);
    return { success: true, data: { message: '인증 이메일을 재발송했습니다.' } };
  }

  /**
   * POST /auth/forgot-password
   * 비밀번호 재설정 이메일 발송 (이메일 존재 여부 미노출)
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      success: true,
      data: { message: '이메일이 등록되어 있다면 재설정 링크를 발송했습니다.' },
    };
  }

  /**
   * POST /auth/reset-password
   * 토큰으로 비밀번호 실제 변경
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { success: true, data: { message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' } };
  }
}
