import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  InviteToken, InviteStatus, InviteType,
} from '../../database/entities/invite-token.entity';
import { User } from '../../database/entities/user.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { CryptoService } from '../../common/crypto/crypto.service';
import { EmailService } from '../notifications/email.service';
import { CreateInviteLinkDto, JoinViaLinkDto } from './dto/invitations.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectRepository(InviteToken)
    private inviteRepo: Repository<InviteToken>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(EmailVerification)
    private emailVerifRepo: Repository<EmailVerification>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    private cryptoService: CryptoService,
    private emailService: EmailService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // 초대 링크 생성 (관리자)
  // ═══════════════════════════════════════════════════════════
  async createLink(user: AuthenticatedUser, dto: CreateInviteLinkDto) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const token = crypto.randomBytes(24).toString('base64url'); // URL-safe 32자
    const expiresAt = dto.expires_at
      ? new Date(dto.expires_at)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 기본 7일

    // 개인 링크는 maxUses = 1
    const maxUses = dto.link_kind === 'personal' ? 1 : (dto.max_uses ?? null);

    const invite = this.inviteRepo.create({
      companyId:    user.companyId,
      invitedBy:    user.id,
      inviteType:   InviteType.LINK,
      linkKind:     dto.link_kind,
      email:        dto.target_email ?? null,      // 개인 링크: 지정 이메일
      recipientName: null,
      role:         (dto.role as UserRole) ?? UserRole.EMPLOYEE,
      department:   dto.department ?? null,
      position:     dto.position ?? null,
      maxUses,
      usedCount:    0,
      status:       InviteStatus.PENDING,
      token,
      expiresAt,
      note:         dto.note ?? null,
    });

    const saved = await this.inviteRepo.save(invite);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return {
      success: true,
      data: {
        ...saved,
        joinUrl: `${frontendUrl}/join/${token}`,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 초대 링크 목록 조회 (관리자)
  // ═══════════════════════════════════════════════════════════
  async listLinks(user: AuthenticatedUser) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const links = await this.inviteRepo
      .createQueryBuilder('i')
      .leftJoin('i.inviter', 'inv')
      .addSelect(['inv.id', 'inv.name'])
      .where('i.company_id = :cid', { cid: user.companyId })
      .orderBy('i.created_at', 'DESC')
      .getMany();

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return {
      success: true,
      data: links.map((l) => ({
        ...l,
        joinUrl: `${frontendUrl}/join/${l.token}`,
        isExpired: l.expiresAt < new Date() || l.status === InviteStatus.EXPIRED,
        isFull:    l.maxUses !== null && l.usedCount >= l.maxUses,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 초대 링크 취소 / 삭제 (관리자)
  // ═══════════════════════════════════════════════════════════
  async cancelLink(user: AuthenticatedUser, id: string) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const link = await this.inviteRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!link) throw new NotFoundException();
    link.status = InviteStatus.CANCELED;
    await this.inviteRepo.save(link);
    return { success: true };
  }

  async deleteLink(user: AuthenticatedUser, id: string) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const link = await this.inviteRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!link) throw new NotFoundException();
    await this.inviteRepo.delete(id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════
  // 링크 정보 조회 (공개 — 가입 전 미리보기)
  // ═══════════════════════════════════════════════════════════
  async getLinkInfo(token: string) {
    const link = await this.inviteRepo.findOne({
      where: { token },
      relations: ['company'],
    });

    if (!link) throw new NotFoundException('초대 링크를 찾을 수 없습니다.');
    this.validateLinkUsable(link);

    return {
      success: true,
      data: {
        companyId:   link.companyId,
        companyName: link.company?.name ?? '회사',
        linkKind:    link.linkKind,
        role:        link.role,
        department:  link.department,
        position:    link.position,
        targetEmail: link.linkKind === 'personal' ? link.email : null,
        expiresAt:   link.expiresAt,
        usedCount:   link.usedCount,
        maxUses:     link.maxUses,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 링크를 통한 가입 처리 (공개)
  // ═══════════════════════════════════════════════════════════
  async joinViaLink(token: string, dto: JoinViaLinkDto, ipAddress: string) {
    const link = await this.inviteRepo.findOne({ where: { token }, relations: ['company'] });
    if (!link) throw new NotFoundException('초대 링크를 찾을 수 없습니다.');
    this.validateLinkUsable(link);

    // 개인 링크: 지정 이메일과 일치해야 함
    if (link.linkKind === 'personal' && link.email) {
      if (dto.email.toLowerCase().trim() !== link.email.toLowerCase().trim()) {
        throw new ForbiddenException('이 링크는 지정된 이메일 주소만 사용할 수 있습니다.');
      }
    }

    // 이메일 중복 검사
    const emailHash = this.cryptoService.hmac(dto.email.toLowerCase().trim());
    const existing = await this.userRepo.findOne({ where: { emailHash } });
    if (existing) throw new ConflictException('이미 가입된 이메일입니다.');

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1. 사용자 생성
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = qr.manager.create(User, {
        companyId:    link.companyId,
        name:         dto.name,
        email:        dto.email,
        passwordHash,
        role:         link.role,
        department:   link.department ?? null,
        position:     link.position  ?? null,
        joinedAt:     new Date(),
      } as any);
      const savedUser = await qr.manager.save(user);

      // 2. 초대 토큰 사용 처리 (atomic)
      await qr.manager
        .createQueryBuilder()
        .update(InviteToken)
        .set({
          usedCount:     () => 'used_count + 1',
          createdUserId: savedUser.id,
          // 개인 링크 → 첫 사용 즉시 ACCEPTED 처리
          status:        link.linkKind === 'personal' ? InviteStatus.ACCEPTED : link.status,
          acceptedAt:    link.linkKind === 'personal' ? new Date() : link.acceptedAt,
        })
        .where('id = :id AND used_count < COALESCE(max_uses, 2147483647)', { id: link.id })
        .execute();

      await qr.commitTransaction();

      // 3. 이메일 인증 발송 (비동기)
      this.sendEmailVerification(savedUser, dto.email).catch(() => {});

      // 4. 관리자에게 알림 (비동기)
      this.notifyAdminOnJoin(link, savedUser, dto.email).catch(() => {});

      return {
        success: true,
        message: '가입이 완료되었습니다. 이메일 인증 후 로그인하실 수 있습니다.',
        data: {
          email: dto.email,
          name:  dto.name,
          role:  link.role,
        },
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─── 이메일 인증 발송 ─────────────────────────────────────────────────────
  private async sendEmailVerification(user: any, rawEmail: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.emailVerifRepo.save(
      this.emailVerifRepo.create({ userId: user.id, email: rawEmail, token, expiresAt }),
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verifyUrl   = `${frontendUrl}/verify-email?token=${token}`;

    await this.emailService.sendEmailVerification({
      to: rawEmail,
      name: user.name,
      verifyUrl,
      expiresAt: expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    });
  }

  // ─── 관리자 알림 ──────────────────────────────────────────────────────────
  private async notifyAdminOnJoin(link: InviteToken, user: any, rawEmail: string): Promise<void> {
    // 초대한 관리자 이메일 조회
    const inviter = await this.userRepo.findOne({
      where: { id: link.invitedBy },
      select: ['email', 'name'],
    });
    if (!inviter?.email) return;

    const company = await this.companyRepo.findOne({ where: { id: link.companyId }, select: ['name'] });
    const html = `
      <div style="font-family:sans-serif">
        <h2>👋 새 직원이 초대 링크로 가입했습니다</h2>
        <p><strong>이름</strong>: ${user.name}</p>
        <p><strong>이메일</strong>: ${rawEmail}</p>
        <p><strong>역할</strong>: ${link.role}</p>
        ${link.department ? `<p><strong>부서</strong>: ${link.department}</p>` : ''}
        <p style="color:#6B7280;font-size:12px">아직 이메일 인증이 완료되지 않았습니다. 인증 후 로그인 가능합니다.</p>
      </div>
    `;
    await this.emailService.sendRaw({
      to:      inviter.email,
      subject: `[관리왕] ${user.name}님이 초대 링크로 가입했습니다`,
      html,
    }).catch(() => { /* 알림 실패는 무시 */ });
  }

  // ─── 링크 유효성 검증 ────────────────────────────────────────────────────
  private validateLinkUsable(link: InviteToken): void {
    if (link.status === InviteStatus.CANCELED) {
      throw new BadRequestException('취소된 초대 링크입니다.');
    }
    if (link.status === InviteStatus.ACCEPTED && link.linkKind === 'personal') {
      throw new BadRequestException('이미 사용된 개인 초대 링크입니다.');
    }
    if (link.expiresAt < new Date()) {
      throw new BadRequestException('만료된 초대 링크입니다.');
    }
    if (link.maxUses !== null && link.usedCount >= link.maxUses) {
      throw new BadRequestException('최대 사용 횟수에 도달한 초대 링크입니다.');
    }
  }
}
