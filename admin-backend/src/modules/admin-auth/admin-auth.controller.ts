import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminLoginDto,
  AdminMfaVerifyDto,
  AdminMfaSetupInitDto,
  AdminMfaSetupConfirmDto,
} from './dto/login.dto';

@Controller('admin/v1/auth')
export class AdminAuthController {
  constructor(private authService: AdminAuthService) {}

  // POST /admin/v1/auth/login — 비밀번호 1단계
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto);
  }

  // POST /admin/v1/auth/mfa/verify — TOTP 2단계 (MFA 설정된 사용자)
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  verifyMfa(@Body() dto: AdminMfaVerifyDto) {
    return this.authService.verifyMfa(dto);
  }

  // POST /admin/v1/auth/mfa/setup/init — QR 코드 발급 (SUPER_ADMIN 최초 설정)
  // 가드 없음 — tempToken을 body로 받아 서비스에서 직접 검증
  @Post('mfa/setup/init')
  setupMfaInit(@Body() dto: AdminMfaSetupInitDto) {
    return this.authService.setupMfaInit(dto);
  }

  // POST /admin/v1/auth/mfa/setup/confirm — MFA 활성화 완료 → 최종 토큰 발급
  @Post('mfa/setup/confirm')
  @HttpCode(HttpStatus.OK)
  setupMfaConfirm(@Body() dto: AdminMfaSetupConfirmDto) {
    return this.authService.setupMfaConfirm(dto);
  }
}
