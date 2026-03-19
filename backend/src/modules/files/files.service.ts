import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { File, FileFeature } from '../../database/entities/file.entity';
import { S3Service } from './s3.service';
import { FileValidatorService, PLAN_MAX_FILE_BYTES } from './file-validator.service';
import { UploadUrlDto } from './dto/upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

// 공개 파일 기능 (public 버킷)
const PUBLIC_FEATURES: FileFeature[] = ['profiles', 'logo'];

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly cdnBase: string;

  constructor(
    @InjectRepository(File) private readonly filesRepo: Repository<File>,
    private readonly s3: S3Service,
    private readonly validator: FileValidatorService,
    private readonly config: ConfigService,
  ) {
    this.cdnBase = config.get<string>('CDN_BASE_URL', '');
  }

  // ── 1. Presigned PUT URL 발급 ───────────────────────────────────────────────

  async createUploadUrl(
    companyId: string,
    userId: string,
    companyPlan: string,
    dto: UploadUrlDto,
  ) {
    const { feature, fileName, contentType, fileSizeBytes } = dto;

    // 플랜별 단일 파일 크기 한도
    const planMaxBytes = PLAN_MAX_FILE_BYTES[companyPlan] ?? PLAN_MAX_FILE_BYTES.free;
    if (fileSizeBytes > planMaxBytes) {
      throw new ForbiddenException(
        `현재 플랜(${companyPlan})에서는 단일 파일 최대 ${planMaxBytes / 1024 / 1024}MB까지 업로드 가능합니다.`,
      );
    }

    // MIME + 기능별 검증 → 확장자 획득
    const ext = this.validator.validate(feature, contentType, fileSizeBytes);

    // 저장 용량 한도 확인
    await this.checkStorageQuota(companyId, companyPlan, fileSizeBytes);

    // S3 Key 생성
    const isPublic = PUBLIC_FEATURES.includes(feature);
    const bucket = isPublic ? this.s3.publicBucket : this.s3.privateBucket;
    const fileKey = this.buildFileKey(companyId, feature, ext);

    // files 레코드 pending 상태로 생성
    const file = this.filesRepo.create({
      companyId,
      uploadedBy: userId,
      originalName: fileName,
      fileKey,
      bucket,
      contentType,
      fileSizeBytes: null,    // confirm 후 실제 크기로 덮어씀
      feature,
      status: 'pending',
    });
    await this.filesRepo.save(file);

    // Presigned PUT URL
    const uploadUrl = await this.s3.createPresignedPutUrl(
      bucket,
      fileKey,
      contentType,
      fileSizeBytes,
      companyId,
      userId,
    );

    const expiresAt = new Date(Date.now() + 600_000);

    return { fileId: file.id, uploadUrl, fileKey, expiresAt };
  }

  // ── 2. 업로드 완료 확정 ────────────────────────────────────────────────────

  async confirmUpload(companyId: string, dto: ConfirmUploadDto) {
    const file = await this.filesRepo.findOne({
      where: { id: dto.fileId, companyId },
    });

    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다.');
    if (file.status !== 'pending') {
      throw new BadRequestException('이미 확정되었거나 삭제된 파일입니다.');
    }

    // S3에 실제 존재하는지 확인
    const { exists, size } = await this.s3.checkFileExists(file.bucket, file.fileKey);
    if (!exists) {
      throw new BadRequestException('S3에 파일이 아직 업로드되지 않았습니다. 업로드 후 다시 시도하세요.');
    }

    // 확정 처리
    file.status = 'confirmed';
    file.fileSizeBytes = size;
    file.confirmedAt = new Date();
    if (dto.refType) file.refType = dto.refType;
    if (dto.refId) file.refId = dto.refId;
    await this.filesRepo.save(file);

    const url = this.buildPublicUrl(file);
    return {
      fileId: file.id,
      url,
      fileName: file.originalName,
      fileSizeBytes: file.fileSizeBytes,
      contentType: file.contentType,
    };
  }

  // ── 3. 비공개 파일 다운로드 URL ────────────────────────────────────────────

  async getDownloadUrl(companyId: string, fileId: string) {
    const file = await this.filesRepo.findOne({
      where: { id: fileId, companyId, status: 'confirmed' },
    });

    if (!file || file.deletedAt) throw new NotFoundException('파일을 찾을 수 없습니다.');
    if (file.bucket === this.s3.publicBucket) {
      // 공개 파일은 CDN URL 직접 반환
      return { downloadUrl: this.buildPublicUrl(file), expiresAt: null };
    }

    const downloadUrl = await this.s3.createPresignedGetUrl(
      file.bucket,
      file.fileKey,
      file.originalName,
    );
    const expiresAt = new Date(Date.now() + 300_000);
    return { downloadUrl, expiresAt };
  }

  // ── 4. 파일 Soft Delete ────────────────────────────────────────────────────

  async deleteFile(companyId: string, userId: string, fileId: string) {
    const file = await this.filesRepo.findOne({
      where: { id: fileId, companyId },
    });

    if (!file || file.deletedAt) throw new NotFoundException('파일을 찾을 수 없습니다.');
    if (file.uploadedBy !== userId) {
      throw new ForbiddenException('본인이 업로드한 파일만 삭제할 수 있습니다.');
    }

    file.deletedAt = new Date();
    file.status = 'deleted';
    await this.filesRepo.save(file);
  }

  // ── 5. 저장 용량 사용 현황 ─────────────────────────────────────────────────

  async getUsage(companyId: string, companyPlan: string) {
    const features: FileFeature[] = ['tasks', 'messages', 'reports', 'profiles', 'logo'];

    const rows: { feature: string; bytes: string; count: string }[] =
      await this.filesRepo
        .createQueryBuilder('f')
        .select('f.feature', 'feature')
        .addSelect('COALESCE(SUM(f.file_size_bytes), 0)', 'bytes')
        .addSelect('COUNT(*)', 'count')
        .where('f.company_id = :companyId', { companyId })
        .andWhere('f.status = :status', { status: 'confirmed' })
        .andWhere('f.deleted_at IS NULL')
        .groupBy('f.feature')
        .getRawMany();

    const breakdown: Record<string, { bytes: number; count: number }> = {};
    let usedBytes = 0;

    for (const feat of features) {
      const row = rows.find(r => r.feature === feat);
      const bytes = row ? Number(row.bytes) : 0;
      const count = row ? Number(row.count) : 0;
      breakdown[feat] = { bytes, count };
      usedBytes += bytes;
    }

    // 플랜 저장 한도 (feature flags 시스템 미구현이므로 env 기반 fallback)
    const PLAN_STORAGE_GB: Record<string, number> = {
      free: 1, basic: 10, pro: 50, enterprise: 500,
    };
    const limitGb = PLAN_STORAGE_GB[companyPlan] ?? 1;
    const usedGb = usedBytes / 1024 / 1024 / 1024;

    return {
      usedBytes,
      usedGb: Math.round(usedGb * 1000) / 1000,
      limitGb,
      usagePercent: Math.round((usedGb / limitGb) * 100),
      breakdown,
    };
  }

  // ── 야간 배치: S3 실제 삭제 (FilesScheduler에서 호출) ──────────────────────

  async cleanupDeletedFiles(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 경과
    const pending = await this.filesRepo.find({
      where: {
        s3Deleted: false,
        deletedAt: LessThan(cutoff),
      },
      take: 1000,
    });

    if (pending.length === 0) return 0;

    await this.s3.deleteFiles(
      pending.map(f => ({ bucket: f.bucket, key: f.fileKey })),
    );

    const ids = pending.map(f => f.id);
    await this.filesRepo
      .createQueryBuilder()
      .update(File)
      .set({ s3Deleted: true })
      .whereInIds(ids)
      .execute();

    this.logger.log(`S3 정리 완료: ${pending.length}개 파일 삭제`);
    return pending.length;
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  private buildFileKey(companyId: string, feature: FileFeature, ext: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    // logo는 날짜 경로 없이 단순 구조
    if (feature === 'logo') {
      return `${companyId}/logo/${randomUUID()}.${ext}`;
    }
    return `${companyId}/${feature}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
  }

  private buildPublicUrl(file: File): string {
    if (this.cdnBase && PUBLIC_FEATURES.includes(file.feature as FileFeature)) {
      return `${this.cdnBase}/${file.fileKey}`;
    }
    // 로컬 개발 시 MinIO 직접 URL
    const endpoint = this.config.get<string>('AWS_ENDPOINT', '');
    if (endpoint) return `${endpoint}/${file.bucket}/${file.fileKey}`;
    return `https://${file.bucket}.s3.amazonaws.com/${file.fileKey}`;
  }

  private async checkStorageQuota(
    companyId: string,
    companyPlan: string,
    newFileSizeBytes: number,
  ): Promise<void> {
    const PLAN_STORAGE_GB: Record<string, number> = {
      free: 1, basic: 10, pro: 50, enterprise: 500,
    };
    const limitGb = PLAN_STORAGE_GB[companyPlan] ?? 1;
    const limitBytes = limitGb * 1024 * 1024 * 1024;

    const result = await this.filesRepo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.file_size_bytes), 0)', 'total')
      .where('f.company_id = :companyId', { companyId })
      .andWhere('f.status = :status', { status: 'confirmed' })
      .andWhere('f.deleted_at IS NULL')
      .getRawOne<{ total: string }>();

    const usedBytes = Number(result?.total ?? 0);
    if (usedBytes + newFileSizeBytes > limitBytes) {
      const usedGb = (usedBytes / 1024 / 1024 / 1024).toFixed(2);
      throw new ForbiddenException({
        code: 'STORAGE_QUOTA_EXCEEDED',
        message: `저장 용량이 부족합니다. (사용: ${usedGb}GB / 한도: ${limitGb}GB)`,
      });
    }
  }
}
