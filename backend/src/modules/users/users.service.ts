import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserStatus } from '../../database/entities/user.entity';
import { InviteToken, InviteStatus, InviteType } from '../../database/entities/invite-token.entity';
import { Company } from '../../database/entities/company.entity';
import { UserCareer } from '../../database/entities/user-career.entity';
import { UserEducation } from '../../database/entities/user-education.entity';
import { UserDocument } from '../../database/entities/user-document.entity';
import { ApprovalDocument, ApprovalDocStatus, ApprovalDocType } from '../../database/entities/approval-document.entity';
import { ApprovalStep, StepStatus } from '../../database/entities/approval-step.entity';
import { AuthenticatedUser, UserRole, UserPermissions } from '../../common/types/jwt-payload.type';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../../common/sms/sms.service';
import { ConfigService } from '@nestjs/config';
import {
  InviteUserDto, InviteByPhoneDto, CreateShareableLinkDto,
  AcceptInviteDto, UpdateUserDto,
  UpdateRoleDto, UpdatePermissionsDto, ChangePasswordDto, UserQueryDto,
  RequestPermissionChangeDto, UpdateWorkScheduleDto, RequestWorkScheduleChangeDto,
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

    @InjectRepository(ApprovalDocument)
    private approvalDocRepo: Repository<ApprovalDocument>,

    @InjectRepository(ApprovalStep)
    private approvalStepRepo: Repository<ApprovalStep>,

    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
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
    if (!user.passwordHash) throw new BadRequestException('소셜 계정은 비밀번호를 변경할 수 없습니다.');
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
  // 권한 직접 설정
  // - OWNER: 모든 권한 직접 설정 가능
  // - canGrantHrAccess 위임자: HR 관련 권한만 직접 설정 가능
  // - canGrantSalaryAccess 위임자: 급여 관련 권한만 직접 설정 가능
  // - 그 외: requestPermissionChange()를 통한 결재 기안 필요
  // ─────────────────────────────────────────
  async updatePermissions(
    currentUser: AuthenticatedUser,
    targetId: string,
    dto: UpdatePermissionsDto,
  ) {
    const isOwner = currentUser.role === UserRole.OWNER;
    const myPerms = currentUser.permissions ?? {};
    const canGrantHr     = isOwner || myPerms.canGrantHrAccess;
    const canGrantSalary = isOwner || myPerms.canGrantSalaryAccess;

    // 변경 요청 항목 분류
    const reqPerms = dto.permissions ?? {};
    const hasHrPerms = [
      'canViewHrNotes', 'canManageHrNotes', 'hrNoteScope',
    ].some(k => k in reqPerms);
    const hasSalaryPerms = [
      'canViewSalary', 'canManageSalary', 'salaryScope', 'canManagePayroll',
    ].some(k => k in reqPerms);
    const hasAdminPerms = [
      'canGrantHrAccess', 'canGrantSalaryAccess',
      'canInvite', 'canManageContracts', 'canManageEvaluations',
    ].some(k => k in reqPerms);
    const hasDeptChange = dto.managedDepartments !== undefined;

    // 위임 권한 부여/회수는 OWNER만 가능
    if (hasAdminPerms && !isOwner) {
      throw new ForbiddenException('위임 권한(canGrantHrAccess, canGrantSalaryAccess)은 소유자(owner)만 설정할 수 있습니다.');
    }
    // HR 권한: OWNER 또는 HR 위임자만
    if (hasHrPerms && !canGrantHr) {
      throw new ForbiddenException(
        'HR 접근 권한 변경은 소유자 또는 HR 권한 위임자만 직접 설정할 수 있습니다. ' +
        'PATCH /users/:id/permissions/request 를 통해 결재 기안을 요청하세요.',
      );
    }
    // 급여 권한: OWNER 또는 급여 위임자만
    if (hasSalaryPerms && !canGrantSalary) {
      throw new ForbiddenException(
        '급여 접근 권한 변경은 소유자 또는 급여 권한 위임자만 직접 설정할 수 있습니다. ' +
        'PATCH /users/:id/permissions/request 를 통해 결재 기안을 요청하세요.',
      );
    }
    // 담당 부서 변경: OWNER 또는 두 위임자 중 하나라도 있으면 허용
    if (hasDeptChange && !isOwner && !canGrantHr && !canGrantSalary) {
      throw new ForbiddenException('담당 부서 변경은 소유자 또는 권한 위임자만 직접 설정할 수 있습니다.');
    }

    const target = await this.userRepo.findOne({
      where: { id: targetId, companyId: currentUser.companyId },
    });
    if (!target) throw new NotFoundException('직원을 찾을 수 없습니다.');

    // 현재 권한과 병합 (기존 권한 유지, 변경 항목만 덮어쓰기)
    const mergedPermissions: UserPermissions = {
      ...(target.permissions ?? {}),
      ...reqPerms,
    };

    await this.userRepo.update(
      { id: targetId, companyId: currentUser.companyId },
      {
        ...(dto.managedDepartments !== undefined && { managedDepartments: dto.managedDepartments }),
        permissions: dto.permissions !== undefined ? mergedPermissions : target.permissions,
      },
    );
    return this.findOne(currentUser, targetId);
  }

  // ─────────────────────────────────────────
  // 권한 변경 결재 기안
  // 결재가 최종 승인되면 approvals.service에서 자동으로 권한을 적용합니다.
  // ─────────────────────────────────────────
  async requestPermissionChange(
    currentUser: AuthenticatedUser,
    targetId: string,
    dto: RequestPermissionChangeDto,
  ) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('직원은 권한 변경 기안을 올릴 수 없습니다.');
    }
    if (currentUser.id === targetId) {
      throw new BadRequestException('자신의 권한 변경은 기안할 수 없습니다.');
    }

    const target = await this.userRepo.findOne({
      where: { id: targetId, companyId: currentUser.companyId },
    });
    if (!target) throw new NotFoundException('직원을 찾을 수 없습니다.');

    // 결재자 존재 확인
    for (const approverId of dto.approver_ids) {
      const approver = await this.userRepo.findOne({
        where: { id: approverId, companyId: currentUser.companyId },
      });
      if (!approver) throw new BadRequestException(`결재자를 찾을 수 없습니다: ${approverId}`);
      if (approver.role === UserRole.EMPLOYEE) {
        throw new BadRequestException(`결재자는 관리자(manager) 이상이어야 합니다: ${approver.name}`);
      }
    }

    // 기안 내용 구성 (JSON 직렬화)
    const contentPayload = {
      targetUserId: targetId,
      targetName: target.name,
      targetDepartment: target.department,
      permissions: dto.permissions ?? null,
      managedDepartments: dto.managedDepartments,
      reason: dto.reason,
    };

    const doc = this.approvalDocRepo.create({
      companyId: currentUser.companyId,
      authorId: currentUser.id,
      type: ApprovalDocType.PERMISSION_CHANGE,
      title: `[권한변경] ${target.name} (${target.department ?? '부서미지정'}) 접근 권한 변경 요청`,
      content: JSON.stringify(contentPayload),
      status: ApprovalDocStatus.IN_PROGRESS,
      currentStep: 1,
      submittedAt: new Date(),
    });
    const saved = await this.approvalDocRepo.save(doc);

    // 결재선 생성
    const steps = dto.approver_ids.map((approverId, idx) =>
      this.approvalStepRepo.create({
        documentId: saved.id,
        approverId,
        step: idx + 1,
        status: StepStatus.PENDING,
      }),
    );
    await this.approvalStepRepo.save(steps);

    return {
      success: true,
      message: '권한 변경 기안이 제출되었습니다. 결재 완료 후 자동으로 적용됩니다.',
      approvalDocumentId: saved.id,
    };
  }

  // ─────────────────────────────────────────
  // 권한 변경 결재 기안 템플릿 반환
  // ─────────────────────────────────────────
  getPermissionChangeTemplate() {
    return {
      description: '권한 변경 기안 작성 가이드',
      template: {
        target_user_id: '(필수) 권한을 변경할 직원 UUID',
        permissions: {
          '-- HR 노트 권한 --': null,
          canViewHrNotes:   'true: HR 노트 열람 허용 / false: 열람 차단',
          canManageHrNotes: 'true: HR 노트 생성·수정·삭제 허용 / false: 차단',
          hrNoteScope:      '"all": 전체 직원 / "managed_departments": 담당 부서만',
          '-- 급여 권한 --': null,
          canViewSalary:    'true: 타인 급여 열람 허용 / false: 본인 급여만',
          canManageSalary:  'true: 급여 등록·수정·확정·지급 허용 / false: 차단',
          salaryScope:      '"all": 전체 직원 / "managed_departments": 담당 부서만',
          '-- 기타 권한 --': null,
          canInvite:              'true: 직원 초대 허용',
          canManageContracts:     'true: 계약 관리 허용',
          canManageEvaluations:   'true: 인사평가 관리 허용',
        },
        managedDepartments: '["재무팀", "인사팀"] — 담당 부서 범위 (null = 전체)',
        reason:             '(필수, 10자 이상) 권한 변경이 필요한 사유',
        approver_ids:       '["UUID1", "UUID2"] — 결재자 목록 (순서대로 결재)',
      },
      notice: [
        '소유자(owner) 또는 권한 위임자는 이 기안 없이 직접 PATCH /users/:id/permissions 로 변경 가능합니다.',
        '결재가 최종 승인되면 권한이 자동으로 적용됩니다.',
        '반려 시 기존 권한은 그대로 유지됩니다.',
        '위임 권한(canGrantHrAccess, canGrantSalaryAccess) 부여는 소유자만 직접 설정 가능하며 기안으로 요청할 수 없습니다.',
      ],
    };
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
  // 이메일로 직원 초대
  // ─────────────────────────────────────────
  async inviteUser(currentUser: AuthenticatedUser, dto: InviteUserDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('초대 권한이 없습니다.');
    }

    // 이미 소속 직원인지 확인
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email, companyId: currentUser.companyId },
    });
    if (existingUser) throw new ConflictException('이미 소속된 직원입니다.');

    // 대기 중인 동일 이메일 초대 취소
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
      inviteType: InviteType.EMAIL,
      role: dto.role,
      token,
      expiresAt,
    });
    await this.inviteRepo.save(invite);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const [company, inviter] = await Promise.all([
      this.companyRepo.findOne({ where: { id: currentUser.companyId } }),
      this.userRepo.findOne({ where: { id: currentUser.id } }),
    ]);
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
  // 전화번호로 직원 초대 (SMS)
  // ─────────────────────────────────────────
  async inviteByPhone(currentUser: AuthenticatedUser, dto: InviteByPhoneDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('초대 권한이 없습니다.');
    }

    const normalizedPhone = dto.phone.replace(/\D/g, '').replace(/^82/, '0');

    // 동일 전화번호 대기 중 초대 취소
    await this.inviteRepo.update(
      { recipientPhone: normalizedPhone, companyId: currentUser.companyId, status: InviteStatus.PENDING },
      { status: InviteStatus.CANCELED },
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invite = this.inviteRepo.create({
      companyId: currentUser.companyId,
      invitedBy: currentUser.id,
      email: null,
      recipientPhone: normalizedPhone,
      recipientName: dto.name,
      inviteType: InviteType.PHONE,
      role: dto.role,
      token,
      expiresAt,
    });
    await this.inviteRepo.save(invite);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const company = await this.companyRepo.findOne({ where: { id: currentUser.companyId } });
    this.smsService.sendInvite(normalizedPhone, company?.name ?? '회사', `${frontendUrl}/invite?token=${token}`).catch(() => {});

    return { inviteId: invite.id, token, expiresAt };
  }

  // ─────────────────────────────────────────
  // 공유 초대 링크 생성
  // ─────────────────────────────────────────
  async createShareableLink(currentUser: AuthenticatedUser, dto: CreateShareableLinkDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('초대 권한이 없습니다.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const days = dto.validDays ?? 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invite = this.inviteRepo.create({
      companyId: currentUser.companyId,
      invitedBy: currentUser.id,
      email: null,
      inviteType: InviteType.LINK,
      role: dto.role ?? UserRole.EMPLOYEE,
      token,
      expiresAt,
      maxUses: dto.maxUses ?? null,
      usedCount: 0,
    });
    await this.inviteRepo.save(invite);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return {
      inviteId: invite.id,
      token,
      inviteUrl: `${frontendUrl}/invite?token=${token}`,
      expiresAt,
    };
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
      to: invite.email ?? '',
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
      email: invite.email,           // null for phone/link invites
      recipientName: invite.recipientName,
      role: invite.role,
      inviteType: invite.inviteType,
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

    // 링크 초대: 최대 사용 횟수 체크
    if (invite.inviteType === InviteType.LINK && invite.maxUses !== null) {
      if (invite.usedCount >= invite.maxUses) {
        throw new BadRequestException('초대 링크의 최대 사용 횟수에 도달했습니다.');
      }
    }

    // 이메일 초대: dto.email 사용 불가, invite.email 사용
    // 전화번호/링크 초대: dto.email 필수
    const resolvedEmail = invite.inviteType === InviteType.EMAIL
      ? (invite.email ?? '')
      : (dto.email ?? '');

    if (!resolvedEmail) {
      throw new BadRequestException('이메일을 입력해주세요.');
    }

    // 이미 소속 직원인지 재확인
    const existingUser = await this.userRepo.findOne({
      where: { email: resolvedEmail, companyId: invite.companyId },
    });
    if (existingUser) throw new ConflictException('이미 가입된 계정입니다. 로그인해 주세요.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      companyId: invite.companyId,
      email: resolvedEmail,
      name: dto.name ?? invite.recipientName ?? '',
      phone: dto.phone ?? invite.recipientPhone ?? null,
      passwordHash,
      role: invite.role,
      status: UserStatus.ACTIVE,
      joinedAt: new Date(),
    });
    const savedUser = await this.userRepo.save(user) as User;

    // 링크 초대: 사용 횟수 증가 (상태 ACCEPTED 처리 안 함 — 재사용 가능)
    if (invite.inviteType === InviteType.LINK) {
      await this.inviteRepo.update(invite.id, { usedCount: invite.usedCount + 1 });
    } else {
      await this.inviteRepo.update(invite.id, {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        createdUserId: savedUser.id,
      });
    }

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 개인 근무 스케줄 조회
  // ─────────────────────────────────────────────────────────────────────────────
  async getWorkSchedule(currentUser: AuthenticatedUser, targetId: string) {
    const isSelf = currentUser.id === targetId;
    if (!isSelf && currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인 또는 관리자만 조회할 수 있습니다.');
    }

    const [user, company] = await Promise.all([
      this.userRepo.findOne({
        where: { id: targetId, companyId: currentUser.companyId },
        select: [
          'id', 'name', 'department', 'position',
          'customWorkStart', 'customWorkEnd',
          'breakMinutes', 'lateThresholdMinOverride', 'scheduleNote',
        ] as any,
      }),
      this.companyRepo.findOne({
        where: { id: currentUser.companyId },
        select: ['workStartTime', 'workEndTime', 'lateThresholdMin'] as any,
      }),
    ]);

    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');

    return {
      userId: user.id,
      name: user.name,
      department: user.department,
      position: user.position,
      // 개인 스케줄 (null이면 회사 기본값 사용)
      custom: {
        workStartTime: user.customWorkStart ?? null,
        workEndTime:   user.customWorkEnd   ?? null,
        breakMinutes:  (user as any).breakMinutes ?? null,
        lateThresholdMin: (user as any).lateThresholdMinOverride ?? null,
        note: (user as any).scheduleNote ?? null,
      },
      // 실제 적용되는 스케줄 (개인 우선, 없으면 회사 기본값)
      effective: {
        workStartTime: user.customWorkStart    ?? company?.workStartTime    ?? '09:00',
        workEndTime:   user.customWorkEnd      ?? company?.workEndTime      ?? '18:00',
        breakMinutes:  (user as any).breakMinutes ?? null, // null = 법정 최소 자동
        lateThresholdMin: (user as any).lateThresholdMinOverride ?? company?.lateThresholdMin ?? 10,
      },
      // 회사 기본값 (참고용)
      companyDefault: {
        workStartTime: company?.workStartTime ?? '09:00',
        workEndTime:   company?.workEndTime   ?? '18:00',
        lateThresholdMin: company?.lateThresholdMin ?? 10,
      },
      legalBreakNote: '근로기준법 제54조: 4시간 이상 30분 / 8시간 이상 60분 휴게시간 보장',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 개인 근무 스케줄 직접 변경 (owner / 위임자)
  // ─────────────────────────────────────────────────────────────────────────────
  async updateWorkSchedule(
    currentUser: AuthenticatedUser,
    targetId: string,
    dto: UpdateWorkScheduleDto,
  ) {
    const canDirect = currentUser.role === UserRole.OWNER
      || currentUser.permissions?.canManageContracts;

    if (!canDirect) {
      throw new ForbiddenException(
        'owner 또는 계약 관리 권한이 있는 경우에만 직접 변경할 수 있습니다. 결재 기안을 사용하세요.',
      );
    }

    const target = await this.userRepo.findOne({
      where: { id: targetId, companyId: currentUser.companyId },
    });
    if (!target) throw new NotFoundException('직원을 찾을 수 없습니다.');

    // breakMinutes 법정 최소 검증
    if (dto.breakMinutes != null) {
      const minBreak = dto.breakMinutes; // 저장은 그대로, 실제 적용 시 법정 최소와 비교
      if (minBreak < 0) throw new BadRequestException('휴게시간은 0분 이상이어야 합니다.');
    }

    await this.userRepo.update(targetId, {
      customWorkStart: dto.workStartTime !== undefined ? (dto.workStartTime ?? null) : target.customWorkStart,
      customWorkEnd:   dto.workEndTime   !== undefined ? (dto.workEndTime   ?? null) : target.customWorkEnd,
      ...(dto.breakMinutes      !== undefined && { breakMinutes:            dto.breakMinutes }),
      ...(dto.lateThresholdMin  !== undefined && { lateThresholdMinOverride: dto.lateThresholdMin }),
      ...(dto.note              !== undefined && { scheduleNote: dto.note }),
    } as any);

    return this.getWorkSchedule(currentUser, targetId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 근무 스케줄 변경 결재 기안 (manager 이하)
  // ─────────────────────────────────────────────────────────────────────────────
  async requestWorkScheduleChange(
    currentUser: AuthenticatedUser,
    dto: RequestWorkScheduleChangeDto,
  ) {
    const target = await this.userRepo.findOne({
      where: { id: dto.targetUserId, companyId: currentUser.companyId },
    });
    if (!target) throw new NotFoundException('대상 직원을 찾을 수 없습니다.');

    // 결재선 검증
    const approvers: User[] = [];
    for (const aid of dto.approver_ids) {
      const u = await this.userRepo.findOne({ where: { id: aid, companyId: currentUser.companyId } });
      if (!u) throw new BadRequestException(`결재자를 찾을 수 없습니다: ${aid}`);
      if (u.role === UserRole.EMPLOYEE) throw new BadRequestException('결재자는 관리자 이상이어야 합니다.');
      approvers.push(u);
    }
    if (approvers.length === 0) throw new BadRequestException('최소 1명의 결재자가 필요합니다.');

    const payload = {
      targetUserId: dto.targetUserId,
      workStartTime: dto.workStartTime,
      workEndTime:   dto.workEndTime,
      breakMinutes:  dto.breakMinutes,
      lateThresholdMin: dto.lateThresholdMin,
    };

    const doc = this.approvalDocRepo.create({
      companyId: currentUser.companyId,
      authorId:  currentUser.id,
      type:      ApprovalDocType.WORK_SCHEDULE_CHANGE,
      title:     `근무 스케줄 변경 기안 — ${target.name}`,
      content:   JSON.stringify(payload),
      status:    ApprovalDocStatus.IN_PROGRESS,
      currentStep: 1,
    });
    await this.approvalDocRepo.save(doc);

    const steps = approvers.map((u, i) =>
      this.approvalStepRepo.create({
        documentId: doc.id,
        approverId: u.id,
        step: i + 1,
        status: StepStatus.PENDING,
      }),
    );
    await this.approvalStepRepo.save(steps);

    return { docId: doc.id, status: doc.status, message: '결재 기안이 생성되었습니다.' };
  }
}
