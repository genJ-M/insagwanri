import {
  Controller, Post, Get, Delete,
  Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import { UploadUrlDto } from './dto/upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
  ) {}

  /** POST /files/upload-url — Presigned PUT URL 발급 */
  @Post('upload-url')
  async createUploadUrl(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: UploadUrlDto,
  ) {
    const company = await this.companyRepo.findOneOrFail({
      where: { id: user.companyId },
      select: ['id', 'plan'],
    });
    return this.filesService.createUploadUrl(
      user.companyId,
      user.id,
      company.plan,
      dto,
    );
  }

  /** POST /files/confirm — 업로드 완료 확정 */
  @Post('confirm')
  async confirmUpload(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.filesService.confirmUpload(user.companyId, dto);
  }

  /** GET /files/usage — 저장 용량 사용 현황 */
  @Get('usage')
  async getUsage(@GetUser() user: AuthenticatedUser) {
    const company = await this.companyRepo.findOneOrFail({
      where: { id: user.companyId },
      select: ['id', 'plan'],
    });
    return this.filesService.getUsage(user.companyId, company.plan);
  }

  /** GET /files/:id/download — 비공개 파일 다운로드 URL 발급 */
  @Get(':id/download')
  async getDownloadUrl(
    @GetUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) fileId: string,
  ) {
    return this.filesService.getDownloadUrl(user.companyId, fileId);
  }

  /** DELETE /files/:id — 파일 Soft Delete */
  @Delete(':id')
  async deleteFile(
    @GetUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) fileId: string,
  ) {
    await this.filesService.deleteFile(user.companyId, user.id, fileId);
    return { message: '파일이 삭제되었습니다.' };
  }
}
