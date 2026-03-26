import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserActivityLog, ActivityAction } from '../../database/entities/user-activity-log.entity';
import { CryptoService } from '../../common/crypto/crypto.service';

export interface LogActivityDto {
  userId?: string | null;
  companyId?: string | null;
  action: ActivityAction | string;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
}

/**
 * 통신비밀보호법 준수 — 사용자 활동 로그 서비스
 *
 * - 로그인/로그아웃/페이지 방문 기록
 * - IP 주소 AES-256-GCM 암호화 저장
 * - 90일 경과 로그 자동 삭제 (매일 새벽 2시 30분)
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(UserActivityLog)
    private readonly logRepo: Repository<UserActivityLog>,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * 활동 로그 기록 — fire-and-forget (실패해도 메인 요청에 영향 없음)
   */
  log(dto: LogActivityDto): void {
    this.persistLog(dto).catch((err) => {
      this.logger.warn(`활동 로그 저장 실패: ${err?.message}`);
    });
  }

  private async persistLog(dto: LogActivityDto): Promise<void> {
    const entity = this.logRepo.create({
      userId: dto.userId ?? null,
      companyId: dto.companyId ?? null,
      action: dto.action,
      ipAddressEncrypted: dto.ip ? this.cryptoService.encrypt(dto.ip) : null,
      userAgent: dto.userAgent ? dto.userAgent.slice(0, 500) : null,
      path: dto.path ? dto.path.slice(0, 500) : null,
      method: dto.method ?? null,
      statusCode: dto.statusCode ?? null,
    });
    await this.logRepo.save(entity);
  }

  /**
   * 특정 IP 복호화 (관리자 조회용)
   */
  decryptIp(ipEncrypted: string): string {
    return this.cryptoService.decrypt(ipEncrypted);
  }

  /**
   * 90일 경과 로그 삭제 — 매일 새벽 2:30
   * (AttendanceArchiveService의 새벽 2:00과 겹치지 않도록 30분 후로 설정)
   */
  @Cron('30 2 * * *')
  async cleanupOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    this.logger.log(`활동 로그 정리 시작. cutoff=${cutoff.toISOString()}`);

    try {
      const result = await this.logRepo.delete({ createdAt: LessThan(cutoff) });
      this.logger.log(`활동 로그 ${result.affected ?? 0}건 삭제 완료`);
    } catch (err: any) {
      this.logger.error(`활동 로그 정리 실패: ${err?.message}`);
    }
  }
}
