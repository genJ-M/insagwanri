import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Training, TrainingStatus } from '../../database/entities/training.entity';
import { TrainingEnrollment, EnrollmentStatus } from '../../database/entities/training-enrollment.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { CreateTrainingDto, UpdateTrainingDto, EnrollDto } from './dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Training)
    private trainingRepo: Repository<Training>,
    @InjectRepository(TrainingEnrollment)
    private enrollmentRepo: Repository<TrainingEnrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ─── 교육 목록 조회 ──────────────────────────────────
  async getTrainings(currentUser: AuthenticatedUser) {
    const trainings = await this.trainingRepo.find({
      where: { companyId: currentUser.companyId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });

    // enrollmentCount 집계
    const ids = trainings.map(t => t.id);
    if (ids.length === 0) return [];

    const counts = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select('e.training_id', 'trainingId')
      .addSelect('COUNT(e.id)', 'count')
      .where('e.training_id IN (:...ids)', { ids })
      .andWhere('e.status != :dropped', { dropped: EnrollmentStatus.DROPPED })
      .groupBy('e.training_id')
      .getRawMany();

    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.trainingId] = Number(row.count);
    }

    return trainings.map(t => this.toResponse(t, countMap[t.id] ?? 0));
  }

  // ─── 교육 생성 ───────────────────────────────────────
  async createTraining(dto: CreateTrainingDto, currentUser: AuthenticatedUser) {
    this.assertAdmin(currentUser);

    const training = this.trainingRepo.create({
      companyId: currentUser.companyId,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category ?? null,
      targetDepartment: dto.targetDepartment ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      maxParticipants: dto.maxParticipants ?? null,
      status: TrainingStatus.PLANNED,
      createdBy: currentUser.id,
    });

    const saved = await this.trainingRepo.save(training);
    const full = await this.trainingRepo.findOne({
      where: { id: saved.id },
      relations: ['creator'],
    });
    return this.toResponse(full!, 0);
  }

  // ─── 교육 수정 ───────────────────────────────────────
  async updateTraining(id: string, dto: UpdateTrainingDto, currentUser: AuthenticatedUser) {
    this.assertAdmin(currentUser);

    const training = await this.getTrainingOrFail(id, currentUser.companyId);

    if (dto.title !== undefined) training.title = dto.title;
    if (dto.description !== undefined) training.description = dto.description ?? null;
    if (dto.category !== undefined) training.category = dto.category ?? null;
    if (dto.targetDepartment !== undefined) training.targetDepartment = dto.targetDepartment ?? null;
    if (dto.startDate !== undefined) training.startDate = dto.startDate ?? null;
    if (dto.endDate !== undefined) training.endDate = dto.endDate ?? null;
    if (dto.maxParticipants !== undefined) training.maxParticipants = dto.maxParticipants ?? null;
    if (dto.status !== undefined) training.status = dto.status as TrainingStatus;

    const saved = await this.trainingRepo.save(training);
    const full = await this.trainingRepo.findOne({
      where: { id: saved.id },
      relations: ['creator'],
    });

    const enrollmentCount = await this.enrollmentRepo.count({
      where: { trainingId: id, status: In([EnrollmentStatus.ENROLLED, EnrollmentStatus.COMPLETED]) },
    });

    return this.toResponse(full!, enrollmentCount);
  }

  // ─── 교육 취소 (soft delete — status CANCELED) ───────
  async deleteTraining(id: string, currentUser: AuthenticatedUser) {
    this.assertAdmin(currentUser);

    const training = await this.getTrainingOrFail(id, currentUser.companyId);
    training.status = TrainingStatus.CANCELED;
    await this.trainingRepo.save(training);
    return { id };
  }

  // ─── 수강 등록 ───────────────────────────────────────
  async enrollUsers(id: string, dto: EnrollDto, currentUser: AuthenticatedUser) {
    this.assertAdmin(currentUser);

    const training = await this.getTrainingOrFail(id, currentUser.companyId);

    // 요청한 유저들이 같은 company 소속인지 검증
    const users = await this.userRepo.findBy({
      id: In(dto.userIds),
      companyId: currentUser.companyId,
    });
    if (users.length !== dto.userIds.length) {
      throw new NotFoundException('일부 직원을 찾을 수 없습니다.');
    }

    // 기존 등록 조회 (중복 무시)
    const existing = await this.enrollmentRepo.find({
      where: { trainingId: id, userId: In(dto.userIds) },
      select: ['userId'],
    });
    const existingUserIds = new Set(existing.map(e => e.userId));

    const toCreate = dto.userIds
      .filter(uid => !existingUserIds.has(uid))
      .map(uid =>
        this.enrollmentRepo.create({
          companyId: currentUser.companyId,
          trainingId: id,
          userId: uid,
          status: EnrollmentStatus.ENROLLED,
        }),
      );

    if (toCreate.length > 0) {
      await this.enrollmentRepo.save(toCreate);
    }

    // 등록 결과 반환
    const enrollments = await this.enrollmentRepo.find({
      where: { trainingId: id, companyId: currentUser.companyId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return {
      trainingId: id,
      enrolled: toCreate.length,
      skipped: dto.userIds.length - toCreate.length,
      enrollments: enrollments.map(e => this.toEnrollmentResponse(e)),
    };
  }

  // ─── 수료 처리 ───────────────────────────────────────
  async completeEnrollment(
    trainingId: string,
    userId: string,
    note: string | undefined,
    currentUser: AuthenticatedUser,
  ) {
    this.assertAdmin(currentUser);

    await this.getTrainingOrFail(trainingId, currentUser.companyId);

    const enrollment = await this.enrollmentRepo.findOne({
      where: { trainingId, userId, companyId: currentUser.companyId },
      relations: ['user'],
    });
    if (!enrollment) throw new NotFoundException('수강 등록 정보를 찾을 수 없습니다.');

    enrollment.status = EnrollmentStatus.COMPLETED;
    enrollment.completedAt = new Date();
    enrollment.note = note ?? null;
    await this.enrollmentRepo.save(enrollment);

    return this.toEnrollmentResponse(enrollment);
  }

  // ─── 내 수강 목록 ────────────────────────────────────
  async getMyTrainings(currentUser: AuthenticatedUser) {
    const enrollments = await this.enrollmentRepo.find({
      where: { userId: currentUser.id, companyId: currentUser.companyId },
      relations: ['training', 'training.creator'],
      order: { createdAt: 'DESC' },
    });

    return enrollments.map(e => ({
      id: e.id,
      status: e.status,
      completedAt: e.completedAt,
      note: e.note,
      createdAt: e.createdAt,
      training: e.training
        ? this.toResponse(e.training, 0)
        : null,
    }));
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────
  private async getTrainingOrFail(id: string, companyId: string): Promise<Training> {
    const training = await this.trainingRepo.findOne({ where: { id, companyId } });
    if (!training) throw new NotFoundException('교육을 찾을 수 없습니다.');
    return training;
  }

  private assertAdmin(currentUser: AuthenticatedUser) {
    const isAdmin = [UserRole.OWNER, UserRole.MANAGER].includes(currentUser.role);
    if (!isAdmin) throw new ForbiddenException('관리자만 접근할 수 있습니다.');
  }

  private toResponse(training: Training, enrollmentCount: number) {
    return {
      id: training.id,
      title: training.title,
      description: training.description,
      category: training.category,
      targetDepartment: training.targetDepartment,
      startDate: training.startDate,
      endDate: training.endDate,
      maxParticipants: training.maxParticipants,
      status: training.status,
      enrollmentCount,
      createdBy: training.creator
        ? { id: training.creator.id, name: training.creator.name }
        : { id: training.createdBy, name: null },
      createdAt: training.createdAt,
      updatedAt: training.updatedAt,
    };
  }

  private toEnrollmentResponse(enrollment: TrainingEnrollment) {
    return {
      id: enrollment.id,
      trainingId: enrollment.trainingId,
      userId: enrollment.userId,
      status: enrollment.status,
      completedAt: enrollment.completedAt,
      note: enrollment.note,
      createdAt: enrollment.createdAt,
      user: enrollment.user
        ? {
            id: enrollment.user.id,
            name: enrollment.user.name,
            department: enrollment.user.department,
            position: enrollment.user.position,
          }
        : null,
    };
  }
}
