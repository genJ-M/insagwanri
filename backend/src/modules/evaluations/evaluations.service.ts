import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  EvaluationCycle,
  EvalCycleStatus,
  ResultVisibility,
  AnswerVisibility,
} from '../../database/entities/evaluation-cycle.entity';
import {
  Evaluation, EvalType, EvalStatus,
} from '../../database/entities/evaluation.entity';
import {
  EvaluationAnswer, EvalCategory,
} from '../../database/entities/evaluation-answer.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCycleDto, UpdateCycleDto, AddParticipantsDto,
  SaveAnswersDto, EvaluationQueryDto,
} from './dto/evaluation.dto';

// 점수 카테고리 (comment 제외)
const SCORE_CATEGORIES = [
  EvalCategory.PERFORMANCE,
  EvalCategory.COMPETENCY,
  EvalCategory.COLLABORATION,
  EvalCategory.GROWTH,
  EvalCategory.LEADERSHIP,
];

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(EvaluationCycle) private cycleRepo: Repository<EvaluationCycle>,
    @InjectRepository(Evaluation)      private evalRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationAnswer) private answerRepo: Repository<EvaluationAnswer>,
    @InjectRepository(User)             private userRepo: Repository<User>,
  ) {}

  // ─── 사이클 목록 ─────────────────────────────────
  async getCycles(currentUser: AuthenticatedUser) {
    const isAdmin = this.isAdmin(currentUser);

    if (isAdmin) {
      const cycles = await this.cycleRepo.find({
        where: { companyId: currentUser.companyId },
        order: { createdAt: 'DESC' },
      });
      return Promise.all(cycles.map(c => this.cycleWithProgress(c, currentUser)));
    }

    // 직원: 참여 중인 사이클만
    const myEvals = await this.evalRepo.find({
      where: { companyId: currentUser.companyId, evaluateeId: currentUser.id },
      select: ['cycleId'],
    });
    const myEvalAs = await this.evalRepo.find({
      where: { companyId: currentUser.companyId, evaluatorId: currentUser.id },
      select: ['cycleId'],
    });
    const cycleIds = [...new Set([
      ...myEvals.map(e => e.cycleId),
      ...myEvalAs.map(e => e.cycleId),
    ])];

    if (!cycleIds.length) return [];

    const cycles = await this.cycleRepo.find({
      where: { id: In(cycleIds), companyId: currentUser.companyId },
    });
    return Promise.all(cycles.map(c => this.cycleWithProgress(c, currentUser)));
  }

  // ─── 사이클 상세 ─────────────────────────────────
  async getCycleDetail(cycleId: string, currentUser: AuthenticatedUser) {
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    this.assertCycleAccess(cycle, currentUser);

    const evals = await this.evalRepo.find({
      where: { cycleId },
      relations: ['evaluatee', 'evaluator'],
    });

    const isAdmin = this.isAdmin(currentUser);
    const participants = [...new Set(evals.map(e => e.evaluateeId))];

    const participantStats = await Promise.all(
      participants.map(async pid => {
        const user = evals.find(e => e.evaluateeId === pid)?.evaluatee;
        const myEvals = evals.filter(e => e.evaluateeId === pid);
        const submitted = myEvals.filter(e => e.status === EvalStatus.SUBMITTED).length;
        const avg = myEvals.filter(e => e.totalScore !== null)
          .reduce((s, e, _, a) => s + Number(e.totalScore) / a.length, 0);

        return {
          userId: pid,
          name: user?.name,
          department: user?.department,
          total: myEvals.length,
          submitted,
          avgScore: submitted > 0 ? Math.round(avg * 10) / 10 : null,
        };
      }),
    );

    return {
      ...this.cycleResponse(cycle),
      participants: participantStats,
    };
  }

  // ─── 사이클 생성 ─────────────────────────────────
  async createCycle(dto: CreateCycleDto, currentUser: AuthenticatedUser) {
    this.requireAdmin(currentUser);

    const cycle = this.cycleRepo.create({
      companyId: currentUser.companyId,
      createdBy: currentUser.id,
      name: dto.name,
      description: dto.description ?? null,
      status: EvalCycleStatus.DRAFT,
      startDate: dto.start_date,
      endDate: dto.end_date,
      isAnonymous: dto.is_anonymous ?? false,
      resultVisibility: dto.result_visibility ?? ResultVisibility.DEPT_MANAGER,
      answerVisibility: dto.answer_visibility ?? AnswerVisibility.MANAGERS_ONLY,
      includeSelf: dto.include_self ?? true,
      includePeer: dto.include_peer ?? false,
      includeManager: dto.include_manager ?? true,
      isPublished: false,
    });
    const saved = await this.cycleRepo.save(cycle);

    // 대상자 참여 등록
    await this.addParticipants(saved.id, dto.participant_ids, saved, currentUser);

    return this.cycleWithProgress(saved, currentUser);
  }

  // ─── 사이클 수정 ─────────────────────────────────
  async updateCycle(cycleId: string, dto: UpdateCycleDto, currentUser: AuthenticatedUser) {
    this.requireAdmin(currentUser);
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    if (cycle.status === EvalCycleStatus.CLOSED) {
      throw new BadRequestException('마감된 사이클은 수정할 수 없습니다.');
    }
    Object.assign(cycle, {
      ...(dto.name               && { name: dto.name }),
      ...(dto.description        !== undefined && { description: dto.description ?? null }),
      ...(dto.end_date           && { endDate: dto.end_date }),
      ...(dto.result_visibility  && { resultVisibility: dto.result_visibility }),
      ...(dto.answer_visibility  && { answerVisibility: dto.answer_visibility }),
    });
    await this.cycleRepo.save(cycle);
    return this.cycleWithProgress(cycle, currentUser);
  }

  // ─── 사이클 활성화 ────────────────────────────────
  async activateCycle(cycleId: string, currentUser: AuthenticatedUser) {
    this.requireAdmin(currentUser);
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    if (cycle.status !== EvalCycleStatus.DRAFT) throw new BadRequestException('초안 상태에서만 활성화할 수 있습니다.');
    cycle.status = EvalCycleStatus.ACTIVE;
    await this.cycleRepo.save(cycle);
    return this.cycleWithProgress(cycle, currentUser);
  }

  // ─── 결과 공개 ────────────────────────────────────
  async publishCycle(cycleId: string, currentUser: AuthenticatedUser) {
    this.requireAdmin(currentUser);
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    cycle.isPublished = true;
    cycle.publishedAt = new Date();
    if (cycle.status === EvalCycleStatus.ACTIVE) cycle.status = EvalCycleStatus.CLOSED;
    await this.cycleRepo.save(cycle);
    return this.cycleWithProgress(cycle, currentUser);
  }

  // ─── 대상자 추가 ──────────────────────────────────
  async addParticipantsToExisting(
    cycleId: string,
    dto: AddParticipantsDto,
    currentUser: AuthenticatedUser,
  ) {
    this.requireAdmin(currentUser);
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    await this.addParticipants(cycleId, dto.user_ids, cycle, currentUser);
    return { added: dto.user_ids.length };
  }

  // ─── 내가 해야 할 평가 목록 ──────────────────────
  async getMyEvaluations(currentUser: AuthenticatedUser, query: EvaluationQueryDto) {
    const box = query.box ?? 'mine';

    const qb = this.evalRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.cycle', 'cycle')
      .leftJoinAndSelect('e.evaluatee', 'evaluatee')
      .leftJoinAndSelect('e.evaluator', 'evaluator')
      .where('e.company_id = :cid', { cid: currentUser.companyId });

    if (box === 'mine') {
      qb.andWhere('e.evaluator_id = :uid', { uid: currentUser.id });
    } else {
      qb.andWhere('e.evaluatee_id = :uid', { uid: currentUser.id });
    }

    if (query.cycle_id) qb.andWhere('e.cycle_id = :cid', { cid: query.cycle_id });

    const evals = await qb.orderBy('e.created_at', 'DESC').getMany();
    return evals.map(e => this.evalSummary(e, currentUser, e.cycle));
  }

  // ─── 평가 단건 조회 (답변 포함) ──────────────────
  async getEvaluation(evalId: string, currentUser: AuthenticatedUser) {
    const ev = await this.evalRepo.findOne({
      where: { id: evalId, companyId: currentUser.companyId },
      relations: ['cycle', 'evaluatee', 'evaluator'],
    });
    if (!ev) throw new NotFoundException('평가를 찾을 수 없습니다.');

    const isAdmin = this.isAdmin(currentUser);
    const isEvaluator = ev.evaluatorId === currentUser.id;
    const isEvaluatee = ev.evaluateeId === currentUser.id;

    if (!isAdmin && !isEvaluator && !isEvaluatee) throw new ForbiddenException();

    const answers = await this.answerRepo.find({ where: { evaluationId: evalId } });

    // 원본 답변 접근 권한
    const canSeeRawAnswers = this.canSeeRawAnswers(ev.cycle, currentUser, isEvaluatee);

    return {
      ...this.evalSummary(ev, currentUser, ev.cycle),
      answers: canSeeRawAnswers
        ? answers.map(a => ({ category: a.category, score: a.score, comment: a.comment }))
        : answers.map(a => ({ category: a.category, score: a.score, comment: null })),
      canSeeRawAnswers,
      canEdit: isEvaluator && ev.status !== EvalStatus.SUBMITTED && ev.cycle.status === EvalCycleStatus.ACTIVE,
    };
  }

  // ─── 답변 저장 ────────────────────────────────────
  async saveAnswers(evalId: string, dto: SaveAnswersDto, currentUser: AuthenticatedUser) {
    const ev = await this.loadEval(evalId, currentUser.companyId);
    if (ev.evaluatorId !== currentUser.id) throw new ForbiddenException('평가자만 답변할 수 있습니다.');
    if (ev.status === EvalStatus.SUBMITTED) throw new BadRequestException('이미 제출된 평가입니다.');
    if (ev.cycle.status !== EvalCycleStatus.ACTIVE) throw new BadRequestException('진행 중인 사이클의 평가만 작성할 수 있습니다.');

    for (const item of dto.answers) {
      const existing = await this.answerRepo.findOne({
        where: { evaluationId: evalId, category: item.category },
      });
      if (existing) {
        existing.score   = item.score   ?? existing.score;
        existing.comment = item.comment ?? existing.comment;
        await this.answerRepo.save(existing);
      } else {
        await this.answerRepo.save(this.answerRepo.create({
          evaluationId: evalId,
          category: item.category as EvalCategory,
          score: item.score ?? null,
          comment: item.comment ?? null,
        }));
      }
    }

    if (ev.status === EvalStatus.PENDING) {
      ev.status = EvalStatus.IN_PROGRESS;
      await this.evalRepo.save(ev);
    }

    return { saved: dto.answers.length };
  }

  // ─── 평가 제출 ────────────────────────────────────
  async submitEvaluation(evalId: string, currentUser: AuthenticatedUser) {
    const ev = await this.loadEval(evalId, currentUser.companyId);
    if (ev.evaluatorId !== currentUser.id) throw new ForbiddenException();
    if (ev.status === EvalStatus.SUBMITTED) throw new BadRequestException('이미 제출되었습니다.');

    const answers = await this.answerRepo.find({ where: { evaluationId: evalId } });
    const scoreAnswers = answers.filter(a => SCORE_CATEGORIES.includes(a.category as EvalCategory) && a.score !== null);

    if (!scoreAnswers.length) throw new BadRequestException('최소 1개 이상 점수를 입력해주세요.');

    const avg = scoreAnswers.reduce((s, a) => s + (a.score ?? 0), 0) / scoreAnswers.length;

    ev.status = EvalStatus.SUBMITTED;
    ev.totalScore = Math.round(avg * 100) / 100;
    ev.submittedAt = new Date();
    await this.evalRepo.save(ev);

    return { id: ev.id, totalScore: ev.totalScore };
  }

  // ─── 피평가자 결과 조회 ───────────────────────────
  async getEvaluateeResults(
    cycleId: string,
    evaluateeId: string,
    currentUser: AuthenticatedUser,
  ) {
    const cycle = await this.loadCycle(cycleId, currentUser.companyId);
    const isAdmin = this.isAdmin(currentUser);
    const isSelf = currentUser.id === evaluateeId;

    // 접근 권한 체크
    if (!isAdmin && !isSelf) throw new ForbiddenException();
    if (isSelf && !cycle.isPublished) {
      throw new ForbiddenException('아직 결과가 공개되지 않았습니다.');
    }

    // 열람 권한 (resultVisibility)
    if (!isAdmin) {
      if (cycle.resultVisibility === ResultVisibility.EVALUATEE_ONLY && !isSelf) {
        throw new ForbiddenException();
      }
    }

    const evals = await this.evalRepo.find({
      where: { cycleId, evaluateeId, status: EvalStatus.SUBMITTED },
      relations: ['evaluator'],
    });

    const isOwner = currentUser.role === UserRole.OWNER;
    const canSeeIdentity = isOwner || !cycle.isAnonymous;
    const canSeeRawAnswers = this.canSeeRawAnswers(cycle, currentUser, isSelf);

    const results = await Promise.all(
      evals.map(async ev => {
        const answers = await this.answerRepo.find({ where: { evaluationId: ev.id } });
        return {
          type: ev.type,
          evaluator: canSeeIdentity
            ? { id: ev.evaluator?.id, name: ev.evaluator?.name }
            : { id: null, name: '익명' },
          totalScore: ev.totalScore,
          answers: canSeeRawAnswers
            ? answers.map(a => ({ category: a.category, score: a.score, comment: a.comment }))
            : answers.map(a => ({ category: a.category, score: a.score, comment: null })),
        };
      }),
    );

    // 카테고리별 평균 집계
    const scoreMap: Record<string, number[]> = {};
    for (const r of results) {
      for (const a of r.answers) {
        if (a.score !== null) {
          if (!scoreMap[a.category]) scoreMap[a.category] = [];
          scoreMap[a.category].push(a.score);
        }
      }
    }
    const categoryAvg = Object.fromEntries(
      Object.entries(scoreMap).map(([k, v]) => [k, Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10]),
    );

    const overallAvg = evals.length > 0
      ? Math.round((evals.reduce((s, e) => s + Number(e.totalScore ?? 0), 0) / evals.length) * 10) / 10
      : null;

    return {
      cycleId,
      evaluateeId,
      isPublished: cycle.isPublished,
      isAnonymous: cycle.isAnonymous,
      canSeeRawAnswers,
      overallAvg,
      categoryAvg,
      evaluationCount: evals.length,
      results: canSeeRawAnswers || isAdmin ? results : results.map(r => ({ ...r, answers: r.answers.map(a => ({ ...a, comment: null })) })),
    };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────
  private isAdmin(u: AuthenticatedUser) {
    return [UserRole.OWNER, UserRole.MANAGER].includes(u.role);
  }

  private requireAdmin(u: AuthenticatedUser) {
    if (!this.isAdmin(u)) throw new ForbiddenException('관리자만 수행할 수 있습니다.');
  }

  private async loadCycle(id: string, companyId: string): Promise<EvaluationCycle> {
    const c = await this.cycleRepo.findOne({ where: { id, companyId } });
    if (!c) throw new NotFoundException('평가 사이클을 찾을 수 없습니다.');
    return c;
  }

  private async loadEval(id: string, companyId: string): Promise<Evaluation> {
    const e = await this.evalRepo.findOne({ where: { id, companyId }, relations: ['cycle'] });
    if (!e) throw new NotFoundException('평가를 찾을 수 없습니다.');
    return e;
  }

  private assertCycleAccess(cycle: EvaluationCycle, currentUser: AuthenticatedUser) {
    if (this.isAdmin(currentUser)) return;
    // 직원: 참여 여부는 별도 체크 (controller에서 목록 필터로 처리)
  }

  private canSeeRawAnswers(
    cycle: EvaluationCycle,
    currentUser: AuthenticatedUser,
    isEvaluatee: boolean,
  ): boolean {
    if (currentUser.role === UserRole.OWNER) return true;
    if (cycle.answerVisibility === AnswerVisibility.NONE) return false;
    if (cycle.answerVisibility === AnswerVisibility.MANAGERS_ONLY) {
      return this.isAdmin(currentUser);
    }
    if (cycle.answerVisibility === AnswerVisibility.EVALUATEE) {
      return this.isAdmin(currentUser) || isEvaluatee;
    }
    return false;
  }

  private async addParticipants(
    cycleId: string,
    userIds: string[],
    cycle: EvaluationCycle,
    currentUser: AuthenticatedUser,
  ) {
    const users = await this.userRepo.findByIds(userIds);
    const managers = await this.userRepo.find({
      where: { companyId: currentUser.companyId, role: UserRole.MANAGER as any },
    });

    const toCreate: Partial<Evaluation>[] = [];

    for (const user of users) {
      // 자기평가
      if (cycle.includeSelf) {
        toCreate.push({
          cycleId,
          companyId: currentUser.companyId,
          evaluateeId: user.id,
          evaluatorId: user.id,
          type: EvalType.SELF,
          status: EvalStatus.PENDING,
        });
      }

      // 상급자 평가 (해당 부서 관리자가 평가)
      if (cycle.includeManager) {
        const deptMgrs = managers.filter(m => m.department === user.department || m.role === UserRole.OWNER as any);
        for (const mgr of deptMgrs) {
          if (mgr.id !== user.id) {
            toCreate.push({
              cycleId,
              companyId: currentUser.companyId,
              evaluateeId: user.id,
              evaluatorId: mgr.id,
              type: EvalType.MANAGER,
              status: EvalStatus.PENDING,
            });
          }
        }
      }
    }

    // 중복 제거 후 저장
    for (const e of toCreate) {
      const exists = await this.evalRepo.findOne({
        where: { cycleId, evaluateeId: e.evaluateeId, evaluatorId: e.evaluatorId },
      });
      if (!exists) {
        await this.evalRepo.save(this.evalRepo.create(e));
      }
    }
  }

  private async cycleWithProgress(cycle: EvaluationCycle, currentUser: AuthenticatedUser) {
    const total = await this.evalRepo.count({ where: { cycleId: cycle.id } });
    const submitted = await this.evalRepo.count({ where: { cycleId: cycle.id, status: EvalStatus.SUBMITTED } });
    return { ...this.cycleResponse(cycle), progress: { total, submitted } };
  }

  private cycleResponse(c: EvaluationCycle) {
    return {
      id: c.id, name: c.name, description: c.description,
      status: c.status, startDate: c.startDate, endDate: c.endDate,
      isPublished: c.isPublished, isAnonymous: c.isAnonymous,
      resultVisibility: c.resultVisibility, answerVisibility: c.answerVisibility,
      includeSelf: c.includeSelf, includePeer: c.includePeer, includeManager: c.includeManager,
      publishedAt: c.publishedAt, createdAt: c.createdAt,
    };
  }

  private evalSummary(ev: Evaluation, currentUser: AuthenticatedUser, cycle: EvaluationCycle) {
    const isOwner = currentUser.role === UserRole.OWNER;
    const canSeeEvaluator = isOwner || !cycle?.isAnonymous;
    return {
      id: ev.id,
      type: ev.type,
      status: ev.status,
      totalScore: ev.totalScore,
      submittedAt: ev.submittedAt,
      cycleId: ev.cycleId,
      cycleName: cycle?.name,
      cycleStatus: cycle?.status,
      evaluatee: ev.evaluatee
        ? { id: ev.evaluatee.id, name: ev.evaluatee.name, department: ev.evaluatee.department, position: ev.evaluatee.position }
        : null,
      evaluator: canSeeEvaluator && ev.evaluator
        ? { id: ev.evaluator.id, name: ev.evaluator.name }
        : { id: null, name: '익명' },
    };
  }
}
