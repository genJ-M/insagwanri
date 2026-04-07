import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrNote, HrNoteCategory } from '../../database/entities/hr-note.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { CreateHrNoteDto, UpdateHrNoteDto, HrNoteQueryDto } from './dto/hr-note.dto';

// ── 인사(HR) 부서 키워드 ─────────────────────────────────────
const HR_DEPT_KEYWORDS = ['인사', 'hr', '인력', '노무'];

/** 사용자가 인사 부서 소속인지 확인 (대소문자 무관) */
function isHrDepartment(dept?: string | null): boolean {
  if (!dept) return false;
  const lower = dept.toLowerCase();
  return HR_DEPT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * HR 노트를 열람할 수 있는지 확인
 * - OWNER: 항상 허용
 * - 인사팀 MANAGER: 허용
 * - canManageHrNotes = true: 허용
 * - canViewHrNotes = true: 허용
 */
function canViewHrNotes(user: AuthenticatedUser): boolean {
  if (user.role === UserRole.OWNER) return true;
  const perms = user.permissions ?? {};
  if (perms.canManageHrNotes) return true;
  if (perms.canViewHrNotes) return true;
  if (user.role === UserRole.MANAGER && isHrDepartment(user.department)) return true;
  return false;
}

/**
 * HR 노트를 생성·수정·삭제할 수 있는지 확인
 * - OWNER: 항상 허용
 * - 인사팀 MANAGER: 허용
 * - canManageHrNotes = true: 허용
 */
function canManageHrNotes(user: AuthenticatedUser): boolean {
  if (user.role === UserRole.OWNER) return true;
  const perms = user.permissions ?? {};
  if (perms.canManageHrNotes) return true;
  if (user.role === UserRole.MANAGER && isHrDepartment(user.department)) return true;
  return false;
}

@Injectable()
export class HrNotesService {
  constructor(
    @InjectRepository(HrNote)
    private noteRepo: Repository<HrNote>,
  ) {}

  async findAll(currentUser: AuthenticatedUser, query: HrNoteQueryDto) {
    if (!canViewHrNotes(currentUser)) {
      throw new ForbiddenException('HR 노트 열람 권한이 없습니다. 인사팀 관리자 또는 권한 보유자만 접근할 수 있습니다.');
    }

    const qb = this.noteRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.targetUser', 'target')
      .leftJoinAndSelect('n.author', 'author')
      .where('n.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('n.deleted_at IS NULL');

    // 비공개 노트: OWNER·HR관리자는 전체, 열람권한자는 본인 작성분만
    if (currentUser.role !== UserRole.OWNER && !canManageHrNotes(currentUser)) {
      qb.andWhere('(n.is_private = false OR n.author_id = :me)', { me: currentUser.id });
    }

    // 열람 범위 제한 (managed_departments 스코프)
    const perms = currentUser.permissions ?? {};
    const depts = currentUser.managedDepartments;
    const scopedToDepts =
      perms.hrNoteScope === 'managed_departments' &&
      depts && depts.length > 0;
    if (scopedToDepts) {
      qb.andWhere('target.department IN (:...depts)', { depts });
    }

    if (query.target_user_id) qb.andWhere('n.target_user_id = :uid', { uid: query.target_user_id });
    if (query.category)       qb.andWhere('n.category = :cat',       { cat: query.category });
    if (query.q) {
      qb.andWhere('(n.title ILIKE :q OR n.content ILIKE :q)', { q: `%${query.q}%` });
    }

    qb.orderBy('n.created_at', 'DESC');
    const notes = await qb.getMany();
    return notes.map((n) => this.toResponse(n, currentUser));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    if (!canViewHrNotes(currentUser)) {
      throw new ForbiddenException('HR 노트 열람 권한이 없습니다.');
    }
    const note = await this.noteRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['targetUser', 'author'],
    });
    if (!note) throw new NotFoundException('노트를 찾을 수 없습니다.');
    // 비공개 노트: 관리 권한 없으면 본인 작성분만
    if (note.isPrivate && !canManageHrNotes(currentUser) && note.authorId !== currentUser.id) {
      throw new ForbiddenException('비공개 노트입니다.');
    }
    return this.toResponse(note, currentUser);
  }

  async create(currentUser: AuthenticatedUser, dto: CreateHrNoteDto) {
    if (!canManageHrNotes(currentUser)) {
      throw new ForbiddenException('HR 노트 작성 권한이 없습니다. 인사팀 관리자 또는 HR 노트 관리 권한 보유자만 작성할 수 있습니다.');
    }
    const note = this.noteRepo.create({
      companyId:    currentUser.companyId,
      targetUserId: dto.target_user_id,
      authorId:     currentUser.id,
      category:     dto.category as HrNoteCategory,
      title:        dto.title,
      content:      dto.content,
      isPrivate:    dto.is_private ?? false,
    });
    const saved = await this.noteRepo.save(note);
    return this.findOne(currentUser, saved.id);
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateHrNoteDto) {
    if (!canManageHrNotes(currentUser)) {
      throw new ForbiddenException('HR 노트 수정 권한이 없습니다.');
    }
    const note = await this.noteRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!note) throw new NotFoundException();
    // OWNER 또는 직접 관리 권한자만 수정 (열람 전용 권한자는 불가)
    if (note.authorId !== currentUser.id && currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('본인이 작성한 노트만 수정할 수 있습니다.');
    }
    if (dto.category  != null) note.category  = dto.category as HrNoteCategory;
    if (dto.title     != null) note.title     = dto.title;
    if (dto.content   != null) note.content   = dto.content;
    if (dto.is_private != null) note.isPrivate = dto.is_private;
    await this.noteRepo.save(note);
    return this.findOne(currentUser, id);
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    if (!canManageHrNotes(currentUser)) {
      throw new ForbiddenException('HR 노트 삭제 권한이 없습니다.');
    }
    const note = await this.noteRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!note) throw new NotFoundException();
    if (note.authorId !== currentUser.id && currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('본인이 작성한 노트만 삭제할 수 있습니다.');
    }
    await this.noteRepo.softDelete(id);
    return { message: '삭제되었습니다.' };
  }

  private toResponse(n: HrNote, currentUser: AuthenticatedUser) {
    const canEdit =
      n.authorId === currentUser.id ||
      currentUser.role === UserRole.OWNER;
    return {
      id:          n.id,
      category:    n.category,
      title:       n.title,
      content:     n.content,
      isPrivate:   n.isPrivate,
      canEdit,
      createdAt:   n.createdAt,
      updatedAt:   n.updatedAt,
      targetUser: n.targetUser ? {
        id:         n.targetUser.id,
        name:       n.targetUser.name,
        department: n.targetUser.department,
        position:   n.targetUser.position,
      } : undefined,
      author: n.author ? {
        id:   n.author.id,
        name: n.author.name,
      } : undefined,
    };
  }
}
