import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
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
import { IsString, MinLength, IsIn } from 'class-validator';

class SocialCompleteDto {
  @IsString()
  pending_token: string;

  @IsString()
  @MinLength(2)
  company_name: string;
}

class MobileSocialDto {
  @IsString()
  @IsIn(['google', 'kakao'])
  provider: 'google' | 'kakao';

  @IsString()
  code: string;

  @IsString()
  redirect_uri: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
    await this.authService.logout(user.id, user.companyId);
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

  // ──────────────────────────────────────────────
  // Google OAuth
  // ──────────────────────────────────────────────

  /** GET /auth/google — Google 로그인 시작 */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport가 Google 로그인 페이지로 리다이렉트
  }

  /** GET /auth/google/callback — Google OAuth 콜백 */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleSocialCallback(req.user as any, res);
  }

  // ──────────────────────────────────────────────
  // Kakao OAuth
  // ──────────────────────────────────────────────

  /** GET /auth/kakao — Kakao 로그인 시작 */
  @Public()
  @Get('kakao')
  kakaoLogin(@Res() res: Response) {
    const clientId = this.configService.get<string>('KAKAO_CLIENT_ID');
    const callbackUrl = encodeURIComponent(
      this.configService.get<string>('KAKAO_CALLBACK_URL', ''),
    );
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code`;
    res.redirect(kakaoAuthUrl);
  }

  /** GET /auth/kakao/callback — Kakao OAuth 콜백 */
  @Public()
  @Get('kakao/callback')
  async kakaoCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/login?error=kakao_denied`);
    }
    const socialUser = await this.authService.kakaoExchangeCode(code);
    return this.handleSocialCallback(socialUser, res);
  }

  // ──────────────────────────────────────────────
  // 소셜 회원가입 완료 (회사명 입력)
  // ──────────────────────────────────────────────

  /** POST /auth/social-complete — 소셜 신규 유저 회사명 입력 후 가입 완료 */
  @Public()
  @Post('social-complete')
  @HttpCode(HttpStatus.CREATED)
  async socialComplete(@Body() dto: SocialCompleteDto) {
    const result = await this.authService.completeSocialRegister(dto.pending_token, dto.company_name);
    return { success: true, data: result };
  }

  // ──────────────────────────────────────────────
  // 모바일 소셜 로그인 (코드 교환 → JWT 반환)
  // ──────────────────────────────────────────────

  /**
   * POST /auth/social/mobile
   * 모바일 앱에서 OAuth 코드를 받아 JWT 발급.
   * 신규 유저는 { type: 'register', pending_token } 반환.
   */
  @Public()
  @Post('social/mobile')
  @HttpCode(HttpStatus.OK)
  async socialMobile(@Body() dto: MobileSocialDto) {
    let socialUser;
    if (dto.provider === 'google') {
      socialUser = await this.authService.googleExchangeCode(dto.code, dto.redirect_uri);
    } else {
      socialUser = await this.authService.kakaoExchangeCode(dto.code, dto.redirect_uri);
    }

    const result = await this.authService.handleSocialLogin(socialUser);

    if (result.type === 'login') {
      return { success: true, data: { type: 'login', ...result.tokens } };
    } else {
      return {
        success: true,
        data: {
          type: 'register',
          pending_token: result.pendingToken,
          name: result.socialUser.name,
          email: result.socialUser.email,
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // 전화번호 OTP 발송 (비밀번호 찾기)
  // ──────────────────────────────────────────────
  @Public()
  @Post('send-phone-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 60초당 3회 제한
  async sendPhoneOtp(@Body() body: { phone: string }) {
    await this.authService.sendPhoneOtp(body.phone);
    return {
      success: true,
      data: { message: '등록된 번호라면 인증번호를 발송했습니다.' },
    };
  }

  // ──────────────────────────────────────────────
  // OTP 검증 → 비밀번호 재설정 토큰 반환
  // ──────────────────────────────────────────────
  @Public()
  @Post('verify-phone-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyPhoneOtp(@Body() body: { phone: string; code: string }) {
    const result = await this.authService.verifyPhoneOtp(body.phone, body.code);
    return { success: true, data: result };
  }

  // ──────────────────────────────────────────────
  // 공통 소셜 콜백 처리
  // ──────────────────────────────────────────────
  private async handleSocialCallback(socialUser: any, res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const result = await this.authService.handleSocialLogin(socialUser);

    if (result.type === 'login') {
      const { access_token, refresh_token } = result.tokens;
      return res.redirect(
        `${frontendUrl}/auth/callback?access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`,
      );
    } else {
      // 신규 유저 — 회사명 입력 페이지로
      return res.redirect(
        `${frontendUrl}/auth/social-complete?pending_token=${encodeURIComponent(result.pendingToken)}&name=${encodeURIComponent(result.socialUser.name)}&email=${encodeURIComponent(result.socialUser.email)}`,
      );
    }
  }
}
