import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateContractDto, UpdateContractDto, TerminateContractDto, ContractQueryDto, OcrImageDto,
} from './dto/contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  /** 계약서 템플릿 목록 */
  @Get('templates')
  getTemplates() {
    return { success: true, data: this.svc.getTemplates() };
  }

  /** 템플릿 상세 (계약서 본문 포함) */
  @Get('templates/:id')
  getTemplateDetail(@Param('id') id: string) {
    return { success: true, data: this.svc.getTemplateDetail(id) };
  }

  /** 이미지 OCR (2 크레딧/장) */
  @Post('ocr')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async ocrImage(@Body() dto: OcrImageDto, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.svc.ocrImage(
      dto.contract_id ?? '',
      dto.image_base64,
      dto.mime_type,
      user,
    );
    return { success: true, data };
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ContractQueryDto) {
    return this.svc.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/terminate')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerminateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.terminate(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.remove(id, user);
  }
}
