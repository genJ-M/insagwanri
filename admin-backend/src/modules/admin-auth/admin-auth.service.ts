import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { AdminUser, AdminRole } from '../../database/entities/admin-user.entity';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminLoginDto, AdminMfaVerifyDto, AdminMfaSetupInitDto, AdminMfaSetupConfirmDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // 로그인 (1단계: 비밀번호 검증 → 임시 토큰 발급)
  // ──────────────────────────────────────────────
  async login(dto: AdminLoginDto) {
    const user = await this.adminUserRepository.findOne({
      where: { email: dto.email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // MFA 설정 여부에 따라 분기
    if (!user.totpEnabled) {
      // MFA 미설정: SUPER_ADMIN이면 MFA 설정 강제
      if (user.role === AdminRole.SUPER_ADMIN) {
        const setupToken = this.signTempToken(user, false);
        return {
          requiresMfaSetup: true,
          tempToken: setupToken,
          message: 'SUPER_ADMIN은 MFA 설정이 필요합니다.',
        };
      }
      // 일반 역할: MFA 없이 최종 토큰 발급
      const token = this.signFinalToken(user);
      await this.adminUserRepository.update(user.id, { lastLoginAt: new Date() });
      return { accessToken: token, mfaRequired: false };
    }

    // MFA 설정됨: 임시 토큰 발급 후 TOTP 인증 단계로
    const tempToken = this.signTempToken(user, false);
    return {
      requiresMfaVerification: true,
      tempToken,
    };
  }

  // ──────────────────────────────────────────────
  // MFA 코드 검증 (2단계)
  // ──────────────────────────────────────────────
  async verifyMfa(dto: AdminMfaVerifyDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.get<string>('ADMIN_JWT_TEMP_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('임시 토큰이 유효하지 않습니다.');
    }

    const user = await this.adminUserRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const isValid = this.validateTotpCode(user.totpSecret, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('MFA 코드가 올바르지 않습니다.');
    }

    const token = this.signFinalToken(user);
    await this.adminUserRepository.update(user.id, { lastLoginAt: new Date() });
    return { accessToken: token };
  }

  // ──────────────────────────────────────────────
  // MFA 설정 시작 (QR 코드 발급) — temp token으로 인증
  // ──────────────────────────────────────────────
  async setupMfaInit(dto: AdminMfaSetupInitDto): Promise<{ qrCodeUrl: string; secret: string }> {
    const adminUserId = this.verifyTempToken(dto.tempToken);
    const user = await this.adminUserRepository.findOne({ where: { id: adminUserId } });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    if (user.totpEnabled) throw new ConflictException('이미 MFA가 설정되어 있습니다.');

    const secret = crypto.randomBytes(20).toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 32).toUpperCase();

    const totp = new OTPAuth.TOTP({
      issuer: '관리왕 Admin',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const otpAuthUrl = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    // 임시 저장 (아직 활성화 안됨)
    await this.adminUserRepository.update(user.id, { totpSecret: secret });

    return { qrCodeUrl, secret };
  }

  // ──────────────────────────────────────────────
  // MFA 설정 완료 (TOTP 코드 확인) — temp token으로 인증
  // ──────────────────────────────────────────────
  async setupMfaConfirm(dto: AdminMfaSetupConfirmDto): Promise<{ accessToken: string }> {
    const adminUserId = this.verifyTempToken(dto.tempToken);
    const user = await this.adminUserRepository.findOne({ where: { id: adminUserId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('MFA 초기화를 먼저 진행해주세요.');
    }
    if (user.totpEnabled) {
      throw new ConflictException('이미 MFA가 활성화되어 있습니다.');
    }

    const isValid = this.validateTotpCode(user.totpSecret, dto.code);
    if (!isValid) {
      throw new BadRequestException('MFA 코드가 올바르지 않습니다. 다시 시도해주세요.');
    }

    await this.adminUserRepository.update(user.id, { totpEnabled: true, lastLoginAt: new Date() });

    // 설정 완료 즉시 최종 토큰 발급 (다시 로그인 불필요)
    const token = this.signFinalToken({ ...user, totpEnabled: true });
    return { accessToken: token };
  }

  // ──────────────────────────────────────────────
  // 내부 유틸
  // ──────────────────────────────────────────────
  // temp token에서 userId 추출 및 검증
  private verifyTempToken(tempToken: string): string {
    try {
      const payload = this.jwtService.verify(tempToken, {
        secret: this.configService.get<string>('ADMIN_JWT_TEMP_SECRET'),
      }) as AdminJwtPayload;
      return payload.sub;
    } catch {
      throw new UnauthorizedException('임시 토큰이 유효하지 않습니다.');
    }
  }

  private signTempToken(user: AdminUser, mfaVerified: boolean): string {
    const payload: AdminJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      mfaVerified,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ADMIN_JWT_TEMP_SECRET'),
      expiresIn: '10m', // 임시 토큰: 10분
    });
  }

  private signFinalToken(user: AdminUser): string {
    const payload: AdminJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      mfaVerified: true,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ADMIN_JWT_SECRET'),
      expiresIn: '4h',
    });
  }

  private validateTotpCode(secret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // window=1: ±30초 허용
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }
}
