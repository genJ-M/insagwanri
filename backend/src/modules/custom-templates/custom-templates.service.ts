import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomTemplate } from '../../database/entities/custom-template.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateCustomTemplateDto, UpdateCustomTemplateDto, CustomTemplateQueryDto,
} from './dto/custom-templates.dto';

@Injectable()
export class CustomTemplatesService {
  constructor(
    @InjectRepository(CustomTemplate)
    private repo: Repository<CustomTemplate>,
  ) {}

  // ── 목록 ──────────────────────────────────────────────────────────────────
  async findAll(user: AuthenticatedUser, query: CustomTemplateQueryDto) {
    const qb = this.repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.creator', 'creator')
      .where('t.company_id = :cid', { cid: user.companyId })
      .orderBy('t.use_count', 'DESC')
      .addOrderBy('t.created_at', 'DESC');

    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.category) qb.andWhere('t.category = :cat', { cat: query.category });

    const scope = query.scope ?? 'all';
    if (scope === 'my') {
      qb.andWhere('t.creator_id = :me', { me: user.id });
    } else if (scope === 'company') {
      qb.andWhere('t.is_company_wide = true');
    } else {
      // all: 내 것 + 회사 공유 템플릿
      qb.andWhere('(t.creator_id = :me OR t.is_company_wide = true)', { me: user.id });
    }

    const templates = await qb.getMany();
    return { success: true, data: templates };
  }

  // ── 생성 ──────────────────────────────────────────────────────────────────
  async create(user: AuthenticatedUser, dto: CreateCustomTemplateDto) {
    // 회사 전체 공유는 manager 이상만
    if (dto.is_company_wide && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('회사 전체 공유 템플릿은 관리자만 설정할 수 있습니다.');
    }

    const tmpl = this.repo.create({
      companyId:     user.companyId,
      creatorId:     user.id,
      type:          dto.type,
      name:          dto.name,
      description:   dto.description ?? null,
      category:      dto.category ?? null,
      fields:        dto.fields ?? {},
      isCompanyWide: dto.is_company_wide ?? false,
    });
    return { success: true, data: await this.repo.save(tmpl) };
  }

  // ── 수정 ──────────────────────────────────────────────────────────────────
  async update(user: AuthenticatedUser, id: string, dto: UpdateCustomTemplateDto) {
    const tmpl = await this.repo.findOne({ where: { id, companyId: user.companyId } });
    if (!tmpl) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    if (tmpl.creatorId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인이 만든 템플릿만 수정할 수 있습니다.');
    }
    if (dto.is_company_wide && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('회사 전체 공유는 관리자만 설정할 수 있습니다.');
    }

    if (dto.name !== undefined)          tmpl.name          = dto.name;
    if (dto.description !== undefined)   tmpl.description   = dto.description ?? null;
    if (dto.category !== undefined)      tmpl.category      = dto.category ?? null;
    if (dto.fields !== undefined)        tmpl.fields        = dto.fields;
    if (dto.is_company_wide !== undefined) tmpl.isCompanyWide = dto.is_company_wide;

    return { success: true, data: await this.repo.save(tmpl) };
  }

  // ── 삭제 ──────────────────────────────────────────────────────────────────
  async remove(user: AuthenticatedUser, id: string) {
    const tmpl = await this.repo.findOne({ where: { id, companyId: user.companyId } });
    if (!tmpl) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    if (tmpl.creatorId !== user.id && user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('본인이 만든 템플릿만 삭제할 수 있습니다.');
    }
    await this.repo.softDelete(id);
    return { success: true };
  }

  // ── 사용 횟수 증가 ─────────────────────────────────────────────────────────
  async incrementUse(user: AuthenticatedUser, id: string) {
    const tmpl = await this.repo.findOne({ where: { id, companyId: user.companyId } });
    if (!tmpl) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    await this.repo.increment({ id }, 'useCount', 1);
    return { success: true };
  }
}
