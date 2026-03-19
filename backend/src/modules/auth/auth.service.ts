import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Company, CompanyStatus } from '../../database/entities/company.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { UserRole, JwtPayload } from '../../common/types/jwt-payload.type';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../notifications/email.service';
import { LoginLockService } from './services/login-lock.service';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';

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

    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    private emailService: EmailService,
    private loginLockService: LoginLockService,
  ) {}

  // ──────────────────────────────────────────────
  // 회원가입 (회사 + owner 동시 생성)
  // ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // 1. 이메일 중복 검사 (전체 범위 — 다른 회사에서 동일 이메일 owner 생성 방지)
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
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

    // 1. 이메일로 사용자 조회 (password_hash 포함)
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
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
  async logout(userId: string) {
    // DB의 refresh_token_hash를 null로 설정하여 무효화
    await this.userRepository.update(userId, { refreshTokenHash: null as any });
  }

  // ──────────────────────────────────────────────
  // 토큰 생성 (내부 유틸)
  // ──────────────────────────────────────────────
  private async generateTokens(user: Partial<User>, companyId: string) {
    const payload: JwtPayload = {
      sub: user.id!,
      companyId,
      role: user.role!,
      email: user.email!,
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

    // Refresh Token 해시 저장 (원문은 저장하지 않음)
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userRepository.update(user.id!, { refreshTokenHash });

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
    const user = await this.userRepository.findOne({
      where: { email },
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
}
