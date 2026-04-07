import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Contract, ContractStatus, JobCategory } from '../../database/entities/contract.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateContractDto, UpdateContractDto, TerminateContractDto, ContractQueryDto,
} from './dto/contract.dto';
import { CreditService, CREDIT_COSTS } from '../credits/credit.service';
import { CONTRACT_TEMPLATES, getTemplateById } from './contract-templates.constant';

@Injectable()
export class ContractsService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(User)     private userRepo: Repository<User>,
    private configService: ConfigService,
    private creditService: CreditService,
  ) {
    this.openai = new OpenAI({ apiKey: this.configService.get<string>('OPENAI_API_KEY') });
  }

  // ─── 템플릿 목록 ─────────────────────────────────
  getTemplates() {
    return CONTRACT_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      jobCategory: t.jobCategory,
      description: t.description,
      weeklyHours: t.weeklyHours,
    }));
  }

  getTemplateDetail(id: string) {
    const t = getTemplateById(id);
    if (!t) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    return t;
  }

  // ─── 목록 ─────────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: ContractQueryDto) {
    const qb = this.contractRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.company_id = :cid', { cid: currentUser.companyId })
      .orderBy('c.start_date', 'DESC');

    if (currentUser.role === UserRole.EMPLOYEE) {
      qb.andWhere('c.user_id = :uid', { uid: currentUser.id });
    } else {
      if (query.user_id)       qb.andWhere('c.user_id = :uid', { uid: query.user_id });
      if (query.job_category)  qb.andWhere('c.job_category = :jc', { jc: query.job_category });
    }

    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.type)   qb.andWhere('c.type = :type',     { type: query.type });

    // 만료 자동 업데이트
    const today = new Date().toISOString().split('T')[0];
    await this.contractRepo.createQueryBuilder()
      .update(Contract)
      .set({ status: ContractStatus.EXPIRED })
      .where('company_id = :cid AND status = :active AND end_date < :today AND end_date IS NOT NULL', {
        cid: currentUser.companyId, active: ContractStatus.ACTIVE, today,
      })
      .execute();

    const contracts = await qb.getMany();
    return contracts.map(c => this.toResponse(c));
  }

  // ─── 단건 ─────────────────────────────────────────
  async findOne(id: string, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (currentUser.role === UserRole.EMPLOYEE && c.userId !== currentUser.id) {
      throw new ForbiddenException();
    }
    return this.toResponse(c);
  }

  // ─── 등록 (관리자) ───────────────────────────────
  async create(dto: CreateContractDto, currentUser: AuthenticatedUser) {
    const user = await this.userRepo.findOne({ where: { id: dto.user_id, companyId: currentUser.companyId } });
    if (!user) throw new NotFoundException('직원을 찾을 수 없습니다.');

    // 템플릿 적용
    let templateContent: string | undefined;
    if (dto.template_id) {
      const tmpl = getTemplateById(dto.template_id);
      templateContent = tmpl?.content;
    }

    const c = this.contractRepo.create({
      companyId:      currentUser.companyId,
      userId:         dto.user_id,
      type:           dto.type,
      title:          dto.title,
      startDate:      dto.start_date,
      endDate:        dto.end_date ?? null,
      status:         ContractStatus.ACTIVE,
      fileUrl:        dto.file_url ?? null,
      fileName:       dto.file_name ?? null,
      note:           dto.note ?? (templateContent ?? null),
      jobCategory:    (dto.job_category as JobCategory) ?? null,
      jobDescription: dto.job_description ?? null,
      workLocation:   dto.work_location ?? null,
      monthlySalary:  dto.monthly_salary ?? null,
      annualSalary:   dto.annual_salary ?? null,
      salaryDetail:   dto.salary_detail ?? null,
      weeklyHours:    dto.weekly_hours ?? null,
      templateId:     dto.template_id ?? null,
      createdBy:      currentUser.id,
    });
    const saved = await this.contractRepo.save(c);
    return this.toResponse(await this.loadOrFail(saved.id, currentUser.companyId));
  }

  // ─── 수정 (관리자) ───────────────────────────────
  async update(id: string, dto: UpdateContractDto, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (c.status === ContractStatus.TERMINATED) throw new BadRequestException('해지된 계약은 수정할 수 없습니다.');

    Object.assign(c, {
      ...(dto.title           !== undefined && { title:          dto.title }),
      ...(dto.start_date      !== undefined && { startDate:      dto.start_date }),
      ...(dto.end_date        !== undefined && { endDate:        dto.end_date ?? null }),
      ...(dto.file_url        !== undefined && { fileUrl:        dto.file_url ?? null }),
      ...(dto.file_name       !== undefined && { fileName:       dto.file_name ?? null }),
      ...(dto.note            !== undefined && { note:           dto.note ?? null }),
      ...(dto.job_category    !== undefined && { jobCategory:    dto.job_category as JobCategory ?? null }),
      ...(dto.job_description !== undefined && { jobDescription: dto.job_description ?? null }),
      ...(dto.work_location   !== undefined && { workLocation:   dto.work_location ?? null }),
      ...(dto.monthly_salary  !== undefined && { monthlySalary:  dto.monthly_salary ?? null }),
      ...(dto.annual_salary   !== undefined && { annualSalary:   dto.annual_salary ?? null }),
      ...(dto.salary_detail   !== undefined && { salaryDetail:   dto.salary_detail ?? null }),
      ...(dto.weekly_hours    !== undefined && { weeklyHours:    dto.weekly_hours ?? null }),
    });
    await this.contractRepo.save(c);
    return this.toResponse(await this.loadOrFail(id, currentUser.companyId));
  }

  // ─── 해지 (관리자) ───────────────────────────────
  async terminate(id: string, dto: TerminateContractDto, currentUser: AuthenticatedUser) {
    const c = await this.loadOrFail(id, currentUser.companyId);
    if (c.status === ContractStatus.TERMINATED) throw new BadRequestException('이미 해지된 계약입니다.');

    c.status = ContractStatus.TERMINATED;
    c.terminatedAt = new Date();
    c.terminateReason = dto.reason ?? null;
    await this.contractRepo.save(c);
    return this.toResponse(c);
  }

  // ─── 삭제 ────────────────────────────────────────
  async remove(id: string, currentUser: AuthenticatedUser) {
    await this.loadOrFail(id, currentUser.companyId);
    await this.contractRepo.softDelete(id);
    return { id };
  }

  // ─── 이미지 OCR (2 크레딧/장) ───────────────────
  async ocrImage(
    contractId: string,
    imageBase64: string,
    mimeType: string,
    currentUser: AuthenticatedUser,
  ) {
    // 크레딧 차감 (차감 먼저 — 실패 시 롤백)
    await this.creditService.deduct(
      currentUser.companyId, currentUser.id,
      CREDIT_COSTS.OCR, 'ocr',
      '계약서 이미지 OCR 변환 (1장)',
      contractId,
    );

    // GPT-4o Vision으로 OCR
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '다음 계약서 이미지의 모든 텍스트를 정확하게 추출해 주세요. 표, 도장, 서명란 등 모든 내용을 포함하고, 원문 형식을 최대한 유지해 주세요. 한국어로 작성된 계약서입니다.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
            },
          ],
        },
      ],
    });

    const ocrText = response.choices[0]?.message?.content ?? '';

    // 계약서에 OCR 텍스트 저장
    if (contractId) {
      const c = await this.contractRepo.findOne({ where: { id: contractId, companyId: currentUser.companyId } });
      if (c) {
        c.ocrText = ocrText;
        await this.contractRepo.save(c);
      }
    }

    return { ocr_text: ocrText };
  }

  // ─── 내부 헬퍼 ──────────────────────────────────
  private async loadOrFail(id: string, companyId: string): Promise<Contract> {
    const c = await this.contractRepo.findOne({
      where: { id, companyId },
      relations: ['user'],
    });
    if (!c) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return c;
  }

  private toResponse(c: Contract) {
    const today = new Date().toISOString().split('T')[0];
    const daysLeft = c.endDate
      ? Math.ceil((new Date(c.endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: c.id,
      type: c.type,
      title: c.title,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      fileUrl: c.fileUrl,
      fileName: c.fileName,
      note: c.note,
      terminatedAt: c.terminatedAt,
      terminateReason: c.terminateReason,
      createdAt: c.createdAt,
      daysLeft,
      isExpiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 30,
      // 신규 필드
      jobCategory: c.jobCategory,
      jobDescription: c.jobDescription,
      workLocation: c.workLocation,
      monthlySalary: c.monthlySalary,
      annualSalary: c.annualSalary,
      salaryDetail: c.salaryDetail,
      weeklyHours: c.weeklyHours,
      templateId: c.templateId,
      ocrText: c.ocrText,
      user: c.user
        ? { id: c.user.id, name: c.user.name, department: c.user.department, position: c.user.position }
        : null,
    };
  }
}
