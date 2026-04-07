import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { TaskReport } from '../../database/entities/task-report.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateTaskDto, UpdateTaskDto, CreateReportDto, FeedbackDto, TaskQueryDto,
  RequestTimeAdjustDto, RespondTimeAdjustDto,
} from './dto/tasks.dto';
import { TASK_TEMPLATES, TASK_CATEGORIES } from './task-templates.constant';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,

    @InjectRepository(TaskReport)
    private reportRepo: Repository<TaskReport>,
  ) {}

  // ─────────────────────────────────────────
  // 템플릿 목록
  // ─────────────────────────────────────────
  getTemplates() {
    return { templates: TASK_TEMPLATES, categories: TASK_CATEGORIES };
  }

  // ─────────────────────────────────────────
  // 업무 생성
  // ─────────────────────────────────────────
  async createTask(currentUser: AuthenticatedUser, dto: CreateTaskDto) {
    // 하위 업무 생성 시 상위 업무 존재 여부 확인
    if (dto.parent_task_id) {
      const parent = await this.taskRepo.findOne({
        where: { id: dto.parent_task_id, companyId: currentUser.companyId },
      });
      if (!parent) throw new NotFoundException('상위 업무를 찾을 수 없습니다.');
    }

    // 기한 유효성 검증: 오늘 이전 날짜 불가
    if (dto.due_datetime) {
      const proposed = new Date(dto.due_datetime);
      const now = new Date();
      now.setMinutes(0, 0, 0); // 현재 시간 정각으로 내림
      if (proposed < now) {
        throw new BadRequestException('기한은 현재 시각 이후로 설정해야 합니다.');
      }
    }

    const task = this.taskRepo.create({
      companyId:      currentUser.companyId,
      creatorId:      currentUser.id,
      title:          dto.title,
      description:    dto.description ?? null,
      scope:          dto.scope ?? null,
      assigneeId:     dto.assignee_id ?? null,
      priority:       (dto.priority as TaskPriority) ?? TaskPriority.NORMAL,
      category:       dto.category ?? null,
      startDate:      dto.start_date ?? null,
      dueDate:        dto.due_date ?? null,
      dueDatetime:    dto.due_datetime ? new Date(dto.due_datetime) : null,
      templateId:     dto.template_id ?? null,
      attachmentUrls: dto.attachment_urls ?? [],
      parentTaskId:   dto.parent_task_id ?? null,
      status:         TaskStatus.PENDING,
    });

    const saved = await this.taskRepo.save(task) as Task;
    return this.findTaskById(saved.id, currentUser);
  }

  // ─────────────────────────────────────────
  // 업무 목록
  // ─────────────────────────────────────────
  async getTasks(currentUser: AuthenticatedUser, query: TaskQueryDto) {
    const { status, priority, assignee_id, due_date, category, search, page, limit } = query;
    const skip = ((page ?? 1) - 1) * (limit ?? 20);

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoin('t.creator', 'creator')
      .leftJoin('t.assignee', 'assignee')
      .addSelect([
        't.id', 't.title', 't.status', 't.priority', 't.category',
        't.dueDate', 't.createdAt', 't.assigneeId',
        'creator.id', 'creator.name',
        'assignee.id', 'assignee.name', 'assignee.department', 'assignee.profileImageUrl',
      ])
      .where('t.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('t.deleted_at IS NULL');

    // employee는 본인 배정 업무만 조회
    if (currentUser.role === UserRole.EMPLOYEE) {
      qb.andWhere('t.assignee_id = :userId', { userId: currentUser.id });
    }

    if (status)      qb.andWhere('t.status = :status', { status });
    if (priority)    qb.andWhere('t.priority = :priority', { priority });
    if (due_date)    qb.andWhere('t.due_date = :dueDate', { dueDate: due_date });
    if (category)    qb.andWhere('t.category = :category', { category });
    if (search)      qb.andWhere('t.title ILIKE :search', { search: `%${search}%` });

    // manager 이상만 assignee_id 필터 사용 가능
    if (assignee_id && currentUser.role !== UserRole.EMPLOYEE) {
      qb.andWhere('t.assignee_id = :assigneeId', { assigneeId: assignee_id });
    }

    qb.orderBy('t.created_at', 'DESC').offset(skip).limit(limit);

    const [tasks, total] = await qb.getManyAndCount();

    // 상태별 요약
    const statusSummary = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('t.deleted_at IS NULL')
      .groupBy('t.status')
      .getRawMany();

    return {
      tasks,
      meta: {
        page, limit, total,
        status_summary: statusSummary.reduce((acc, s) => {
          acc[s.status] = parseInt(s.count);
          return acc;
        }, {}),
      },
    };
  }

  // ─────────────────────────────────────────
  // 업무 상세
  // ─────────────────────────────────────────
  async findTaskById(id: string, currentUser: AuthenticatedUser) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['creator', 'assignee', 'subTasks', 'parentTask'],
    });

    if (!task || task.deletedAt) {
      throw new NotFoundException('업무를 찾을 수 없습니다.');
    }

    // employee는 자신의 업무만 조회
    if (
      currentUser.role === UserRole.EMPLOYEE &&
      task.assigneeId !== currentUser.id &&
      task.creatorId !== currentUser.id
    ) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // 최근 보고 3개 미리보기
    const reports = await this.reportRepo.find({
      where: { taskId: id },
      order: { createdAt: 'DESC' },
      take: 3,
      relations: ['user'],
    });

    return { ...task, reports };
  }

  // ─────────────────────────────────────────
  // 업무 수정
  // ─────────────────────────────────────────
  async updateTask(id: string, currentUser: AuthenticatedUser, dto: UpdateTaskDto) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });

    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');

    // employee는 status만 변경 가능 (본인 업무만)
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (task.assigneeId !== currentUser.id) {
        throw new ForbiddenException('본인 업무만 수정할 수 있습니다.');
      }
      if (dto.status === undefined) {
        throw new ForbiddenException('직원은 업무 상태만 변경할 수 있습니다.');
      }
      // 허용된 필드만 처리
      if (dto.status) {
        task.status = dto.status as TaskStatus;
        if (dto.status === TaskStatus.DONE) task.completedAt = new Date();
      }
      return this.taskRepo.save(task);
    }

    // manager/owner: 모든 필드 수정 가능
    if (dto.title)           task.title          = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.scope !== undefined)       task.scope       = dto.scope;
    if (dto.assignee_id !== undefined) task.assigneeId  = dto.assignee_id;
    if (dto.priority)        task.priority       = dto.priority as TaskPriority;
    if (dto.category !== undefined)    task.category    = dto.category;
    if (dto.status) {
      task.status = dto.status as TaskStatus;
      if (dto.status === TaskStatus.DONE) task.completedAt = new Date();
    }
    if (dto.due_date !== undefined)    task.dueDate         = dto.due_date;
    if (dto.due_datetime !== undefined) {
      if (dto.due_datetime) {
        const proposed = new Date(dto.due_datetime);
        const now = new Date(); now.setMinutes(0, 0, 0);
        if (proposed < now) throw new BadRequestException('기한은 현재 시각 이후로 설정해야 합니다.');
        task.dueDatetime = proposed;
      } else {
        task.dueDatetime = null;
      }
    }
    if (dto.attachment_urls)           task.attachmentUrls  = dto.attachment_urls;

    return this.taskRepo.save(task);
  }

  // ─────────────────────────────────────────
  // 업무 삭제 (Soft Delete)
  // ─────────────────────────────────────────
  async deleteTask(id: string, currentUser: AuthenticatedUser) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');
    await this.taskRepo.softDelete(id);
    return { id, deleted_at: new Date() };
  }

  // ─────────────────────────────────────────
  // 삭제 요청 (관리자 or 담당자)
  // ─────────────────────────────────────────
  async requestDeletion(id: string, currentUser: AuthenticatedUser) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');
    if (task.deletionRequestedAt) throw new ForbiddenException('이미 삭제 요청된 업무입니다.');

    const isManager  = currentUser.role !== UserRole.EMPLOYEE;
    const isAssignee = task.assigneeId === currentUser.id;
    if (!isManager && !isAssignee) {
      throw new ForbiddenException('삭제 요청 권한이 없습니다.');
    }

    await this.taskRepo.update(id, {
      deletionRequestedAt:  new Date(),
      deletionRequestedById: currentUser.id,
      deletionRequesterRole: isManager ? 'manager' : 'assignee',
    });
    return { id, deletion_requested: true };
  }

  // ─────────────────────────────────────────
  // 삭제 승인 (요청자의 반대편이 승인)
  // ─────────────────────────────────────────
  async approveDeletion(id: string, currentUser: AuthenticatedUser) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');
    if (!task.deletionRequestedAt) throw new ForbiddenException('삭제 요청이 없는 업무입니다.');

    const requesterRole = task.deletionRequesterRole;
    const isManager     = currentUser.role !== UserRole.EMPLOYEE;
    const isAssignee    = task.assigneeId === currentUser.id;

    // 관리자가 요청 → 담당자가 승인 / 담당자가 요청 → 관리자가 승인
    const canApprove =
      (requesterRole === 'manager'  && isAssignee && !isManager) ||
      (requesterRole === 'assignee' && isManager);

    if (!canApprove) {
      throw new ForbiddenException('삭제 승인 권한이 없습니다. 요청자의 반대편만 승인할 수 있습니다.');
    }

    await this.taskRepo.softDelete(id);
    return { id, deleted_at: new Date() };
  }

  // ─────────────────────────────────────────
  // 업무 보고 제출
  // ─────────────────────────────────────────
  async createReport(
    taskId: string,
    currentUser: AuthenticatedUser,
    dto: CreateReportDto,
  ) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');

    // employee는 본인 업무에만 보고 가능
    if (
      currentUser.role === UserRole.EMPLOYEE &&
      task.assigneeId !== currentUser.id
    ) {
      throw new ForbiddenException('해당 업무에 대한 보고 권한이 없습니다.');
    }

    const report = this.reportRepo.create({
      companyId:       currentUser.companyId,
      taskId,
      userId:          currentUser.id,
      content:         dto.content,
      progressPercent: dto.progress_percent ?? null,
      attachmentUrls:  dto.attachment_urls ?? [],
      isAiAssisted:    dto.is_ai_assisted ?? false,
    });

    const saved = await this.reportRepo.save(report) as TaskReport;

    // 진척률 반영 시 업무 상태를 in_progress로 변경
    if (
      dto.progress_percent !== undefined &&
      task.status === TaskStatus.PENDING
    ) {
      await this.taskRepo.update(taskId, { status: TaskStatus.IN_PROGRESS });
    }

    return this.reportRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
  }

  // ─────────────────────────────────────────
  // 보고 목록
  // ─────────────────────────────────────────
  async getReports(taskId: string, currentUser: AuthenticatedUser) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, companyId: currentUser.companyId },
    });
    if (!task) throw new NotFoundException('업무를 찾을 수 없습니다.');

    return this.reportRepo.find({
      where: { taskId, companyId: currentUser.companyId },
      relations: ['user', 'feedbackUser'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─────────────────────────────────────────
  // 보고 피드백
  // ─────────────────────────────────────────
  async addFeedback(
    taskId: string,
    reportId: string,
    currentUser: AuthenticatedUser,
    dto: FeedbackDto,
  ) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, taskId, companyId: currentUser.companyId },
    });
    if (!report) throw new NotFoundException('보고를 찾을 수 없습니다.');

    report.feedback   = dto.feedback;
    report.feedbackBy = currentUser.id;
    report.feedbackAt = new Date();

    return this.reportRepo.save(report);
  }

  // ─────────────────────────────────────────
  // 내 보고 이력
  // ─────────────────────────────────────────
  async getMyReports(currentUser: AuthenticatedUser) {
    return this.reportRepo.find({
      where: { userId: currentUser.id, companyId: currentUser.companyId },
      relations: ['task'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─────────────────────────────────────────
  // 기한 조정 요청 (담당자)
  // ─────────────────────────────────────────
  async requestTimeAdjust(
    id: string,
    currentUser: AuthenticatedUser,
    dto: RequestTimeAdjustDto,
  ) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');
    if (task.assigneeId !== currentUser.id) throw new ForbiddenException('담당자만 기한 조정을 요청할 수 있습니다.');
    if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
      throw new BadRequestException('완료·취소된 업무는 기한 조정을 요청할 수 없습니다.');
    }
    if (task.timeAdjustStatus === 'pending') {
      throw new BadRequestException('이미 기한 조정 요청이 대기 중입니다.');
    }

    const proposed = new Date(dto.proposed_datetime);
    const now = new Date(); now.setMinutes(0, 0, 0);
    if (proposed < now) throw new BadRequestException('제안 기한은 현재 시각 이후로 설정해야 합니다.');

    await this.taskRepo.update(id, {
      timeAdjustStatus: 'pending',
      timeAdjustProposedDatetime: proposed,
      timeAdjustMessage: dto.message ?? null,
      timeAdjustRequestedAt: new Date(),
      timeAdjustRespondedAt: null,
    });

    // TODO: 알림 발송 (task_time_adjust_request) — 지시자(creatorId)에게
    // await this.notificationsService.push(task.creatorId, 'task_time_adjust_request', { taskId: id });

    return this.taskRepo.findOne({ where: { id } });
  }

  // ─────────────────────────────────────────
  // 기한 조정 응답 (지시자/관리자)
  // ─────────────────────────────────────────
  async respondTimeAdjust(
    id: string,
    currentUser: AuthenticatedUser,
    dto: RespondTimeAdjustDto,
  ) {
    const task = await this.taskRepo.findOne({
      where: { id, companyId: currentUser.companyId },
    });
    if (!task || task.deletedAt) throw new NotFoundException('업무를 찾을 수 없습니다.');

    // 지시자(creator) 또는 manager/owner만 응답 가능
    const isCreator  = task.creatorId === currentUser.id;
    const isManager  = currentUser.role !== UserRole.EMPLOYEE;
    if (!isCreator && !isManager) throw new ForbiddenException('기한 조정 응답 권한이 없습니다.');
    if (task.timeAdjustStatus !== 'pending') throw new BadRequestException('대기 중인 기한 조정 요청이 없습니다.');

    const updateData: Partial<Task> = {
      timeAdjustStatus: dto.action,
      timeAdjustRespondedAt: new Date(),
    };

    // 승인 시 실제 기한 변경
    if (dto.action === 'approved' && task.timeAdjustProposedDatetime) {
      updateData.dueDatetime = task.timeAdjustProposedDatetime;
    }

    await this.taskRepo.update(id, updateData);

    // TODO: 알림 발송 — 담당자(assigneeId)에게
    // const notifType = dto.action === 'approved' ? 'task_time_adjust_approved' : 'task_time_adjust_rejected';
    // await this.notificationsService.push(task.assigneeId, notifType, { taskId: id });

    return this.taskRepo.findOne({ where: { id } });
  }
}
