import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserStatus } from '../../database/entities/user.entity';
import { InviteToken, InviteStatus } from '../../database/entities/invite-token.entity';
import { Company } from '../../database/entities/company.entity';
import { UserCareer } from '../../database/entities/user-career.entity';
import { UserEducation } from '../../database/entities/user-education.entity';
import { UserDocument } from '../../database/entities/user-document.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { EmailService } from '../notifications/email.service';
import { ConfigService } from '@nestjs/config';
import {
  InviteUserDto, AcceptInviteDto, UpdateUserDto,
  UpdateRoleDto, ChangePasswordDto, UserQueryDto,
} from './dto/users.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(InviteToken)
    private inviteRepo: Repository<InviteToken>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    @InjectRepository(UserCareer)
    private careerRepo: Repository<UserCareer>,

    @InjectRepository(UserEducation)
    private educationRepo: Repository<UserEducation>,

    @InjectRepository(UserDocument)
    private documentRepo: Repository<UserDocument>,

    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────
  // 직원 목록
  // ─────────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: UserQueryDto) {
    const where: any = { companyId: currentUser.companyId };

    if (query.role)   where.role   = query.role;
    if (query.status) where.status = query.status;

    const users = await this.userRepo.find({
      where,
      select: [
        'id', 'name', 'email', 'phone', 'department', 'position',
        'role', 'status', 'joinedAt', 'lastLoginAt',
        'profileImageUrl', 'employeeNumber', 'createdAt',
      ],
      order: { createdAt: 'ASC' },
    });

    const filtered = query.search
      ? users.filter((u) =>
          u.name.includes(query.search!) ||
          u.email.includes(query.search!) ||
          (u.department ?? '').includes(query.search!),
        )
      : users;

    return filtered;
  }

  // ─────────────────────────────────────────
  // 특정 직원 조회
  // ─────────────────────────────────────────
  async findOne(currentUser: AuthenticatedUser, targetId: string) {
    const user = await this.userRepo.findOne({
      where: { id: targetId, companyId: currentUser.companyId },
      select: [
        'id', 'name', 'email', 'phone', 'department', 'position',
        'role', 'status', 'joinedAt', 'lastLoginAt',
        'profileImageUrl', 'employeeNumber', 'createdAt',
      ],
    });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');
    return user;
  }

  // ─────────────────────────────────────────
  // 내 프로필 수정
  // ─────────────────────────────────────────
  async updateMe(currentUser: AuthenticatedUser, dto: UpdateUserDto) {
    await this.userRepo.update(
      { id: currentUser.id, companyId: currentUser.companyId },
      {
        ...(dto.name            && { name: dto.name }),
        ...(dto.phone           && { phone: dto.phone }),
        ...(dto.department      && { department: dto.department }),
        ...(dto.position        && { position: dto.position }),
        ...(dto.joinedAt        && { joinedAt: new Date(dto.joinedAt) }),
        ...(dto.profileImageUrl !== undefined      && { profileImageUrl: dto.profileImageUrl }),
        ...(dto.coverImageUrl !== undefined        && { coverImageUrl: dto.coverImageUrl }),
        ...(dto.coverImageMobileUrl !== undefined  && { coverImageMobileUrl: dto.coverImageMobileUrl }),
        ...(dto.coverMobileCrop !== undefined      && { coverMobileCrop: dto.coverMobileCrop }),
      },
    );
    return this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['id', 'name', 'email', 'phone', 'department', 'position', 'profileImageUrl',
               'coverImageUrl', 'coverImageMobileUrl', 'coverMobileCrop', 'joinedAt'],
    });
  }

  // ─────────────────────────────────────────
  // 비밀번호 변경
  // ─────────────────────────────────────────
  async changePassword(currentUser: AuthenticatedUser, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
      select: ['id', 'passwordHash'],
    });

    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, {
      passwordHash: newHash,
      refreshTokenHash: null as any, // 다른 세션 강제 로그아웃
    });
  }

  // ─────────────────────────────────────────
  // 직원 정보 수정 (관리자)
  // ─────────────────────────────────────────
  async updateUser(
    currentUser: AuthenticatedUser,
    targetId: string,
    dto: UpdateUserDto,
  ) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const target = await this.findOne(currentUser, targetId);
    if (target.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('owner 계정은 수정할 수 없습니다.');
    }

    await this.userRepo.update(
      { id: targetId, companyId: currentUser.companyId },
      {
        ...(dto.name       && { name: dto.name }),
        ...(dto.phone      && { phone: dto.phone }),
        ...(dto.department && { department: dto.department }),
        ...(dto.position   && { position: dto.position }),
        ...(dto.joinedAt   && { joinedAt: new Date(dto.joinedAt) }),
      },
    );
    return this.findOne(currentUser, targetId);
  }

  // ─────────────────────────────────────────
  // 역할 변경 (owner만)
  // ─────────────────────────────────────────
  async updateRole(
    currentUser: AuthenticatedUser,
    targetId: string,
    dto: UpdateRoleDto,
  ) {
    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('역할 변경은 owner만 가능합니다.');
    }
    if (currentUser.id === targetId) {
      throw new BadRequestException('자신의 역할은 변경할 수 없습니다.');
    }

    const target = await this.findOne(currentUser, targetId);
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('owner 계정의 역할은 변경할 수 없습니다.');
    }

    await this.userRepo.update(
      { id: targetId, companyId: currentUser.companyId },
      { role: dto.role },
    );
  }

  // ─────────────────────────────────────────
  // 직원 비활성화 (Soft Delete, owner만)
  // ─────────────────────────────────────────
  async deactivateUser(currentUser: AuthenticatedUser, targetId: string) {
    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('직원 비활성화는 owner만 가능합니다.');
    }
    if (currentUser.id === targetId) {
      throw new BadRequestException('자신을 비활성화할 수 없습니다.');
    }

    const target = await this.findOne(currentUser, targetId);
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('owner 계정은 비활성화할 수 없습니다.');
    }

    await this.userRepo.update(
      { id: targetId, companyId: currentUser.companyId },
      { status: UserStatus.INACTIVE, refreshTokenHash: null as any },
    );
  }

  // ─────────────────────────────────────────
  // 직원 초대
  // ─────────────────────────────────────────
  async inviteUser(currentUser: AuthenticatedUser, dto: InviteUserDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('초대 권한이 없습니다.');
    }

    // 이미 소속 직원인지 확인
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email, companyId: currentUser.companyId },
    });
    if (existingUser) {
      throw new ConflictException('이미 소속된 직원입니다.');
    }

    // 대기 중인 초대가 있으면 취소 후 재발송
    await this.inviteRepo.update(
      { email: dto.email, companyId: currentUser.companyId, status: InviteStatus.PENDING },
      { status: InviteStatus.CANCELED },
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48시간

    const invite = this.inviteRepo.create({
      companyId: currentUser.companyId,
      invitedBy: currentUser.id,
      email: dto.email,
      role: dto.role,
      token,
      expiresAt,
    });
    await this.inviteRepo.save(invite);

    // 초대 이메일 발송 (실패해도 초대 자체는 완료)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const company = await this.companyRepo.findOne({ where: { id: currentUser.companyId } });
    const inviter = await this.userRepo.findOne({ where: { id: currentUser.id } });
    const expiresAtStr = expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    this.emailService.sendInviteEmail({
      to: dto.email,
      inviterName: inviter?.name ?? '관리자',
      companyName: company?.name ?? '',
      inviteUrl: `${frontendUrl}/invite?token=${token}`,
      expiresAt: expiresAtStr,
    }).catch(() => {});

    return { inviteId: invite.id, token, expiresAt };
  }

  // ─────────────────────────────────────────
  // 초대 목록 조회
  // ─────────────────────────────────────────
  async findInvites(currentUser: AuthenticatedUser) {
    const now = new Date();

    // 만료된 pending 초대 자동 처리
    await this.inviteRepo
      .createQueryBuilder()
      .update()
      .set({ status: InviteStatus.EXPIRED })
      .where('company_id = :cid', { cid: currentUser.companyId })
      .andWhere('status = :s', { s: InviteStatus.PENDING })
      .andWhere('expires_at < :now', { now })
      .execute();

    return this.inviteRepo.find({
      where: { companyId: currentUser.companyId, status: InviteStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  // ─────────────────────────────────────────
  // 초대 취소
  // ─────────────────────────────────────────
  async cancelInvite(currentUser: AuthenticatedUser, inviteId: string) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, companyId: currentUser.companyId, status: InviteStatus.PENDING },
    });
    if (!invite) throw new NotFoundException('초대를 찾을 수 없습니다.');
    await this.inviteRepo.update(invite.id, { status: InviteStatus.CANCELED });
  }

  // ─────────────────────────────────────────
  // 초대 재발송 (토큰 갱신)
  // ─────────────────────────────────────────
  async resendInvite(currentUser: AuthenticatedUser, inviteId: string) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, companyId: currentUser.companyId },
    });
    if (!invite) throw new NotFoundException('초대를 찾을 수 없습니다.');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.inviteRepo.update(invite.id, {
      token,
      expiresAt,
      status: InviteStatus.PENDING,
    });

    // 초대 이메일 재발송
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const company = await this.companyRepo.findOne({ where: { id: currentUser.companyId } });
    const inviter = await this.userRepo.findOne({ where: { id: currentUser.id } });
    const expiresAtStr = expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    this.emailService.sendInviteEmail({
      to: invite.email,
      inviterName: inviter?.name ?? '관리자',
      companyName: company?.name ?? '',
      inviteUrl: `${frontendUrl}/invite?token=${token}`,
      expiresAt: expiresAtStr,
    }).catch(() => {});

    return { token, expiresAt };
  }

  // ─────────────────────────────────────────
  // 초대 토큰 정보 조회 (수락 화면)
  // ─────────────────────────────────────────
  async getInviteInfo(token: string) {
    const invite = await this.inviteRepo.findOne({
      where: { token, status: InviteStatus.PENDING },
      relations: ['company', 'inviter'],
    });

    if (!invite) throw new NotFoundException('유효하지 않은 초대 링크입니다.');
    if (invite.expiresAt < new Date()) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('만료된 초대 링크입니다. 관리자에게 재발송을 요청하세요.');
    }

    return {
      companyName: invite.company.name,
      inviterName: invite.inviter.name,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  // ─────────────────────────────────────────
  // 초대 수락 (계정 생성)
  // ─────────────────────────────────────────
  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.inviteRepo.findOne({
      where: { token: dto.token, status: InviteStatus.PENDING },
      relations: ['company'],
    });

    if (!invite) throw new NotFoundException('유효하지 않은 초대 링크입니다.');
    if (invite.expiresAt < new Date()) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('만료된 초대 링크입니다.');
    }

    // 이미 소속 직원인지 재확인
    const existingUser = await this.userRepo.findOne({
      where: { email: invite.email, companyId: invite.companyId },
    });
    if (existingUser) {
      throw new ConflictException('이미 가입된 계정입니다. 로그인해 주세요.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      companyId: invite.companyId,
      email: invite.email,
      name: dto.name,
      phone: dto.phone ?? null,
      passwordHash,
      role: invite.role,
      status: UserStatus.ACTIVE,
      joinedAt: new Date(),
    });
    const savedUser = await this.userRepo.save(user) as User;

    await this.inviteRepo.update(invite.id, {
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
      createdUserId: savedUser.id,
    });

    return {
      userId: savedUser.id,
      companyId: invite.companyId,
      companyName: invite.company.name,
    };
  }

  // ─────────────────────────────────────────
  // 증명서 발급 데이터
  // ─────────────────────────────────────────
  async getCertificateData(
    currentUser: AuthenticatedUser,
    targetUserId: string,
    type: string,
  ) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    // 본인 또는 관리자만 조회 가능
    if (!isAdmin && currentUser.id !== targetUserId) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const user = await this.userRepo.findOne({
      where: { id: targetUserId, companyId: currentUser.companyId },
      relations: ['company'],
    });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');

    const issueDate = new Date().toISOString().split('T')[0];

    const base = {
      issueDate,
      employee: {
        name: user.name,
        employeeNumber: user.employeeNumber,
        department: user.department,
        position: user.position,
        joinedAt: user.joinedAt ? user.joinedAt.toString().split('T')[0] : null,
        email: user.email,
      },
      company: {
        name: user.company?.name ?? '',
        businessNumber: user.company?.businessNumber ?? null,
        address: user.company?.address ?? null,
        phone: user.company?.phone ?? null,
      },
    };

    if (type === 'career') {
      const today = new Date().toISOString().split('T')[0];
      const joinedAt = user.joinedAt ? user.joinedAt.toString().split('T')[0] : null;
      const yearsMonths = joinedAt
        ? this.calcTenure(new Date(joinedAt), new Date(today))
        : null;
      return { ...base, type: 'career', tenure: yearsMonths };
    }

    return { ...base, type: 'employment' };
  }

  private calcTenure(from: Date, to: Date): { years: number; months: number } {
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    if (months < 0) { years -= 1; months += 12; }
    return { years, months };
  }

  // ─────────────────────────────────────────
  // 경력 CRUD
  // ─────────────────────────────────────────
  private async assertUserAccess(currentUser: AuthenticatedUser, targetUserId: string) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== targetUserId) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    const user = await this.userRepo.findOne({
      where: { id: targetUserId, companyId: currentUser.companyId },
      select: ['id'],
    });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');
  }

  async getCareers(currentUser: AuthenticatedUser, userId: string) {
    await this.assertUserAccess(currentUser, userId);
    return this.careerRepo.find({
      where: { userId, companyId: currentUser.companyId },
      order: { startDate: 'DESC' },
    });
  }

  async createCareer(currentUser: AuthenticatedUser, userId: string, dto: any) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    await this.assertUserAccess(currentUser, userId);
    const career = this.careerRepo.create({
      companyId: currentUser.companyId,
      userId,
      companyName: dto.companyName,
      position: dto.position ?? null,
      department: dto.department ?? null,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      isCurrent: dto.isCurrent ?? false,
      description: dto.description ?? null,
    });
    return this.careerRepo.save(career);
  }

  async updateCareer(currentUser: AuthenticatedUser, userId: string, careerId: string, dto: any) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    const career = await this.careerRepo.findOne({ where: { id: careerId, userId, companyId: currentUser.companyId } });
    if (!career) throw new NotFoundException('경력을 찾을 수 없습니다.');
    Object.assign(career, dto);
    return this.careerRepo.save(career);
  }

  async deleteCareer(currentUser: AuthenticatedUser, userId: string, careerId: string) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    const career = await this.careerRepo.findOne({ where: { id: careerId, userId, companyId: currentUser.companyId } });
    if (!career) throw new NotFoundException('경력을 찾을 수 없습니다.');
    await this.careerRepo.remove(career);
  }

  // ─────────────────────────────────────────
  // 학력 CRUD
  // ─────────────────────────────────────────
  async getEducations(currentUser: AuthenticatedUser, userId: string) {
    await this.assertUserAccess(currentUser, userId);
    return this.educationRepo.find({
      where: { userId, companyId: currentUser.companyId },
      order: { startDate: 'DESC' },
    });
  }

  async createEducation(currentUser: AuthenticatedUser, userId: string, dto: any) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    await this.assertUserAccess(currentUser, userId);
    const edu = this.educationRepo.create({
      companyId: currentUser.companyId,
      userId,
      schoolName: dto.schoolName,
      major: dto.major ?? null,
      degree: dto.degree ?? 'bachelor',
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      isCurrent: dto.isCurrent ?? false,
      status: dto.status ?? 'graduated',
    });
    return this.educationRepo.save(edu);
  }

  async updateEducation(currentUser: AuthenticatedUser, userId: string, eduId: string, dto: any) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    const edu = await this.educationRepo.findOne({ where: { id: eduId, userId, companyId: currentUser.companyId } });
    if (!edu) throw new NotFoundException('학력을 찾을 수 없습니다.');
    Object.assign(edu, dto);
    return this.educationRepo.save(edu);
  }

  async deleteEducation(currentUser: AuthenticatedUser, userId: string, eduId: string) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    const edu = await this.educationRepo.findOne({ where: { id: eduId, userId, companyId: currentUser.companyId } });
    if (!edu) throw new NotFoundException('학력을 찾을 수 없습니다.');
    await this.educationRepo.remove(edu);
  }

  // ─────────────────────────────────────────
  // 첨부문서 CRUD
  // ─────────────────────────────────────────
  async getDocuments(currentUser: AuthenticatedUser, userId: string) {
    await this.assertUserAccess(currentUser, userId);
    return this.documentRepo.find({
      where: { userId, companyId: currentUser.companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async createDocument(currentUser: AuthenticatedUser, userId: string, dto: any) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    await this.assertUserAccess(currentUser, userId);
    const doc = this.documentRepo.create({
      companyId: currentUser.companyId,
      userId,
      uploadedBy: currentUser.id,
      type: dto.type ?? 'other',
      displayName: dto.displayName,
      fileUrl: dto.fileUrl,
      originalName: dto.originalName ?? null,
      fileSize: dto.fileSize ?? null,
    });
    return this.documentRepo.save(doc);
  }

  async deleteDocument(currentUser: AuthenticatedUser, userId: string, docId: string) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin && currentUser.id !== userId) throw new ForbiddenException('권한이 없습니다.');
    const doc = await this.documentRepo.findOne({ where: { id: docId, userId, companyId: currentUser.companyId } });
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다.');
    await this.documentRepo.remove(doc);
  }

  // ─────────────────────────────────────────
  // 조직 통계
  // ─────────────────────────────────────────
  async getOrgStats(currentUser: AuthenticatedUser) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin) throw new ForbiddenException('관리자만 조회 가능합니다.');

    const users = await this.userRepo.find({
      where: { companyId: currentUser.companyId },
      select: ['id', 'name', 'department', 'position', 'role', 'status', 'joinedAt'],
    });

    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);

    // 부서별 인원
    const deptMap: Record<string, number> = {};
    for (const u of activeUsers) {
      const dept = u.department || '미배정';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    }
    const byDepartment = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    // 역할별 인원
    const roleMap: Record<string, number> = {};
    for (const u of activeUsers) {
      roleMap[u.role] = (roleMap[u.role] || 0) + 1;
    }
    const byRole = Object.entries(roleMap).map(([role, count]) => ({ role, count }));

    // 월별 입사자 수 (최근 12개월)
    const now = new Date();
    const monthlyJoin: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = users.filter(u => {
        if (!u.joinedAt) return false;
        const j = new Date(u.joinedAt);
        return j.getFullYear() === d.getFullYear() && j.getMonth() === d.getMonth();
      }).length;
      monthlyJoin.push({ month: label, count });
    }

    // 직급별 인원
    const posMap: Record<string, number> = {};
    for (const u of activeUsers) {
      const pos = u.position || '미지정';
      posMap[pos] = (posMap[pos] || 0) + 1;
    }
    const byPosition = Object.entries(posMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: users.length,
      active: activeUsers.length,
      inactive: users.filter(u => u.status !== UserStatus.ACTIVE).length,
      byDepartment,
      byRole,
      byPosition,
      monthlyJoin,
    };
  }
}
