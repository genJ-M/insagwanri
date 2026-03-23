import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { HrNote, HrNoteCategory } from '../../database/entities/hr-note.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { CreateHrNoteDto, UpdateHrNoteDto, HrNoteQueryDto } from './dto/hr-note.dto';

@Injectable()
export class HrNotesService {
  constructor(
    @InjectRepository(HrNote)
    private noteRepo: Repository<HrNote>,
  ) {}

  async findAll(currentUser: AuthenticatedUser, query: HrNoteQueryDto) {
    if (currentUser.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    const qb = this.noteRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.targetUser', 'target')
      .leftJoinAndSelect('n.author', 'author')
      .where('n.company_id = :cid', { cid: currentUser.companyId })
      .andWhere('n.deleted_at IS NULL');

    // 비공개 노트: owner는 전체 열람, manager는 본인 작성분만
    if (currentUser.role === UserRole.MANAGER) {
      qb.andWhere('(n.is_private = false OR n.author_id = :me)', { me: currentUser.id });
    }

    if (query.target_user_id) qb.andWhere('n.target_user_id = :uid', { uid: query.target_user_id });
    if (query.category)       qb.andWhere('n.category = :cat',       { cat: query.category });
    if (query.q) {
      qb.andWhere('(n.title ILIKE :q OR n.content ILIKE :q)', { q: `%${query.q}%` });
    }

    qb.orderBy('n.created_at', 'DESC');
    const notes = await qb.getMany();
    return notes.map((n) => this.toResponse(n, currentUser.id));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    if (currentUser.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const note = await this.noteRepo.findOne({
      where: { id, companyId: currentUser.companyId },
      relations: ['targetUser', 'author'],
    });
    if (!note) throw new NotFoundException('노트를 찾을 수 없습니다.');
    if (note.isPrivate && currentUser.role === UserRole.MANAGER && note.authorId !== currentUser.id) {
      throw new ForbiddenException('비공개 노트입니다.');
    }
    return this.toResponse(note, currentUser.id);
  }

  async create(currentUser: AuthenticatedUser, dto: CreateHrNoteDto) {
    if (currentUser.role === UserRole.EMPLOYEE) throw new ForbiddenException();
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
    if (currentUser.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const note = await this.noteRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!note) throw new NotFoundException();
    // 작성자 또는 owner만 수정 가능
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
    if (currentUser.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const note = await this.noteRepo.findOne({ where: { id, companyId: currentUser.companyId } });
    if (!note) throw new NotFoundException();
    if (note.authorId !== currentUser.id && currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('본인이 작성한 노트만 삭제할 수 있습니다.');
    }
    await this.noteRepo.softDelete(id);
    return { message: '삭제되었습니다.' };
  }

  private toResponse(n: HrNote, currentUserId: string) {
    return {
      id:          n.id,
      category:    n.category,
      title:       n.title,
      content:     n.content,
      isPrivate:   n.isPrivate,
      canEdit:     n.authorId === currentUserId,
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
