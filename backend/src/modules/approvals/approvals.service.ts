import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalDocument,
  ApprovalDocStatus,
  ApprovalDocType,
} from '../../database/entities/approval-document.entity';
import {
  ApprovalStep,
  StepStatus,
} from '../../database/entities/approval-step.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole, UserPermissions } from '../../common/types/jwt-payload.type';
import {
  CreateApprovalDto, UpdateApprovalDto,
  ActApprovalDto, ApprovalQueryDto,
} from './dto/approval.dto';
import { APPROVAL_TEMPLATES, TEMPLATE_CATEGORIES } from './approval-templates.constant';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalDocument) private docRepo: Repository<ApprovalDocument>,
    @InjectRepository(ApprovalStep)     private stepRepo: Repository<ApprovalStep>,
    @InjectRepository(User)             private userRepo: Repository<User>,
  ) {}

  // ─── 템플릿 목록 ──────────────────────────────────
  getTemplates() {
    return { success: true, data: { templates: APPROVAL_TEMPLATES, categories: TEMPLATE_CATEGORIES } };
  }

  // ─── 목록 ─────────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: ApprovalQueryDto) {
    const qb = this.docRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.author', 'author')
      .leftJoinAndSelect('d.steps', 'steps')
      .leftJoinAndSelect('steps.approver', 'stepUser')
      .where('d.company_id = :cid', { cid: currentUser.companyId })
      .orderBy('d.created_at', 'DESC');

    const box = query.box ?? 'all';

    if (box === 'sent') {
      qb.andWhere('d.author_id = :me', { me: currentUser.id });
    } else if (box === 'received') {
      // 내가 결재자인 문서
      qb.innerJoin(
        'approval_steps', 'ms',
        'ms.document_id = d.id AND ms.approver_id = :me',
        { me: currentUser.id },
      );
    } else {
      // 직원: 본인 기안 + 본인 수신
      if (currentUser.role === UserRole.EMPLOYEE) {
        qb.andWhere(
          '(d.author_id = :me OR EXISTS (SELECT 1 FROM approval_steps s WHERE s.document_id = d.id AND s.approver_id = :me))',
          { me: currentUser.id },
        );
      }
    }

    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.type)   qb.andWhere('d.type = :type',     { type: query.type });

    const docs = await qb.getMany();
    return docs.map(d => this.toResponse(d, currentUser.id));
  }

  // ─── 단건 ─────────────────────────────────────────
  async findOne(id: string, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    this.assertAccess(doc, currentUser);
    return this.toResponse(doc, currentUser.id);
  }

  // ─── 기안 ─────────────────────────────────────────
  async create(dto: CreateApprovalDto, currentUser: AuthenticatedUser) {
    // 결재자 존재 확인
    for (const a of dto.approvers) {
      const u = await this.userRepo.findOne({ where: { id: a.approver_id, companyId: currentUser.companyId } });
      if (!u) throw new BadRequestException(`결재자를 찾을 수 없습니다: ${a.approver_id}`);
    }

    const doc = this.docRepo.create({
      companyId: currentUser.companyId,
      authorId: currentUser.id,
      type: dto.type,
      title: dto.title,
      content: dto.content,
      status: ApprovalDocStatus.DRAFT,
      currentStep: 0,
      relatedTaskIds: dto.related_task_ids ?? [],
      templateId: dto.template_id ?? null,
    });
    const saved = await this.docRepo.save(doc);

    // 결재선 생성
    const steps = dto.approvers.map(a =>
      this.stepRepo.create({
        documentId: saved.id,
        approverId: a.approver_id,
        step: a.step,
        status: StepStatus.PENDING,
      }),
    );
    await this.stepRepo.save(steps);

    return this.toResponse(await this.loadDoc(saved.id, currentUser.companyId), currentUser.id);
  }

  // ─── 수정 (초안만) ────────────────────────────────
  async update(id: string, dto: UpdateApprovalDto, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.authorId !== currentUser.id) throw new ForbiddenException('기안자만 수정할 수 있습니다.');
    if (doc.status !== ApprovalDocStatus.DRAFT) throw new BadRequestException('초안 상태에서만 수정할 수 있습니다.');

    if (dto.title)             doc.title          = dto.title;
    if (dto.content)           doc.content        = dto.content;
    if (dto.related_task_ids !== undefined) doc.relatedTaskIds = dto.related_task_ids;
    await this.docRepo.save(doc);

    // 결재선 변경
    if (dto.approvers) {
      await this.stepRepo.delete({ documentId: id });
      const steps = dto.approvers.map(a =>
        this.stepRepo.create({ documentId: id, approverId: a.approver_id, step: a.step }),
      );
      await this.stepRepo.save(steps);
    }

    return this.toResponse(await this.loadDoc(id, currentUser.companyId), currentUser.id);
  }

  // ─── 상신 ─────────────────────────────────────────
  async submit(id: string, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.authorId !== currentUser.id) throw new ForbiddenException();
    if (doc.status !== ApprovalDocStatus.DRAFT) throw new BadRequestException('초안 상태에서만 상신할 수 있습니다.');

    if (!doc.steps || doc.steps.length === 0) throw new BadRequestException('결재선이 없습니다.');

    doc.status = ApprovalDocStatus.IN_PROGRESS;
    doc.currentStep = 1;
    doc.submittedAt = new Date();
    await this.docRepo.save(doc);

    return this.toResponse(await this.loadDoc(id, currentUser.companyId), currentUser.id);
  }

  // ─── 승인 ─────────────────────────────────────────
  async approve(id: string, dto: ActApprovalDto, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.status !== ApprovalDocStatus.IN_PROGRESS) throw new BadRequestException('진행 중인 문서만 결재할 수 있습니다.');

    const step = this.getCurrentStepForUser(doc, currentUser.id);
    if (!step) throw new ForbiddenException('현재 결재 차례가 아닙니다.');

    step.status = StepStatus.APPROVED;
    step.comment = dto.comment ?? null;
    step.actedAt = new Date();
    await this.stepRepo.save(step);

    // 다음 단계로
    const sortedSteps = [...doc.steps].sort((a, b) => a.step - b.step);
    const nextStep = sortedSteps.find(s => s.step > step.step && s.status === StepStatus.PENDING);

    if (nextStep) {
      doc.currentStep = nextStep.step;
    } else {
      // 모든 결재 완료
      doc.status = ApprovalDocStatus.APPROVED;
      doc.completedAt = new Date();
    }
    await this.docRepo.save(doc);

    // 권한 변경 기안: 최종 승인 시 자동 적용
    if (doc.status === ApprovalDocStatus.APPROVED && doc.type === ApprovalDocType.PERMISSION_CHANGE) {
      await this.applyPermissionChange(doc);
    }
    // 근무 스케줄 변경 기안: 최종 승인 시 자동 적용
    if (doc.status === ApprovalDocStatus.APPROVED && doc.type === ApprovalDocType.WORK_SCHEDULE_CHANGE) {
      await this.applyWorkScheduleChange(doc);
    }

    return this.toResponse(await this.loadDoc(id, currentUser.companyId), currentUser.id);
  }

  // ─── 반려 ─────────────────────────────────────────
  async reject(id: string, dto: ActApprovalDto, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.status !== ApprovalDocStatus.IN_PROGRESS) throw new BadRequestException('진행 중인 문서만 반려할 수 있습니다.');

    const step = this.getCurrentStepForUser(doc, currentUser.id);
    if (!step) throw new ForbiddenException('현재 결재 차례가 아닙니다.');

    step.status = StepStatus.REJECTED;
    step.comment = dto.comment ?? null;
    step.actedAt = new Date();
    await this.stepRepo.save(step);

    doc.status = ApprovalDocStatus.REJECTED;
    doc.completedAt = new Date();
    await this.docRepo.save(doc);

    return this.toResponse(await this.loadDoc(id, currentUser.companyId), currentUser.id);
  }

  // ─── 취소 (기안자) ────────────────────────────────
  async cancel(id: string, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.authorId !== currentUser.id && currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException();
    }
    if (doc.status === ApprovalDocStatus.APPROVED) throw new BadRequestException('승인 완료된 문서는 취소할 수 없습니다.');

    doc.status = ApprovalDocStatus.CANCELLED;
    await this.docRepo.save(doc);

    return this.toResponse(await this.loadDoc(id, currentUser.companyId), currentUser.id);
  }

  // ─── 삭제 ─────────────────────────────────────────
  async remove(id: string, currentUser: AuthenticatedUser) {
    const doc = await this.loadDoc(id, currentUser.companyId);
    if (doc.authorId !== currentUser.id) throw new ForbiddenException();
    if (doc.status === ApprovalDocStatus.IN_PROGRESS) throw new BadRequestException('진행 중인 문서는 삭제할 수 없습니다.');

    await this.docRepo.softDelete(id);
    return { id };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────
  private async loadDoc(id: string, companyId: string): Promise<ApprovalDocument> {
    const doc = await this.docRepo.findOne({
      where: { id, companyId },
      relations: ['author', 'steps', 'steps.approver'],
    });
    if (!doc) throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    return doc;
  }

  private assertAccess(doc: ApprovalDocument, currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.EMPLOYEE) return;
    const isAuthor = doc.authorId === currentUser.id;
    const isApprover = doc.steps?.some(s => s.approverId === currentUser.id);
    if (!isAuthor && !isApprover) throw new ForbiddenException();
  }

  private getCurrentStepForUser(doc: ApprovalDocument, userId: string): ApprovalStep | null {
    return doc.steps?.find(s => s.approverId === userId && s.step === doc.currentStep) ?? null;
  }

  /**
   * PERMISSION_CHANGE 기안 최종 승인 시 자동으로 권한 적용
   * content: JSON 문자열 { targetUserId, permissions, managedDepartments }
   */
  private async applyPermissionChange(doc: ApprovalDocument): Promise<void> {
    try {
      const payload = JSON.parse(doc.content) as {
        targetUserId: string;
        permissions?: Partial<UserPermissions>;
        managedDepartments?: string[] | null;
      };

      const target = await this.userRepo.findOne({
        where: { id: payload.targetUserId, companyId: doc.companyId },
      });
      if (!target) return; // 대상 직원이 이미 삭제된 경우 무시

      const mergedPermissions: UserPermissions = {
        ...(target.permissions ?? {}),
        ...(payload.permissions ?? {}),
      };

      await this.userRepo.update(
        { id: payload.targetUserId, companyId: doc.companyId },
        {
          permissions: mergedPermissions,
          ...(payload.managedDepartments !== undefined && {
            managedDepartments: payload.managedDepartments,
          }),
        },
      );
    } catch {
      // 파싱 실패 시 결재 자체는 성공으로 유지, 권한만 적용 안 됨
    }
  }

  /**
   * WORK_SCHEDULE_CHANGE 기안 최종 승인 시 개인 근무 스케줄 자동 적용
   * content: JSON 문자열 { targetUserId, workStartTime, workEndTime, breakMinutes, lateThresholdMin }
   */
  private async applyWorkScheduleChange(doc: ApprovalDocument): Promise<void> {
    try {
      const payload = JSON.parse(doc.content) as {
        targetUserId: string;
        workStartTime?: string | null;
        workEndTime?: string | null;
        breakMinutes?: number | null;
        lateThresholdMin?: number | null;
      };

      const updateData: Record<string, any> = {};
      if (payload.workStartTime !== undefined) updateData.customWorkStart = payload.workStartTime;
      if (payload.workEndTime   !== undefined) updateData.customWorkEnd   = payload.workEndTime;
      if (payload.breakMinutes  !== undefined) updateData.breakMinutes    = payload.breakMinutes;
      if (payload.lateThresholdMin !== undefined) updateData.lateThresholdMinOverride = payload.lateThresholdMin;
      updateData.scheduleNote = `결재 승인 적용 (문서 ID: ${doc.id})`;

      await this.userRepo.update(
        { id: payload.targetUserId, companyId: doc.companyId },
        updateData,
      );
    } catch {
      // 파싱 실패 시 결재는 성공으로 유지, 스케줄만 적용 안 됨
    }
  }

  private toResponse(doc: ApprovalDocument, myId: string) {
    const steps = (doc.steps ?? [])
      .sort((a, b) => a.step - b.step)
      .map(s => ({
        id: s.id,
        step: s.step,
        status: s.status,
        comment: s.comment,
        actedAt: s.actedAt,
        approver: s.approver
          ? { id: s.approver.id, name: s.approver.name, position: s.approver.position }
          : null,
        isMyTurn: s.step === doc.currentStep && s.approverId === myId && s.status === StepStatus.PENDING,
      }));

    return {
      id: doc.id,
      type: doc.type,
      title: doc.title,
      content: doc.content,
      status: doc.status,
      currentStep: doc.currentStep,
      submittedAt: doc.submittedAt,
      completedAt: doc.completedAt,
      createdAt: doc.createdAt,
      isMyTurn: steps.some(s => s.isMyTurn),
      isAuthor: doc.authorId === myId,
      relatedTaskIds: doc.relatedTaskIds ?? [],
      templateId: doc.templateId ?? null,
      author: doc.author
        ? { id: doc.author.id, name: doc.author.name, department: doc.author.department, position: doc.author.position }
        : null,
      steps,
    };
  }
}
