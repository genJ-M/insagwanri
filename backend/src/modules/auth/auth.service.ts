import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Company, CompanyStatus, CompanyType } from '../../database/entities/company.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { UserRole, JwtPayload } from '../../common/types/jwt-payload.type';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../notifications/email.service';
import { LoginLockService } from './services/login-lock.service';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { PhoneOtp, OtpPurpose } from '../../database/entities/phone-otp.entity';
import { SmsService } from '../../common/sms/sms.service';
import { SocialUser } from './strategies/google.strategy';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityAction } from '../../database/entities/user-activity-log.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,

    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,

    @InjectRepository(PhoneOtp)
    private phoneOtpRepository: Repository<PhoneOtp>,

    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    private emailService: EmailService,
    private smsService: SmsService,
    private loginLockService: LoginLockService,
    private cryptoService: CryptoService,
    private activityLogService: ActivityLogService,
  ) {}

  // ──────────────────────────────────────────────
  // 회원가입 (회사 + owner 동시 생성)
  // ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // 1. 이메일 중복 검사 (전체 범위 — HMAC 해시로 조회)
    const emailHash = this.cryptoService.hmac(dto.email.toLowerCase().trim());
    const existingUser = await this.userRepository.findOne({
      where: { emailHash },
      withDeleted: false,
    });

    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    // 사업자등록번호 중복 검사
    if (dto.business_number) {
      const existingCompany = await this.companyRepository.findOne({
        where: { businessNumber: dto.business_number },
      });
      if (existingCompany) {
        throw new ConflictException('이미 등록된 사업자등록번호입니다.');
      }
    }

    // 2. 트랜잭션으로 회사 + owner 계정 동시 생성
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 회사 생성
      const company = queryRunner.manager.create(Company, {
        name: dto.company_name,
        businessNumber: dto.business_number ?? null,
        companyType: dto.company_type ?? CompanyType.NONE,
        corporateNumber: dto.corporate_number ?? null,
        representativeName: dto.representative_name ?? null,
        businessType: dto.business_type ?? null,
        businessItem: dto.business_item ?? null,
        status: CompanyStatus.ACTIVE,
      });
      const savedCompany = await queryRunner.manager.save(company);

      // 비밀번호 해시
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      // owner 계정 생성
      const user = queryRunner.manager.create(User, {
        companyId: savedCompany.id,
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        joinedAt: new Date(),
      });
      const savedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      // 3. 이메일 인증 토큰 발행 (비동기 — 실패해도 가입은 완료)
      this.sendEmailVerification(savedUser).catch(() => {});

      // 4. 토큰 발급
      const tokens = await this.generateTokens(savedUser, savedCompany.id);

      return {
        user: this.formatUserResponse(savedUser),
        company: {
          id: savedCompany.id,
          name: savedCompany.name,
          plan: savedCompany.plan,
        },
        ...tokens,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ──────────────────────────────────────────────
  // 이메일 인증 토큰 발행 + 메일 발송
  // ──────────────────────────────────────────────
  private async sendEmailVerification(user: User): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    await this.emailVerificationRepository.save(
      this.emailVerificationRepository.create({
        userId: user.id,
        email: user.email,
        token,
        expiresAt,
      }),
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
    const expiresAtStr = expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    await this.emailService.sendEmailVerification({
      to: user.email,
      name: user.name,
      verifyUrl,
      expiresAt: expiresAtStr,
    });
  }

  // ──────────────────────────────────────────────
  // 이메일 인증 확인 (GET /auth/verify-email?token=)
  // ──────────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const verification = await this.emailVerificationRepository.findOne({
      where: { token },
    });

    if (!verification) {
      throw new BadRequestException('유효하지 않은 인증 링크입니다.');
    }
    if (verification.verifiedAt) {
      return; // 이미 인증 완료 — 멱등성 허용
    }
    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('만료된 인증 링크입니다. 재발송을 요청해 주세요.');
    }

    await this.emailVerificationRepository.update(verification.id, {
      verifiedAt: new Date(),
    });
  }

  // ──────────────────────────────────────────────
  // 이메일 인증 재발송 (POST /auth/resend-verification)
  // ──────────────────────────────────────────────
  async resendVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name'],
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 기존 미인증 토큰 무효화 처리 (verifiedAt이 null인 레코드 덮어쓰기)
    await this.sendEmailVerification(user as User);
  }

  // ──────────────────────────────────────────────
  // 로그인
  // ──────────────────────────────────────────────
  async login(dto: LoginDto) {
    // 0. 계정 잠금 여부 확인 (5회 연속 실패 시 15분 잠금)
    const locked = await this.loginLockService.isLocked(dto.email);
    if (locked) {
      const remainSec = await this.loginLockService.getLockTtl(dto.email);
      const remainMin = Math.ceil(remainSec / 60);
      throw new HttpException(
        `로그인 시도 횟수를 초과했습니다. ${remainMin}분 후 다시 시도해주세요.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 1. HMAC 해시로 사용자 조회 (password_hash 포함)
    const loginEmailHash = this.cryptoService.hmac(dto.email.toLowerCase().trim());
    const user = await this.userRepository.findOne({
      where: { emailHash: loginEmailHash },
      select: [
        'id',
        'companyId',
        'email',
        'name',
        'passwordHash',
        'role',
        'status',
        'deletedAt',
      ],
    });

    if (!user) {
      // 보안: 이메일/비밀번호 어느 쪽이 틀렸는지 노출하지 않음
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 2. Soft Delete 또는 비활성화 계정 차단
    if (user.deletedAt) {
      throw new UnauthorizedException('탈퇴한 계정입니다.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('초대를 수락하지 않은 계정입니다.');
    }

    // 3. 비밀번호 검증
    if (!user.passwordHash) {
      throw new UnauthorizedException('이 계정은 소셜 로그인 전용입니다. 소셜 계정으로 로그인해 주세요.');
    }
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const failCount = await this.loginLockService.recordFailure(dto.email);
      const remaining = Math.max(0, 5 - failCount);
      const message =
        remaining > 0
          ? `이메일 또는 비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`
          : '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.';
      throw new UnauthorizedException(message);
    }

    // 4. 회사 상태 검사
    const company = await this.companyRepository.findOne({
      where: { id: user.companyId },
      select: ['id', 'name', 'plan', 'status'],
    });

    if (!company || company.status !== CompanyStatus.ACTIVE) {
      throw new UnauthorizedException('비활성화된 회사 계정입니다. 고객센터에 문의하세요.');
    }

    // 5. 토큰 발급 + 마지막 로그인 시각 갱신 + 실패 카운터 초기화
    const tokens = await this.generateTokens(user, user.companyId);

    await Promise.all([
      this.userRepository.update(user.id, { lastLoginAt: new Date() }),
      this.loginLockService.clearFailures(dto.email),
    ]);

    // 통신비밀보호법 — 로그인 활동 기록 (fire-and-forget)
    this.activityLogService.log({
      userId: user.id,
      companyId: user.companyId,
      action: ActivityAction.LOGIN,
    });

    return {
      ...tokens,
      user: this.formatUserResponse(user),
    };
  }

  // ──────────────────────────────────────────────
  // Access Token 갱신
  // ──────────────────────────────────────────────
  async refreshTokens(userId: string, companyId: string, rawRefreshToken: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, companyId },
      select: ['id', 'companyId', 'email', 'name', 'role', 'refreshTokenHash', 'status'],
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    // DB에 저장된 해시와 비교
    const isRefreshTokenValid = await bcrypt.compare(
      rawRefreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      // 토큰 불일치 시 모든 토큰 무효화 (탈취 방지)
      await this.userRepository.update(user.id, { refreshTokenHash: null });
      throw new UnauthorizedException(
        'Refresh Token이 유효하지 않습니다. 다시 로그인하세요.',
      );
    }

    // Refresh Token Rotation: 새 토큰 발급
    return this.generateTokens(user, companyId);
  }

  // ──────────────────────────────────────────────
  // 로그아웃
  // ──────────────────────────────────────────────
  async logout(userId: string, companyId?: string) {
    // DB의 refresh_token_hash + current_session_id를 null로 설정하여 모든 세션 무효화
    await this.userRepository.update(userId, {
      refreshTokenHash: null as any,
      currentSessionId: null as any,
    });

    // 통신비밀보호법 — 로그아웃 활동 기록 (fire-and-forget)
    this.activityLogService.log({
      userId,
      companyId: companyId ?? null,
      action: ActivityAction.LOGOUT,
    });
  }

  // ──────────────────────────────────────────────
  // 토큰 생성 (내부 유틸)
  // ──────────────────────────────────────────────
  private async generateTokens(user: Partial<User>, companyId: string) {
    // 단일 기기 세션: 로그인마다 새 UUID 발급
    const sessionId = crypto.randomUUID();

    const payload: JwtPayload = {
      sub: user.id!,
      companyId,
      role: user.role!,
      email: user.email!,
      sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    // Refresh Token 해시 + 현재 세션 ID 저장 (이전 기기 세션 자동 무효화)
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id!, { refreshTokenHash, currentSessionId: sessionId });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15분 (초 단위)
    };
  }

  // ──────────────────────────────────────────────
  // 응답 포맷 정리 (민감 정보 제거)
  // ──────────────────────────────────────────────
  private formatUserResponse(user: Partial<User>) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }

  // ──────────────────────────────────────────────
  // 비밀번호 재설정 요청 (이메일 발송)
  // ──────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    // 보안: 이메일 존재 여부를 외부에 노출하지 않음 (항상 성공 응답)
    const forgotEmailHash = this.cryptoService.hmac(email.toLowerCase().trim());
    const user = await this.userRepository.findOne({
      where: { emailHash: forgotEmailHash },
      select: ['id', 'email', 'name'],
    });
    if (!user) return;

    // 기존 미사용 토큰 무효화
    await this.passwordResetTokenRepository.update(
      { userId: user.id, usedAt: IsNull() as any },
      { usedAt: new Date() },
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({ userId: user.id, token, expiresAt }),
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    this.emailService.sendPasswordReset({ to: user.email, name: user.name, resetUrl }).catch(() => {});
  }

  // ──────────────────────────────────────────────
  // 비밀번호 재설정 실행
  // ──────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.passwordResetTokenRepository.findOne({
      where: { token: dto.token },
      relations: ['user'],
    });

    if (!record) {
      throw new BadRequestException('유효하지 않은 재설정 링크입니다.');
    }
    if (record.usedAt) {
      throw new BadRequestException('이미 사용된 재설정 링크입니다.');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('만료된 재설정 링크입니다. 비밀번호 찾기를 다시 시도해주세요.');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);

    await Promise.all([
      this.userRepository.update(record.userId, { passwordHash, refreshTokenHash: null as any }),
      this.passwordResetTokenRepository.update(record.id, { usedAt: new Date() }),
    ]);
  }

  // ──────────────────────────────────────────────
  // 사용자 조회 (JwtStrategy에서 사용)
  // ──────────────────────────────────────────────
  async findUserById(userId: string, companyId: string) {
    return this.userRepository.findOne({
      where: { id: userId, companyId },
    });
  }

  // ──────────────────────────────────────────────
  // 소셜 로그인 처리 (Google / Kakao 공통)
  // ──────────────────────────────────────────────
  async handleSocialLogin(socialUser: SocialUser) {
    // 1. provider + providerAccountId 로 기존 연동 계정 조회
    let user = await this.userRepository.findOne({
      where: { provider: socialUser.provider, providerAccountId: socialUser.providerAccountId },
      select: ['id', 'companyId', 'email', 'name', 'role', 'status'],
    });

    // 2. 이메일 HMAC으로 기존 계정 조회 (계정 연결)
    if (!user) {
      const socialEmailHash = this.cryptoService.hmac(socialUser.email.toLowerCase().trim());
      user = await this.userRepository.findOne({
        where: { emailHash: socialEmailHash },
        select: ['id', 'companyId', 'email', 'name', 'role', 'status'],
      });

      if (user) {
        // 이메일 계정에 소셜 provider 연결
        await this.userRepository.update(user.id, {
          provider: socialUser.provider,
          providerAccountId: socialUser.providerAccountId,
          profileImageUrl: socialUser.profileImageUrl ?? undefined,
        });
      }
    }

    if (user) {
      if (user.status === UserStatus.INACTIVE) {
        throw new UnauthorizedException('비활성화된 계정입니다.');
      }
      // 기존 유저 — 바로 토큰 발급
      await this.userRepository.update(user.id, { lastLoginAt: new Date() });
      const tokens = await this.generateTokens(user, user.companyId);
      return { type: 'login' as const, tokens };
    }

    // 3. 신규 유저 — pending 토큰 발급 (회사명 입력 후 완료)
    const pendingPayload = {
      type: 'social_pending',
      provider: socialUser.provider,
      providerAccountId: socialUser.providerAccountId,
      email: socialUser.email,
      name: socialUser.name,
      profileImageUrl: socialUser.profileImageUrl,
    };

    const pendingToken = await this.jwtService.signAsync(pendingPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '10m',
    });

    return { type: 'register' as const, pendingToken, socialUser };
  }

  // ──────────────────────────────────────────────
  // 소셜 회원가입 완료 (회사명 + pending 토큰)
  // ──────────────────────────────────────────────
  async completeSocialRegister(pendingToken: string, companyName: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(pendingToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('소셜 인증 토큰이 만료되었습니다. 다시 시도해 주세요.');
    }

    if (payload.type !== 'social_pending') {
      throw new UnauthorizedException('유효하지 않은 소셜 인증 토큰입니다.');
    }

    // 이메일 중복 재확인 (10분 사이 다른 가입 방지 — HMAC으로 조회)
    const pendingEmailHash = this.cryptoService.hmac(payload.email.toLowerCase().trim());
    const existing = await this.userRepository.findOne({ where: { emailHash: pendingEmailHash } });
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다. 로그인 페이지에서 소셜 로그인을 시도해 주세요.');
    }

    return this.dataSource.transaction(async (manager) => {
      // 회사 생성
      const company = manager.create(Company, {
        name: companyName,
        status: CompanyStatus.ACTIVE,
      });
      await manager.save(Company, company);

      // owner 유저 생성 (passwordHash null)
      const user = manager.create(User, {
        companyId: company.id,
        email: payload.email,
        name: payload.name,
        provider: payload.provider,
        providerAccountId: payload.providerAccountId,
        profileImageUrl: payload.profileImageUrl ?? null,
        passwordHash: null,
        status: UserStatus.ACTIVE,
        role: UserRole.OWNER,
        joinedAt: new Date(),
        lastLoginAt: new Date(),
      });
      await manager.save(User, user);

      const tokens = await this.generateTokens(user, company.id);
      return {
        ...tokens,
        user: this.formatUserResponse(user),
      };
    });
  }

  // ──────────────────────────────────────────────
  // Google 액세스 토큰으로 유저 정보 조회 (모바일용)
  // ──────────────────────────────────────────────
  async googleExchangeCode(code: string, redirectUri: string): Promise<SocialUser> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    // 1. 코드 → 액세스 토큰 교환
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      throw new InternalServerErrorException('Google 토큰 교환에 실패했습니다.');
    }

    const tokenData: any = await tokenRes.json();

    // 2. 유저 정보 조회
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new InternalServerErrorException('Google 사용자 정보를 가져오지 못했습니다.');
    }

    const googleUser: any = await userRes.json();
    if (!googleUser.email) {
      throw new BadRequestException('Google 계정에서 이메일을 가져올 수 없습니다.');
    }

    return {
      provider: 'google',
      providerAccountId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name ?? googleUser.email.split('@')[0],
      profileImageUrl: googleUser.picture ?? null,
    };
  }

  // ──────────────────────────────────────────────
  // 전화번호 OTP 발송 (비밀번호 재설정용)
  // ──────────────────────────────────────────────
  async sendPhoneOtp(phone: string): Promise<void> {
    // 보안: 전화번호 등록 여부를 외부에 노출하지 않음 (항상 성공 응답)
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^82/, '0');
    const user = await this.userRepository.findOne({
      where: { phone: normalizedPhone },
      select: ['id', 'phone', 'name', 'deletedAt'],
    });
    if (!user || user.deletedAt) return;

    // 기존 미사용 OTP 만료 처리
    await this.phoneOtpRepository.update(
      { phone: normalizedPhone, purpose: OtpPurpose.PASSWORD_RESET, usedAt: IsNull() as any },
      { usedAt: new Date() },
    );

    // 6자리 랜덤 코드 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분

    await this.phoneOtpRepository.save(
      this.phoneOtpRepository.create({
        phone: normalizedPhone,
        code,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt,
      }),
    );

    // SMS 발송 (fire-and-forget)
    this.smsService.sendOtp(normalizedPhone, code).catch(() => {});
  }

  // ──────────────────────────────────────────────
  // OTP 검증 → 비밀번호 재설정 토큰 발급
  // ──────────────────────────────────────────────
  async verifyPhoneOtp(phone: string, code: string): Promise<{ resetToken: string }> {
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^82/, '0');

    const otp = await this.phoneOtpRepository.findOne({
      where: {
        phone: normalizedPhone,
        code,
        purpose: OtpPurpose.PASSWORD_RESET,
        usedAt: IsNull() as any,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) throw new BadRequestException('인증번호가 올바르지 않습니다.');
    if (otp.expiresAt < new Date()) throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해주세요.');

    // 사용자 조회
    const user = await this.userRepository.findOne({
      where: { phone: normalizedPhone },
      select: ['id'],
    });
    if (!user) throw new BadRequestException('등록된 전화번호가 아닙니다.');

    // 기존 미사용 이메일 토큰 무효화 후, 비밀번호 재설정 토큰 생성
    await this.passwordResetTokenRepository.update(
      { userId: user.id, usedAt: IsNull() as any },
      { usedAt: new Date() },
    );

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15분

    await Promise.all([
      this.passwordResetTokenRepository.save(
        this.passwordResetTokenRepository.create({ userId: user.id, token: resetToken, expiresAt }),
      ),
      this.phoneOtpRepository.update(otp.id, { usedAt: new Date(), verifiedAt: new Date(), resetToken }),
    ]);

    return { resetToken };
  }

  // ──────────────────────────────────────────────
  // Kakao OAuth code 교환
  // ──────────────────────────────────────────────
  async kakaoExchangeCode(code: string, redirectUri?: string): Promise<SocialUser> {
    const clientId = this.configService.get<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('KAKAO_CLIENT_SECRET', '');
    const callbackUrl = this.configService.get<string>('KAKAO_CALLBACK_URL');

    // 1. 액세스 토큰 교환
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret,
        redirect_uri: redirectUri ?? callbackUrl!,
        code,
      }),
    });

    if (!tokenRes.ok) {
      throw new InternalServerErrorException('Kakao 토큰 교환에 실패했습니다.');
    }

    const tokenData: any = await tokenRes.json();
    const kakaoAccessToken: string = tokenData.access_token;

    // 2. 사용자 정보 조회
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    if (!userRes.ok) {
      throw new InternalServerErrorException('Kakao 사용자 정보를 가져오지 못했습니다.');
    }

    const kakaoUser: any = await userRes.json();
    const email: string | undefined = kakaoUser.kakao_account?.email;

    if (!email) {
      throw new BadRequestException('Kakao 계정에서 이메일을 가져올 수 없습니다. 이메일 제공 동의가 필요합니다.');
    }

    return {
      provider: 'kakao',
      providerAccountId: String(kakaoUser.id),
      email,
      name: kakaoUser.kakao_account?.profile?.nickname ?? email.split('@')[0],
      profileImageUrl: kakaoUser.kakao_account?.profile?.profile_image_url ?? null,
    };
  }
}
