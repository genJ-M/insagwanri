import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from '../files.service';

@Injectable()
export class S3CleanupScheduler {
  private readonly logger = new Logger(S3CleanupScheduler.name);

  constructor(private readonly filesService: FilesService) {}

  /** 매일 03:00 KST (18:00 UTC) — 삭제된 파일 S3에서 실제 제거 */
  @Cron('0 18 * * *', { timeZone: 'UTC' })
  async handleS3Cleanup(): Promise<void> {
    this.logger.log('S3 파일 정리 배치 시작');
    try {
      const count = await this.filesService.cleanupDeletedFiles();
      this.logger.log(`S3 파일 정리 완료: ${count}개`);
    } catch (err) {
      this.logger.error('S3 파일 정리 배치 실패', err);
    }
  }
}
